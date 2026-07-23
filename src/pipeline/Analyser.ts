import { Graph, NodeId } from '../graph/Graph';
import type { EdgeRoles } from '../graph/GraphGenerator';

export type ClusterOperation = {
    type: 'nodeCluster';
    nodes: NodeId[];
};

export type ExpandOperation = {
    type: 'expand';
    nodeId: NodeId;
};

export type EdgeSplitOperation = {
    type: 'split-edge';
    edgeId: string;
    targetX: number;
    targetY: number;
};

export type IntersectionOperation = {
    type: 'intersect';
    edgeA: string;
    edgeB: string;
    targetX: number;
    targetY: number;
};

export type ConnectNeighborOperation = {
    type: 'connect-neighbor';
    sourceId: NodeId;
    targetId: NodeId;
    roles: EdgeRoles;
};

export type NodeLineIntersectionOperation = {
    type: 'node-line-intersect';
    nodeId: NodeId;
    edgeId: string;
    targetX: number;
    targetY: number;
};

export type GraphOperation = ClusterOperation | ExpandOperation | EdgeSplitOperation | IntersectionOperation | ConnectNeighborOperation | NodeLineIntersectionOperation;

export class Analyser {

    /**
     * Finds nodes that are close to each other whether or not they are connected.
     * and recommends merging them into a single cluster node.
     * Distance threshold is based on layout geometry width/32
     */
    static findNodeClusters(graph: Graph, width: number): ClusterOperation[] {
        const ops: ClusterOperation[] = [];
        const nodes = Array.from(graph.nodes.values());
        const threshold = width / 10; // Tighter threshold for merging

        const isMutable = (roles: string[]) => !roles.some(r =>
            r === 'border' || r === 'border-joint' || r === 'terminal' || r === 'to-border' || r === 'centered' || r === 'gen0'
        );

        // Build proximity map: nodeId → list of nearby mutable nodes
        const proximityMap = new Map<NodeId, Set<NodeId>>();
        for (const node of nodes) {
            if (!isMutable(node.meta.roles.functionalRoles)) continue;
            proximityMap.set(node.id, new Set());
        }

        // Find all close pairs
        for (let i = 0; i < nodes.length; i++) {
            const nodeA = nodes[i];
            if (!proximityMap.has(nodeA.id)) continue;

            for (let j = i + 1; j < nodes.length; j++) {
                const nodeB = nodes[j];
                if (!proximityMap.has(nodeB.id)) continue;

                const dx = nodeA.x - nodeB.x;
                const dy = nodeA.y - nodeB.y;
                const sqDist = dx * dx + dy * dy;

                if (sqDist < threshold) {
                    proximityMap.get(nodeA.id)!.add(nodeB.id);
                    proximityMap.get(nodeB.id)!.add(nodeA.id);
                }
            }
        }

        // Cluster transitively using union-find
        const visited = new Set<NodeId>();
        for (const startId of proximityMap.keys()) {
            if (visited.has(startId)) continue;

            // BFS to find all transitively connected close nodes
            const cluster: NodeId[] = [];
            const queue = [startId];
            while (queue.length > 0) {
                const id = queue.shift()!;
                if (visited.has(id)) continue;
                visited.add(id);
                cluster.push(id);

                for (const nearbyId of proximityMap.get(id)!) {
                    if (!visited.has(nearbyId)) {
                        queue.push(nearbyId);
                    }
                }
            }

            if (cluster.length > 1) {
                ops.push({ type: 'nodeCluster', nodes: cluster });
            }
        }

        return ops;
    }

    /**
     * Finds twin nodes in the graph. Every graph that is not in center line x=0, will have one twin on the opposite side.
     * if they are x=0 or very close to it, leave twinId as undefined. 
     * if x is not exactly 0 for the non-twin, immediately set it to 0.
    */
    static findTwins(graph: Graph, layoutWidth: number): void {
        const nodes = Array.from(graph.nodes.values());
        let twinCount = 0;

        for (const node of nodes) {
            if (node.twinId) continue; // Skip nodes that already have a twin
            if (Math.abs(node.x - layoutWidth / 2) < 1e-6) {
                node.x = layoutWidth / 2; // Snap to center line if very close
                continue; // Skip nodes that are near the center line
            }

            const twinNode = nodes.find(n => n.id !== node.id && Math.abs(n.x + node.x - layoutWidth) < 1 && Math.abs(n.y - node.y) < 1);

            if (twinNode) {
                node.twinId = twinNode.id;
                twinNode.twinId = node.id;
                twinCount++;
            }
        }
    }

