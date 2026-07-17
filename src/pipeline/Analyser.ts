import { Graph, NodeId } from '../graph/Graph';

export type MergeOperation = {
    type: 'merge';
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
};

export type GraphOperation = MergeOperation | ExpandOperation | EdgeSplitOperation | IntersectionOperation | ConnectNeighborOperation;

export class Analyser {
    /**
     * Finds nodes that are close to each other but not directly connected
     * and recommends merging them into a single cluster node.
     * Distance threshold is based on layout geometry width/32
     */
    static findMergeableNodes(graph: Graph, layoutWidth: number): MergeOperation[] {
        const threshold = layoutWidth / 32;
        const ops: MergeOperation[] = [];
        const nodes = Array.from(graph.nodes.values());
        const visited = new Set<NodeId>();

        const isMutable = (roles: string[]) => !roles.some(r =>
            r === 'border' || r === 'border-joint' || r === 'terminal'
        );

        for (let i = 0; i < nodes.length; i++) {
            const nodeA = nodes[i];
            if (visited.has(nodeA.id)) continue;
            // Border/terminal nodes are position references only — never mutate them
            if (!isMutable(nodeA.meta.roles.functionalRoles)) continue;

            const cluster = [nodeA.id];
            visited.add(nodeA.id);

            for (let j = i + 1; j < nodes.length; j++) {
                const nodeB = nodes[j];
                if (visited.has(nodeB.id)) continue;
                if (!isMutable(nodeB.meta.roles.functionalRoles)) continue;

                const dx = nodeA.x - nodeB.x;
                const dy = nodeA.y - nodeB.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < threshold) {
                    // Coincident nodes (dist ≈ 0) must always merge — they form a degenerate
                    // zero-length edge when splitEdge connects them, so hasEdge would be true
                    // even though they are the same physical point.
                    const coincident = dist < 1;
                    if (!coincident) {
                        // For non-coincident close nodes, skip directly connected neighbors
                        const hasEdge = Array.from(graph.edges.values()).some(e =>
                            (e.a === nodeA.id && e.b === nodeB.id) ||
                            (e.a === nodeB.id && e.b === nodeA.id)
                        );
                        if (hasEdge) continue;
                    }

                    cluster.push(nodeB.id);
                    visited.add(nodeB.id);
                }
            }

            if (cluster.length > 1) {
                ops.push({ type: 'merge', nodes: cluster });
            }
        }