    /**
     * Finds nodes that are close to each other but not directly connected and recommends connecting them with a new edge.
     * Distance threshold is based on layout geometry width/32
     */
    static findConnectableNeighbors(graph: Graph, width: number): ConnectNeighborOperation[] {
        const ops: ConnectNeighborOperation[] = [];
        const nodes = Array.from(graph.nodes.values());
        const threshold = width / 16;

        for (let i = 0; i < nodes.length; i++) {
            const nodeA = nodes[i];

            for (let j = i + 1; j < nodes.length; j++) {
                const nodeB = nodes[j];

                const dx = nodeA.x - nodeB.x;
                const dy = nodeA.y - nodeB.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < threshold) {
                    // Skip directly connected neighbors
                    const hasEdge = Array.from(graph.edges.values()).some(e =>
                        (e.a === nodeA.id && e.b === nodeB.id) ||
                        (e.a === nodeB.id && e.b === nodeA.id)
                    );
                    if (hasEdge) continue;

                    // Recommend connecting these two nodes
                    ops.push({
                        type: 'connect-neighbor',
                        sourceId: nodeA.id,
                        targetId: nodeB.id,
                        roles: { functionalRoles: ['to-border'], orientation: 'not-center', ordinality: 'middle', modRoles: [] }
                    });
                }
            }
        }

        return ops;
    }

    /**
     * Finds nodes that are very close to edges (within a small distance threshold).
     * These nodes should be snapped onto the edge and the edge split at that point.
     */
    static findNodeLineIntersections(graph: Graph, width: number): NodeLineIntersectionOperation[] {
        const ops: NodeLineIntersectionOperation[] = [];
        const nodes = Array.from(graph.nodes.values());
        const edges = Array.from(graph.edges.values());

        const threshold = width / 24; // Distance threshold for snapping nodes to edges

        // Helper to calculate distance from point to line segment
        const pointToLineDistance = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
            const dx = x2 - x1;
            const dy = y2 - y1;
            const lengthSq = dx * dx + dy * dy;

            let t = 0;
            let closestX = x1;
            let closestY = y1;

            if (lengthSq > 0) {
                t = ((px - x1) * dx + (py - y1) * dy) / lengthSq;
                t = Math.max(0, Math.min(1, t)); // Clamp t to [0, 1] to stay on segment
                closestX = x1 + t * dx;
                closestY = y1 + t * dy;
            }

            return {
                distance: Math.sqrt((px - closestX) ** 2 + (py - closestY) ** 2),
                x: closestX,
                y: closestY,
                t: t
            };
        };

        for (const node of nodes) {
            // removed intersection node guard here.

            for (const edge of edges) {
                // Don't snap a node to an edge it's already connected to
                if (edge.a === node.id || edge.b === node.id) continue;

                const nodeA = graph.nodes.get(edge.a);
                const nodeB = graph.nodes.get(edge.b);
                if (!nodeA || !nodeB) continue;

                const result = pointToLineDistance(node.x, node.y, nodeA.x, nodeA.y, nodeB.x, nodeB.y);

                if (result.distance < threshold && result.t > 0.05 && result.t < 0.95) {
                    // Only snap if it's truly between the endpoints, not too close to either
                    // console.log(`[Analyser] Found node ${node.id} close to edge ${edge.id} at distance ${result.distance.toFixed(2)}`);
                    ops.push({
                        type: 'node-line-intersect',
                        nodeId: node.id,
                        edgeId: edge.id,
                        targetX: result.x,
                        targetY: result.y
                    });
                }
            }
        }

        return ops;
    }

    /**
     * Finds edges that cross each other without a shared node.
     * Recommends creating an intersection node.
     * @param skipIntersectionEdges - If true, skip edges that connect to intersection nodes (prevents cascading). Set to false at end of analysis to catch final intersections.
     */
    static findEdgeIntersections(graph: Graph, layoutWidth: number, useToBorder: boolean = true, skipIntersectionEdges: boolean = false): IntersectionOperation[] {

        const ops: IntersectionOperation[] = [];
        // Exclude border-chain edges AND optionally edges that connect to or from intersection nodes
        const edges = Array.from(graph.edges.values()).filter(edge => {
            if (!useToBorder && edge.meta.roles.functionalRoles.includes('border-chain')) return false;
            // Optionally skip edges that already connect to intersection nodes (prevent cascading)
            if (skipIntersectionEdges && (edge.a.startsWith('I-') || edge.b.startsWith('I-'))) {
                // console.log(`[Analyser] Skipping edge ${edge.id} - connects to intersection node`);
                return false;
            }
            return true;
        });

        // Function to find intersection between two line segments
        const checkIntersection = (
            p0x: number, p0y: number, p1x: number, p1y: number,
            p2x: number, p2y: number, p3x: number, p3y: number
        ) => {
            const s1x = p1x - p0x;
            const s1y = p1y - p0y;
            const s2x = p3x - p2x;
            const s2y = p3y - p2y;

            const s = (-s1y * (p0x - p2x) + s1x * (p0y - p2y)) / (-s2x * s1y + s1x * s2y);
            const t = (s2x * (p0y - p2y) - s2y * (p0x - p2x)) / (-s2x * s1y + s1x * s2y);

            // If an intersection is found within the segments
            if (s >= 0 && s <= 1 && t >= 0 && t <= 1) {
                return {
                    intersects: true,
                    x: p0x + (t * s1x),
                    y: p0y + (t * s1y)
                };
            }

            return { intersects: false, x: 0, y: 0 };
        };

        // Helper to find the twin edge for a given edge
        const findTwinEdge = (edge: any): any | null => {
            const node1 = graph.nodes.get(edge.a);
            const node2 = graph.nodes.get(edge.b);
            if (!node1 || !node2 || !node1.twinId || !node2.twinId) return null;

            const twinEdge = Array.from(graph.edges.values()).find(e =>
                (e.a === node1.twinId && e.b === node2.twinId) ||
                (e.a === node2.twinId && e.b === node1.twinId)
            );
            return twinEdge || null;
        };

        for (let i = 0; i < edges.length; i++) {
            const edgeA = edges[i];
            const aNode1 = graph.nodes.get(edgeA.a);
            const aNode2 = graph.nodes.get(edgeA.b);

            if (!aNode1 || !aNode2) continue;

            for (let j = i + 1; j < edges.length; j++) {
                const edgeB = edges[j];

                // Don't check edges that share a node
                if (edgeA.a === edgeB.a || edgeA.a === edgeB.b ||
                    edgeA.b === edgeB.a || edgeA.b === edgeB.b) {
                    continue;
                }

                const bNode1 = graph.nodes.get(edgeB.a);
                const bNode2 = graph.nodes.get(edgeB.b);

                if (!bNode1 || !bNode2) continue;

                const result = checkIntersection(
                    aNode1.x, aNode1.y, aNode2.x, aNode2.y,
                    bNode1.x, bNode1.y, bNode2.x, bNode2.y
                );

                if (result.intersects) {
                    // Check if there is already a node right there so we don't spam intersections
                    const hasNodeNear = Array.from(graph.nodes.values()).some(n => {
                        const dx = n.x - result.x;
                        const dy = n.y - result.y;
                        return Math.sqrt(dx * dx + dy * dy) < 5;
                    });

                    // Check if we've already queued an intersection operation at these exact coordinates in this pass
                    const hasOpNear = ops.some(op => {
                        const dx = op.targetX - result.x;
                        const dy = op.targetY - result.y;
                        return Math.sqrt(dx * dx + dy * dy) < 5;
                    });

                    if (!hasNodeNear && !hasOpNear) {
                        // console.log(`[Analyser] Found intersection: ${edgeA.id} x ${edgeB.id} at (${result.x.toFixed(2)}, ${result.y.toFixed(2)})`);
                        ops.push({
                            type: 'intersect',
                            edgeA: edgeA.id,
                            edgeB: edgeB.id,
                            targetX: result.x,
                            targetY: result.y
                        });

                        // Ensure symmetry: if both edges have twins, also create intersection for twins
                        const twinEdgeA = findTwinEdge(edgeA);
                        const twinEdgeB = findTwinEdge(edgeB);
                        if (twinEdgeA && twinEdgeB) {
                            const symmetricX = layoutWidth - result.x;
                            // console.log(`[Analyser] Creating symmetric intersection for twins: ${twinEdgeA.id} x ${twinEdgeB.id} at (${symmetricX.toFixed(2)}, ${result.y.toFixed(2)})`);
                            ops.push({
                                type: 'intersect',
                                edgeA: twinEdgeA.id,
                                edgeB: twinEdgeB.id,
                                targetX: symmetricX,
                                targetY: result.y
                            });
                        }
                    }
                }
            }
        }

        return ops;
    }
    /**
     * Finds border-joint nodes and finds the nearest neighbor inside the border 
     * to connect to if an edge doesn't already exist. Supports equidistant targets.
     */
    static findBorderConnections(graph: Graph, layoutWidth: number): ConnectNeighborOperation[] {

        const ops: ConnectNeighborOperation[] = [];
        const nodes = Array.from(graph.nodes.values());

        // Find all border-joint nodes
        const borderJoints = nodes.filter(n => n.meta.roles.functionalRoles.includes('border-joint'));
        if (borderJoints.length === 0) return ops;

        // Max connection distance
        const maxDist = layoutWidth / 2;

        for (const joint of borderJoints) {
            let nearestNodes: NodeId[] = [];
            let minDistance = Infinity;

            // Define a small tolerance for floating point "equidistant" checks
            const EPSILON = 0.5;

            for (const node of nodes) {
                // Don't connect to other borders/terminals, we want interior structure nodes
                const isBorderNode = node.meta.roles.functionalRoles.some(r => r.includes('border'));
                const isTerminal = node.meta.roles.functionalRoles.includes('terminal');
                // Connect to any closer interior node, including new intersection nodes
                if (node.id === joint.id || isBorderNode || isTerminal) continue;

                const dx = node.x - joint.x;
                const dy = node.y - joint.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist > maxDist) continue;

                if (dist < minDistance - EPSILON) {
                    // We found a definitively closer node, reset the array
                    minDistance = dist;
                    nearestNodes = [node.id];
                } else if (Math.abs(dist - minDistance) <= EPSILON) {
                    // We found a node that is practically equidistant
                    nearestNodes.push(node.id);
                }
            }

            // console.log(`[BorderConn] Joint ${joint.id}: found ${nearestNodes.length} equidistant node(s) at distance ${minDistance.toFixed(2)}: ${nearestNodes.join(', ')}`);

            for (const targetNodeId of nearestNodes) {
                // Verify edge doesn't already exist
                const hasEdge = Array.from(graph.edges.values()).some(e =>
                    (e.a === joint.id && e.b === targetNodeId) ||
                    (e.a === targetNodeId && e.b === joint.id)
                );

                if (!hasEdge) {
                    // console.log(`[BorderConn]   → Connecting to ${targetNodeId}`);
                    ops.push({
                        type: 'connect-neighbor',
                        sourceId: joint.id,
                        targetId: targetNodeId,
                        roles: { functionalRoles: ['to-border'], orientation: 'not-center', ordinality: 'middle', modRoles: [] }
                    });
                } else {
                    // console.log(`[BorderConn]   → Edge to ${targetNodeId} already exists, skipping`);
                }
            }
        }

        return ops;
    }

    static findExpandableNodes(graph: Graph): ExpandOperation[] {

        const ops: ExpandOperation[] = [];
        const nodes = Array.from(graph.nodes.values());
        const expandableNodes: NodeId[] = [];
        if (nodes.length === 0) return ops;

        for (const node of nodes) {
            // Only consider nodes that are not border or terminal nodes or border-joint nodes or 'to-border'nodes which conect to border-joint nodes
            const isBorderNode = node.meta.roles.functionalRoles.some(r => r.includes('border'));
            const isTerminal = node.meta.roles.functionalRoles.includes('terminal');
            const isBorderJoint = node.meta.roles.functionalRoles.includes('border-joint');
            // const isCentered = node.meta.roles.orientation.includes('centered');
            if (isBorderNode || isTerminal || isBorderJoint) continue;

            // border-chain edges must not be counted never
            // If the node has more than 6 edges, we consider it expandable
            const nonBorderEdges = Array.from(graph.edges.values()).filter(e => {
                const isBorderEdge = e.meta.roles.functionalRoles.includes('border-chain');
                const isCentered = e.meta.roles.orientation.includes('centered');
                return !isCentered && !isBorderEdge && (e.a === node.id || e.b === node.id);
            });

            const edgeCount = Array.from(nonBorderEdges).filter(e => e.a === node.id || e.b === node.id).length;
            if (edgeCount > 6) {
                expandableNodes.push(node.id);
            }
        }

        // Plan symmetric expansions, avoiding overlap with already-expanded neighbors
        const planExpansions = () => {
            const expansions: ExpandOperation[] = [];
            const processed = new Set<NodeId>();

            for (const nodeId of expandableNodes) {
                if (processed.has(nodeId)) continue;

                const node = nodes.find(n => n.id === nodeId);
                if (!node) continue;

                // Check if any neighbor of this node has already been marked for expansion
                // If so, skip to prevent overlap
                const hasExpandedNeighbor = Array.from(graph.edges.values()).some(edge => {
                    const neighborId = edge.a === nodeId ? edge.b : (edge.b === nodeId ? edge.a : null);
                    return neighborId && processed.has(neighborId);
                });

                if (hasExpandedNeighbor) continue;

                if (node.twinId) {
                    const isTwinExpandable = expandableNodes.includes(node.twinId);
                    if (isTwinExpandable && !processed.has(node.twinId)) {
                        // Expand twin pair together for symmetry
                        expansions.push({ type: 'expand', nodeId });
                        expansions.push({ type: 'expand', nodeId: node.twinId });
                        processed.add(nodeId);
                        processed.add(node.twinId);
                    } else {
                        // Twin not expandable, just expand this node
                        expansions.push({ type: 'expand', nodeId });
                        processed.add(nodeId);
                    }
                } else {
                    // No twin (on center line), expand alone
                    expansions.push({ type: 'expand', nodeId });
                    processed.add(nodeId);
                }
            }

            return expansions;
        };

        return planExpansions();
    }
}