        return ops;
    }

    /**
     * Finds nodes that are very close to an edge but aren't connected to it.
     * Recommends splitting the edge and making the node part of it.
     */
    static findEdgeProximities(graph: Graph, layoutWidth: number): EdgeSplitOperation[] {
        const threshold = layoutWidth / 32; // Tighter threshold for edge proximity
        const ops: EdgeSplitOperation[] = [];
        const nodes = Array.from(graph.nodes.values());
        const edges = Array.from(graph.edges.values());

        // Function to find the shortest distance from a point to a line segment
        const pointToSegmentDistance = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
            const A = px - x1;
            const B = py - y1;
            const C = x2 - x1;
            const D = y2 - y1;

            const dot = A * C + B * D;
            const lenSq = C * C + D * D;
            let param = -1;

            if (lenSq !== 0) {
                param = dot / lenSq;
            }

            let xx, yy;

            if (param < 0) {
                xx = x1;
                yy = y1;
            } else if (param > 1) {
                xx = x2;
                yy = y2;
            } else {
                xx = x1 + param * C;
                yy = y1 + param * D;
            }

            const dx = px - xx;
            const dy = py - yy;
            return {
                distance: Math.sqrt(dx * dx + dy * dy),
                targetX: xx,
                targetY: yy
            };
        };

        for (const edge of edges) {
            const nodeA = graph.nodes.get(edge.a);
            const nodeB = graph.nodes.get(edge.b);

            if (!nodeA || !nodeB) continue;

            for (const node of nodes) {
                // Don't check the edge's own endpoints
                if (node.id === nodeA.id || node.id === nodeB.id) continue;
                // Border/terminal nodes are position references only — don't use them to split edges
                if (node.meta.roles.functionalRoles.some(r =>
                    r === 'border' || r === 'border-joint' || r === 'terminal'
                )) continue;

                const result = pointToSegmentDistance(
                    node.x, node.y,
                    nodeA.x, nodeA.y,
                    nodeB.x, nodeB.y
                );

                if (result.distance < threshold) {
                    ops.push({
                        type: 'split-edge',
                        edgeId: edge.id,
                        targetX: result.targetX,
                        targetY: result.targetY
                    });

                    // Only find the absolute nearest node to split the edge by
                    // Break so we only perform one single split at a time on an edge to avoid coordinate shifting issues
                    break;
                }
            }
        }

        return ops;
    }

    /**
     * Finds edges that cross each other without a shared node.
     * Recommends creating an intersection node.
     */
    static findEdgeIntersections(graph: Graph): IntersectionOperation[] {
        const ops: IntersectionOperation[] = [];
        const edges = Array.from(graph.edges.values());

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

        // Don't check the same pair twice
        const checkedPairs = new Set<string>();

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
                        ops.push({
                            type: 'intersect',
                            edgeA: edgeA.id,
                            edgeB: edgeB.id,
                            targetX: result.x,
                            targetY: result.y
                        });
                        break;
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
        const maxDist = layoutWidth / 4;

        for (const joint of borderJoints) {
            let nearestNodes: NodeId[] = [];
            let minDistance = Infinity;

            // Define a small tolerance for floating point "equidistant" checks
            const EPSILON = 2.0;

            for (const node of nodes) {
                // Don't connect to other borders/terminals, we want interior structure nodes
                const isBorderNode = node.meta.roles.functionalRoles.some(r => r.includes('border'));
                const isTerminal = node.meta.roles.functionalRoles.includes('terminal');
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

            for (const targetNodeId of nearestNodes) {
                // Verify edge doesn't already exist
                const hasEdge = Array.from(graph.edges.values()).some(e =>
                    (e.a === joint.id && e.b === targetNodeId) ||
                    (e.a === targetNodeId && e.b === joint.id)
                );

                if (!hasEdge) {
                    ops.push({
                        type: 'connect-neighbor',
                        sourceId: joint.id,
                        targetId: targetNodeId
                    });
                }
            }
        }

        return ops;
    }

    static findExpandableNodes(graph: Graph): ExpandOperation[] {

        const ops: ExpandOperation[] = [];
        const nodes = Array.from(graph.nodes.values());
        if (nodes.length === 0) return ops;

        for (const node of nodes) {
            // Only consider nodes that are not border or terminal nodes or border-joint nodes or 'to-border'nodes which conect to border-joint nodes
            const isBorderNode = node.meta.roles.functionalRoles.some(r => r.includes('border'));
            const isTerminal = node.meta.roles.functionalRoles.includes('terminal');
            const isBorderJoint = node.meta.roles.functionalRoles.includes('border-joint');
            if (isBorderNode || isTerminal || isBorderJoint) continue;

            // border-chain edges must not be counted never
            // If the node has more than 5 edges, we consider it expandable
            const nonBorderEdges = Array.from(graph.edges.values()).filter(e => {
                const isToBorder = e.meta.roles.functionalRoles.includes('to-border');
                const isBorderEdge = e.meta.roles.functionalRoles.includes('border-chain');
                return !isBorderEdge && !isToBorder && (e.a === node.id || e.b === node.id);
            });
            if (nonBorderEdges.length > 5) {
                ops.push({ type: 'expand', nodeId: node.id });
            }
            const edgeCount = Array.from(graph.edges.values()).filter(e => e.a === node.id || e.b === node.id).length;
            if (edgeCount > 5) {
                ops.push({ type: 'expand', nodeId: node.id });
            }
        }

        return ops;
    }
}
