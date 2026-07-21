import { Graph } from './Graph';

// edge and node roles
export type OrientationRole = 'centered' | 'not-center';
export type OrdinalityRole = 'end' | 'middle';
export type ModRole = 'odd' | 'even' | 'mod3' | 'serial';
// node roles
export type FunctionalNodeRoles = 'point' | 'gen1' | 'gen0' | 'genN' | 'loop-root' | 'loop-joint' | 'sibling-joint' | 'hub' | 'terminal' | 'border-paired' | 'border' | 'border-joint' | 'top-border' | 'right-border' | 'bottom-border' | 'left-border' | 'merged' | 'split' | 'hole-joint';
// edge roles
export type FunctionalEdgeRoles = 'seg' | 'gen0-seg' | 'gen1-seg' | 'genN-seg' | 'loop-seg' | 'sibling-seg' | 'spoke' | 'to-terminal' | 'to-border' | 'border-chain' | 'merged' | 'split' | 'hole-seg';

export type NodeRoles = {
    orientation: OrientationRole;
    ordinality: OrdinalityRole;
    functionalRoles: FunctionalNodeRoles[];
    modRoles: ModRole[];
};
export type EdgeRoles = {
    orientation: OrientationRole;
    ordinality: OrdinalityRole;
    functionalRoles: FunctionalEdgeRoles[];
    modRoles: ModRole[];
}

export class GraphGenerator {

    static generateGraph(): Graph {

        const graph = new Graph();
        const TOGGLE_RANDOM = false; // Set to true to randomize the numbers of nodes.
        const ranA = TOGGLE_RANDOM ? Math.ceil(Math.random() * 7) : 7; // Number of gen1 nodes
        const ranC = TOGGLE_RANDOM ? Math.ceil(Math.random() * 7) : 4; // Number of gen3, center parent
        const ranD = TOGGLE_RANDOM ? Math.ceil(Math.random() * 7) : 4; // Number of gen3, non-center parent
        const ranB = TOGGLE_RANDOM ? Math.ceil(Math.random() * 7) : 5; // Number of gen2 nodes
        const ranE = TOGGLE_RANDOM ? Math.ceil(Math.random() * 7) : 1; // Number of gen4, center parent
        const ranF = TOGGLE_RANDOM ? Math.ceil(Math.random() * 7) : 3; // Number of gen4, non-center parent

        console.log("numbers", ranA, ranC, ranD);
        let currentGenIds: string[] = [];
        const centerChildIds: string[] = [];

        // add a root node
        graph.addNode({ id: '0', angle: 0, meta: { generation: 0, roles: { functionalRoles: ['gen0', 'hub',], modRoles: ['odd', 'mod3'], orientation: 'centered', ordinality: 'end' } } });

        // create gen1 nodes and connect them to parent.  connect siblings in a chain, with the last one connecting back to the first
        for (let i = 0; i < ranA; i++) {
            const gen1Id = `N${i}`;
            const nodeRoles: NodeRoles = {
                orientation: 'not-center',
                ordinality: 'middle',
                functionalRoles: ['gen1', 'sibling-joint'],
                modRoles: [],
            };
            const edgeRoles: EdgeRoles = {
                orientation: 'not-center',
                ordinality: 'middle',
                functionalRoles: ['gen0-seg', 'spoke'],
                modRoles: [],
            };
            // in radians
            const angle = (Math.PI * 2 / ranA) * i + Math.PI / ranA;

            const orientation =
                ranA % 2 !== 0 && i === Math.floor(ranA / 2) ? 'centered'
                    : 'not-center';
            // set roles for child siblings and edges
            nodeRoles.orientation = orientation;
            if (i === 0 || i === ranA - 1) { edgeRoles.ordinality = 'end'; nodeRoles.ordinality = 'end'; }
            else { edgeRoles.ordinality = 'middle'; nodeRoles.ordinality = 'middle'; }
            // only apply odd, even labels to odd groups of spokes
            if ((ranA % 2 !== 0) && ranA > 3) { nodeRoles.modRoles.push(i % 2 === 0 ? 'odd' : 'even'); edgeRoles.modRoles.push(i % 2 === 0 ? 'odd' : 'even') }
            // if ranA is one more than mod3 === 0, start with first child, then every other three
            if (ranA % 3 === 1 && i % 3 === 0 && ranA > 6) { nodeRoles.modRoles.push('mod3'); edgeRoles.modRoles.push('mod3') }

            graph.addEdge({
                id: `N-${gen1Id}`,
                a: '0',
                b: gen1Id,
                meta: {
                    roles: edgeRoles,
                    generation: 1,
                    siblingCount: ranA,
                    siblingIndex: i,
                }
            });

            graph.addNode({
                id: gen1Id,
                angle: angle,
                meta: {
                    roles: nodeRoles,
                    generation: 1,
                    siblingIndex: i,
                    siblingCount: ranA
                }
            });
            currentGenIds.push(gen1Id);

            // Create a new roles object for the sibling chain edge
            const siblingEdgeRoles: EdgeRoles = {
                orientation: 'not-center',
                ordinality: "middle",
                functionalRoles: ["gen1-seg", "sibling-seg"],
                modRoles: []
            };

            // set roles
            // don't set for edges
            if (i === 0 || i === ranA - 1) { nodeRoles.ordinality = 'end'; }

            // don't apply odd even to loop chain            
            // if ranA is one more than mod3 === 0, start with first child, then every other three
            if (ranA % 3 === 1 && i % 3 === 0 && ranA > 6) { siblingEdgeRoles.modRoles.push('mod3'); edgeRoles.modRoles.push('mod3') }

            // Connect gen1 nodes in a chain and connect the last one to the first
            if (i + 1 === ranA) {
                graph.addEdge({
                    id: `${gen1Id}-${currentGenIds[0]}`,
                    a: gen1Id,
                    b: currentGenIds[0],
                    meta: {
                        roles: siblingEdgeRoles,
                        generation: 1,
                        siblingCount: ranA,
                        siblingIndex: i,
                    }
                });
            }
            if (i > 0) {
                const from = currentGenIds[i - 1];
                const to = gen1Id;
                graph.addEdge({ id: `${from}-${to}`, a: from, b: to, meta: { roles: siblingEdgeRoles, generation: 1, siblingCount: ranA, siblingIndex: i } });
            }
        }

        // Create ranC (center) or ranD child nodes for a set of parents
        const addChildNodes = (parentIds: string[], ranC: number, ranD: number, generation: number): string[] => {
            const nextGenIds: string[] = [];
            centerChildIds.length = 0;
            const hasCenterParent = parentIds.length % 2 !== 0;
            const centerParentId = hasCenterParent ? parentIds[Math.floor(parentIds.length / 2)] : null;

            for (let parentId of parentIds) {
                const isCenterParent = hasCenterParent && parentId === centerParentId;
                const ranChildren = isCenterParent ? ranC : ranD;

                for (let j = 0; j < ranChildren; j++) {
                    const nodeRoles: NodeRoles = {
                        orientation: "not-center",
                        ordinality: "middle",
                        functionalRoles: [],
                        modRoles: [],
                    };
                    const edgeRoles: EdgeRoles = {
                        orientation: "not-center",
                        ordinality: "middle",
                        functionalRoles: [],
                        modRoles: [],
                    };

                    nodeRoles.orientation =
                        ranChildren % 2 !== 0 && j === Math.floor(ranChildren / 2) ? "centered"
                            : "not-center";
                    edgeRoles.orientation = nodeRoles.orientation;
                    if (j === 0 || j === ranChildren - 1) { nodeRoles.ordinality = 'end'; }

                    // only apply odd, even labels to odd groups bigger than 3
                    if (ranChildren % 2 !== 0 && ranChildren > 3) { nodeRoles.modRoles.push(j % 2 === 0 ? 'odd' : 'even'); edgeRoles.modRoles.push(j % 2 === 0 ? 'odd' : 'even') }
                    // if ranChildren is one more than mod3 === 0, start with first child, then every other three
                    if (ranChildren % 3 === 1 && j % 3 === 0 && ranChildren > 6) { nodeRoles.modRoles.push('mod3'); edgeRoles.modRoles.push('mod3') }

                    const childId = `${parentId}-${j}`;
                    graph.addNode({ id: childId, angle: ((Math.PI * 2 / ranChildren) * j + (Math.PI / ranChildren)) - Math.PI, parentId: parentId, meta: { roles: nodeRoles, generation: generation, siblingIndex: j, siblingCount: ranChildren } });
                    graph.addEdge({ id: `${parentId}-${childId}`, a: parentId, b: childId, meta: { roles: edgeRoles, generation: generation, siblingCount: ranChildren, siblingIndex: j } });
                    nextGenIds.push(childId);
                    if (ranChildren % 2 !== 0 && j === Math.floor(ranChildren / 2)) {
                        centerChildIds.push(childId);
                    }

                    const siblingEdgeRoles: EdgeRoles = {
                        orientation: 'not-center',
                        ordinality: "middle",
                        functionalRoles: ["genN-seg", "sibling-seg"],
                        modRoles: []
                    };

                    // Connect gen2 nodes in a chain and connect the last one to the first
                    if (j + 1 === ranChildren) {
                        const firstChildId = `${parentId}-0`;
                        graph.addEdge({
                            id: `${childId}-${firstChildId}`,
                            a: childId,
                            b: firstChildId,
                            meta: {
                                roles: siblingEdgeRoles,
                                generation: 2,
                                siblingCount: ranChildren,
                                siblingIndex: j,
                            }
                        });
                    }
                    if (j > 0) {
                        const from = `${parentId}-${j - 1}`;
                        const to = childId;
                        graph.addEdge({ id: `${from}-${to}`, a: from, b: to, meta: { roles: siblingEdgeRoles, generation: 2, siblingCount: ranChildren, siblingIndex: j } });
                    }
                }
            }
            return nextGenIds;
        };

        const parentIds = [...currentGenIds];
        currentGenIds = addChildNodes(parentIds, ranC, ranD, 2);

        const borderNodeIds: string[] = [];

        // Add border nodes
        for (let pIdx = 0; pIdx < parentIds.length; pIdx++) {
            const parentId = parentIds[pIdx];

            // Find children for this parent
            const childIds = currentGenIds.filter(id => id.startsWith(`${parentId}-`));

            if (childIds.length === 0) continue;

            const len = childIds.length;
            const isOdd = len % 2 !== 0;
            const midIndex = Math.floor(len / 2);

            const borderId = `B-${parentId}`;
            const connectedChildren: string[] = [];
            const parentNode = graph.nodes.get(parentId);
            const parentOrientation = parentNode?.meta.roles.orientation || 'centered';
            const parentOrdinality = parentNode?.meta.roles.ordinality || 'middle';
            const borderAngle = parentNode?.angle || 0;

            if (isOdd) {
                connectedChildren.push(childIds[midIndex]);
            } else {
                if (len === 1) { // Unlikely, but just in case
                    connectedChildren.push(childIds[0]);
                } else {
                    connectedChildren.push(childIds[midIndex - 1]);
                    connectedChildren.push(childIds[midIndex]);
                }
            }

            const borderNodeRoles: NodeRoles = {
                orientation: parentOrientation,
                ordinality: parentOrdinality,
                functionalRoles: ['genN', 'border'],
                modRoles: []
            };

            graph.addNode({
                id: borderId,
                angle: borderAngle,
                parentId: parentId, // give same parentId as the children group
                meta: { roles: borderNodeRoles, generation: 3, siblingIndex: pIdx, siblingCount: parentIds.length }
            });
            borderNodeIds.push(borderId);

            // connect border node to middle child(ren)
            for (const childId of connectedChildren) {
                // also make that child a 'centered' node if it isn't already
                const childNode = graph.nodes.get(childId);
                if (childNode) {
                    childNode.meta.roles.functionalRoles.push('border-paired');
                    if (childNode.meta.roles.orientation !== 'centered') {
                        childNode.meta.roles.orientation = 'centered';
                    }
                }
                const toBorderEdgeRoles: EdgeRoles = {
                    orientation: 'centered',
                    ordinality: parentOrdinality,
                    functionalRoles: ['genN-seg', 'to-border'],
                    modRoles: []
                };
                graph.addEdge({
                    id: `${childId}-${borderId}`,
                    a: childId,
                    b: borderId,
                    meta: { roles: toBorderEdgeRoles, generation: 3, siblingCount: 1, siblingIndex: 0 }
                });
            }

            // add terminal node
            const terminalId = `T-${borderId}`;
            const terminalNodeRoles: NodeRoles = {
                orientation: parentOrientation,
                ordinality: parentOrdinality,
                functionalRoles: ['genN', 'terminal'],
                modRoles: []
            };
            graph.addNode({
                id: terminalId,
                angle: borderAngle,
                parentId: borderId,
                meta: { roles: terminalNodeRoles, generation: 4, siblingIndex: 0, siblingCount: 1 }
            });

            const toTerminalEdgeRoles: EdgeRoles = {
                orientation: parentOrientation,
                ordinality: parentOrdinality,
                functionalRoles: ['genN-seg', 'to-terminal'],
                modRoles: []
            };
            graph.addEdge({
                id: `${borderId}-${terminalId}`,
                a: borderId,
                b: terminalId,
                meta: { roles: toTerminalEdgeRoles, generation: 4, siblingCount: 1, siblingIndex: 0 }
            });
        }

        // Add chains between border nodes
        for (let bIdx = 0; bIdx < borderNodeIds.length; bIdx++) {
            const startBorderId = borderNodeIds[bIdx];
            const endBorderId = borderNodeIds[(bIdx + 1) % borderNodeIds.length];

            const startNode = graph.nodes.get(startBorderId);
            const endNode = graph.nodes.get(endBorderId);

            if (!startNode || !endNode) continue;

            let startAngle = startNode.angle;
            let endAngle = endNode.angle;

            // Handle angle wrap-around for the interpolation
            if (endAngle < startAngle) {
                endAngle += Math.PI * 2;
            }

            // Create ranA - 1 nodes between them
            const chainNodeCount = ranA - 1;
            let prevNodeId = startBorderId;

            for (let c = 1; c <= chainNodeCount; c++) {
                const fraction = c / (chainNodeCount + 1);
                let interpAngle = startAngle + (endAngle - startAngle) * fraction;

                // normalize back to standard range if it wrapped
                if (interpAngle >= Math.PI * 2) {
                    interpAngle -= Math.PI * 2;
                }

                const chainNodeId = `BC-${bIdx}-${c}`;

                const chainNodeRoles: NodeRoles = {
                    orientation: 'not-center',
                    ordinality: 'middle',
                    functionalRoles: ['genN', 'border-joint'],
                    modRoles: []
                };

                graph.addNode({
                    id: chainNodeId,
                    angle: interpAngle,
                    meta: { roles: chainNodeRoles, generation: 3, siblingIndex: c, siblingCount: chainNodeCount }
                });

                const chainEdgeRoles: EdgeRoles = {
                    orientation: 'not-center',
                    ordinality: 'middle',
                    functionalRoles: ['genN-seg', 'border-chain'],
                    modRoles: []
                };

                graph.addEdge({
                    id: `${prevNodeId}-${chainNodeId}`,
                    a: prevNodeId,
                    b: chainNodeId,
                    meta: { roles: chainEdgeRoles, generation: 3, siblingCount: chainNodeCount, siblingIndex: c - 1 }
                });

                prevNodeId = chainNodeId;
            }

            // Connect the last chain node to the end border node
            if (chainNodeCount > 0) {
                const finalChainEdgeRoles: EdgeRoles = {
                    orientation: 'not-center',
                    ordinality: 'middle',
                    functionalRoles: ['genN-seg', 'border-chain'],
                    modRoles: []
                };
                graph.addEdge({
                    id: `${prevNodeId}-${endBorderId}`,
                    a: prevNodeId,
                    b: endBorderId,
                    meta: { roles: finalChainEdgeRoles, generation: 3, siblingCount: chainNodeCount, siblingIndex: chainNodeCount }
                });
            } else {
                // If chainNodeCount is 0 (ranA was 1), connect start to end directly
                const directChainEdgeRoles: EdgeRoles = {
                    orientation: 'not-center',
                    ordinality: 'middle',
                    functionalRoles: ['genN-seg', 'border-chain'],
                    modRoles: []
                };
                graph.addEdge({
                    id: `${startBorderId}-${endBorderId}`,
                    a: startBorderId,
                    b: endBorderId,
                    meta: { roles: directChainEdgeRoles, generation: 3, siblingCount: 1, siblingIndex: 0 }
                });
            }
        }

        return graph;
    }

    // build done before merge and relax

    // if only 2 nodes, merge them. if 3 or more, chain them in order of angle from center point.
    static chainNodes(graph: Graph, nodeIds: string[], edgeRoles: EdgeRoles): void {
        if (nodeIds.length <= 3) {
            return this.mergeNodes(graph, nodeIds);
        };
        // Build deterministic angles around the cluster centroid (no parent-angle offset needed).
        const existingNodes = nodeIds
            .map(id => graph.nodes.get(id))
            .filter((n): n is NonNullable<typeof n> => Boolean(n));

        if (existingNodes.length <= 3) {
            return this.mergeNodes(graph, existingNodes.map(n => n.id));
        }

        let totalX = 0;
        let totalY = 0;
        for (const node of existingNodes) {
            totalX += node.x;
            totalY += node.y;
        }

        const centerReference = {
            x: totalX / existingNodes.length,
            y: totalY / existingNodes.length,
        };

        const nodesWithAngle = existingNodes.map(node => {
            let angle = Math.atan2(node.y - centerReference.y, node.x - centerReference.x);
            if (angle < 0) angle += Math.PI * 2;
            return { id: node.id, angle };
        });

        nodesWithAngle.sort((a, b) => a.angle - b.angle);
        const sortedNodeIds = nodesWithAngle.map(n => n.id);

        console.log(`[GraphGen] chainNodes: Sorted node IDs based on angle: ${sortedNodeIds.length}`);

        // Connect nodes in a chain based on the sorted order
        for (let i = 0; i < sortedNodeIds.length; i++) {
            const currentNodeId = sortedNodeIds[i];
            const nextNodeId = sortedNodeIds[(i + 1) % sortedNodeIds.length]; // wrap around to the first node

            const forwardId = `${currentNodeId}-${nextNodeId}`;
            const reverseId = `${nextNodeId}-${currentNodeId}`;
            const existingEdge = graph.edges.get(forwardId) ?? graph.edges.get(reverseId);
            if (existingEdge) {
                graph.edges.delete(existingEdge.id);
            }

            const nodeA = graph.nodes.get(currentNodeId);
            const nodeB = graph.nodes.get(nextNodeId);
            const generation = Math.max(nodeA?.meta.generation ?? 0, nodeB?.meta.generation ?? 0);

            graph.addEdge({
                id: forwardId,
                a: currentNodeId,
                b: nextNodeId,
                meta: {
                    roles: edgeRoles,
                    generation,
                    siblingCount: sortedNodeIds.length,
                    siblingIndex: i,
                }
            });
        }

    }

    static mergeNodes(graph: Graph, nodeIds: string[]): void {

        if (nodeIds.length < 2) return;

        // Keep the first node as the cluster root
        const targetId = nodeIds[0];
        const targetNode = graph.nodes.get(targetId);

        if (!targetNode) return;

        let totalX = targetNode.x;
        let totalY = targetNode.y;
        let totalAngle = targetNode.angle;

        // Collect all edges connected to the merged nodes
        const nodesToRemove: string[] = [];

        for (let i = 1; i < nodeIds.length; i++) {
            const sourceId = nodeIds[i];
            const sourceNode = graph.nodes.get(sourceId);
            if (!sourceNode) continue;

            totalX += sourceNode.x;
            totalY += sourceNode.y;
            totalAngle += sourceNode.angle;

            nodesToRemove.push(sourceId);
        }

        // Average out geometry
        targetNode.x = totalX / nodeIds.length;
        targetNode.y = totalY / nodeIds.length;
        targetNode.angle = totalAngle / nodeIds.length;

        targetNode.meta.roles.orientation = 'not-center';
        targetNode.meta.roles.ordinality = 'middle';
        if (!targetNode.meta.roles.functionalRoles.includes('merged')) {
            targetNode.meta.roles.functionalRoles.push('merged');
        }

        // Rewire edges
        const currentEdges = Array.from(graph.edges.values());
        for (const edge of currentEdges) {
            let rewired = false;
            let newA = edge.a;
            let newB = edge.b;

            if (nodesToRemove.includes(edge.a)) {
                newA = targetId;
                rewired = true;
            }
            if (nodesToRemove.includes(edge.b)) {
                newB = targetId;
                rewired = true;
            }

            if (rewired) {
                // If the edge now connects a node to itself, delete it
                if (newA === newB) {
                    graph.edges.delete(edge.id);
                } else {
                    // Create updated edge
                    const newId = `${newA}-${newB}`;
                    // Avoid duplicate edges
                    if (!graph.edges.has(newId)) {
                        const newMeta = { ...edge.meta };
                        newMeta.roles = { ...newMeta.roles };
                        newMeta.roles.functionalRoles = [...newMeta.roles.functionalRoles];
                        if (!newMeta.roles.functionalRoles.includes('merged')) {
                            newMeta.roles.functionalRoles.push('merged');
                        }

                        graph.addEdge({
                            id: newId,
                            a: newA,
                            b: newB,
                            meta: newMeta
                        });
                    }
                    // Remove old edge
                    graph.edges.delete(edge.id);
                }
            } else if (edge.a === targetId || edge.b === targetId) {
                // Also mark existing edges connected to the target node as derived
                if (!edge.meta.roles.functionalRoles.includes('merged')) {
                    edge.meta.roles.functionalRoles.push('merged');
                }
            }
        }

        // Remove the merged nodes
        for (const id of nodesToRemove) {
            graph.nodes.delete(id);
        }
    }

    static derivedEdge(graph: Graph, edgeId: string, nodeToInsertId: string, targetX: number, targetY: number): void {
        const edge = graph.edges.get(edgeId);
        const node = graph.nodes.get(nodeToInsertId);

        if (!edge || !node) return;

        // console.log(`[GraphGen] derivedEdge: Inserting ${nodeToInsertId} into edge ${edgeId} (${edge.a} -> ${edge.b}) at (${targetX.toFixed(2)}, ${targetY.toFixed(2)})`);

        // Snap node to the line segment
        node.x = targetX;
        node.y = targetY;

        const aId = edge.a;
        const bId = edge.b;

        // Make two new edges
        const metaBase = { ...edge.meta };
        metaBase.roles = { ...metaBase.roles };
        metaBase.roles.functionalRoles = [...metaBase.roles.functionalRoles];
        if (!metaBase.roles.functionalRoles.includes('split')) {
            metaBase.roles.functionalRoles.push('split');
        }

        const newEdge1Id = `${aId}-${nodeToInsertId}`;
        const newEdge2Id = `${nodeToInsertId}-${bId}`;

        // console.log(`[GraphGen]   Creating edges: ${newEdge1Id} and ${newEdge2Id}`);

        graph.addEdge({
            id: newEdge1Id,
            a: aId,
            b: nodeToInsertId,
            meta: metaBase
        });

        graph.addEdge({
            id: newEdge2Id,
            a: nodeToInsertId,
            b: bId,
            meta: metaBase
        });

        // Delete the original edge
        // console.log(`[GraphGen]   Deleting original edge ${edgeId}`);
        graph.edges.delete(edgeId);
    }

    static insertNodeIntoEdge(graph: Graph, nodeId: string, edgeId: string, targetX: number, targetY: number): void {
        const edge = graph.edges.get(edgeId);
        const node = graph.nodes.get(nodeId);

        if (!edge || !node) return;

        // console.log(`[GraphGen] Inserting node ${nodeId} into edge ${edgeId} at (${targetX.toFixed(2)}, ${targetY.toFixed(2)})`);

        // Position the node on the edge
        node.x = targetX;
        node.y = targetY;

        const aId = edge.a;
        const bId = edge.b;

        // Mark node with split and sibling-joint roles
        if (!node.meta.roles.functionalRoles.includes('split')) {
            node.meta.roles.functionalRoles.push('split');
        }
        if (!node.meta.roles.functionalRoles.includes('sibling-joint')) {
            node.meta.roles.functionalRoles.push('sibling-joint');
        }
        node.meta.roles.ordinality = 'middle';
        node.meta.roles.orientation = 'not-center';

        // Create new edges with split and sibling-seg roles
        const edgeRoles: EdgeRoles = {
            orientation: 'not-center',
            ordinality: 'middle',
            functionalRoles: ['split', 'sibling-seg'],
            modRoles: []
        };

        const newEdge1Id = `${aId}-${nodeId}`;
        const newEdge2Id = `${nodeId}-${bId}`;

        // console.log(`[GraphGen]   Creating edges: ${newEdge1Id} and ${newEdge2Id}`);

        graph.addEdge({
            id: newEdge1Id,
            a: aId,
            b: nodeId,
            meta: {
                roles: edgeRoles,
                generation: edge.meta.generation,
                siblingCount: 2,
                siblingIndex: 0
            }
        });

        graph.addEdge({
            id: newEdge2Id,
            a: nodeId,
            b: bId,
            meta: {
                roles: edgeRoles,
                generation: edge.meta.generation,
                siblingCount: 2,
                siblingIndex: 1
            }
        });

        // Delete the original edge
        // console.log(`[GraphGen]   Deleting original edge ${edgeId}`);
        graph.edges.delete(edgeId);
    }

    static splitEdge(graph: Graph, edgeId: string, targetX: number, targetY: number): void {

        const edge = graph.edges.get(edgeId);
        if (!edge) return;

        const nodeA = graph.nodes.get(edge.a);
        const nodeB = graph.nodes.get(edge.b);

        if (!nodeA || !nodeB) return;

        // Create intermediate node ID
        const intermediateNodeId = `S-${edgeId}-${Math.random().toString(36).substring(2, 9)}`;
        // console.log(`[GraphGen] Splitting edge ${edgeId} at (${targetX.toFixed(2)}, ${targetY.toFixed(2)}) with node ${intermediateNodeId}`);

        // Calculate angle based on endpoints
        const angle = (nodeA.angle + nodeB.angle) / 2;

        // Create intermediate node
        const node = graph.addNode({
            id: intermediateNodeId,
            angle: angle,
            meta: {
                generation: edge.meta.generation + 2,
                roles: {
                    orientation: 'not-center',
                    ordinality: 'middle',
                    functionalRoles: ['split'],
                    modRoles: []
                }
            }
        });

        if (node) {
            node.x = targetX;
            node.y = targetY;
        }

        // Use derivedEdge to split the original edge
        this.derivedEdge(graph, edgeId, intermediateNodeId, targetX, targetY);
    }

    static intersectEdges(graph: Graph, edgeAId: string, edgeBId: string, x: number, y: number): void {
        const edgeA = graph.edges.get(edgeAId);
        const edgeB = graph.edges.get(edgeBId);

        if (!edgeA || !edgeB) {
            console.log(`[GraphGen] Skipping intersection ${edgeAId} x ${edgeBId}: one or both edges already deleted`);
            return;
        }

        const angleA = graph.nodes.get(edgeA.a)?.angle;
        const angleB = graph.nodes.get(edgeA.b)?.angle;
        const angleC = graph.nodes.get(edgeB.a)?.angle;
        const angleD = graph.nodes.get(edgeB.b)?.angle;
        const angle = ((angleA ?? 0) + (angleB ?? 0) + (angleC ?? 0) + (angleD ?? 0)) / 4;

        // Normalize edge IDs so the same intersection always gets the same node ID
        const sortedEdgeIds = [edgeAId, edgeBId].sort();
        const intersectionNodeId = `I-${sortedEdgeIds[0]}-${sortedEdgeIds[1]}`;
        // console.log(`[GraphGen] Creating intersection node ${intersectionNodeId} at (${x.toFixed(2)}, ${y.toFixed(2)}) for edges ${edgeAId} x ${edgeBId}`);

        const node = graph.addNode({
            id: intersectionNodeId,
            angle: angle,
            meta: {
                generation: Math.max(edgeA.meta.generation, edgeB.meta.generation) + 1,
                roles: {
                    orientation: 'not-center',
                    ordinality: 'middle',
                    functionalRoles: ['point', 'split'],
                    modRoles: []
                }
            }
        });

        // Ensure position is set correctly
        if (node) {
            node.x = x;
            node.y = y;

            // Check for symmetric twin intersection node (at mirrored x position)
            const layoutWidth = 734; // Default layout width
            const symmetricX = layoutWidth - x;
            const twinIntersection = Array.from(graph.nodes.values()).find(n =>
                n.id.startsWith('I-') &&
                Math.abs(n.x - symmetricX) < 1 &&
                Math.abs(n.y - y) < 1 &&
                n.id !== intersectionNodeId
            );

            if (twinIntersection && !node.twinId) {
                node.twinId = twinIntersection.id;
                twinIntersection.twinId = node.id;
                // console.log(`[GraphGen] Linked intersection nodes as twins: ${intersectionNodeId} <-> ${twinIntersection.id}`);
            }
        }

        // Split edge A
        // console.log(`[GraphGen] Splitting edge ${edgeAId}`);
        this.derivedEdge(graph, edgeAId, intersectionNodeId, x, y);
        // Split edge B
        console.log(`[GraphGen] Splitting edge ${edgeBId}`);
        this.derivedEdge(graph, edgeBId, intersectionNodeId, x, y);
    }

    static connectNeighbor(graph: Graph, sourceId: string, targetId: string, roles?: EdgeRoles): void {
        // Create an edge between two neighbor nodes
        const edgeId = `${sourceId}-${targetId}`;

        // Avoid creating duplicate edges
        if (graph.edges.has(edgeId)) {
            return;
        }

        // Get generation from source node if available
        const sourceNode = graph.nodes.get(sourceId);
        const generation = sourceNode?.meta.generation ?? 0;

        const edgeRoles: EdgeRoles = {
            orientation: roles?.orientation ?? 'not-center',
            ordinality: roles?.ordinality ?? 'middle',
            functionalRoles: roles?.functionalRoles ?? ['sibling-seg'],
            modRoles: roles?.modRoles ?? []
        };

        graph.addEdge({
            id: edgeId,
            a: sourceId,
            b: targetId,
            meta: {
                roles: edgeRoles,
                generation: generation,
                siblingCount: 1,
                siblingIndex: 0
            }
        });
    }

    static createHole(graph: Graph, nodeId: string): void {
        const node = graph.nodes.get(nodeId);
        if (!node) return;

        // Get all neighbors of the node excluding itself, and any border or 'centered' nodes
        const neighbors = Array.from(graph.edges.values())
            .filter(edge => edge.a === nodeId || edge.b === nodeId)
            .map(edge => (edge.a === nodeId ? edge.b : edge.a))
            .filter(neighborId => {
                const neighborNode = graph.nodes.get(neighborId);
                if (!neighborNode) return false;
                const isBorderNode = neighborNode.meta.roles.functionalRoles.some(r => r.includes('border'));
                const isCenter = neighborNode.meta.roles.orientation.includes('centered');
                return !isBorderNode && !isCenter;
            });

        if (neighbors.length < 5) return; // arbitrary at least 3

        // Create new nodes interpolated between the original node and each neighbor
        const newNodeIds: string[] = [];
        for (let i = 0; i < neighbors.length; i++) {
            const neighborId = neighbors[i];
            const neighborNode = graph.nodes.get(neighborId);
            if (!neighborNode) continue;

            const newNodeId = `${nodeId}-H-${i}`;
            newNodeIds.push(newNodeId);

            // Interpolate position
            const newX = (node.x + neighborNode.x) / 2;
            const newY = (node.y + neighborNode.y) / 2;
            const newAngle = neighborNode.angle; // or some other logic to determine angle

            //node roles for hole nodes
            const nodeRoles: NodeRoles = {
                orientation: 'not-center',
                ordinality: 'middle',
                functionalRoles: ['hole-joint', 'split'],
                modRoles: []
            };

            graph.addNode({
                id: newNodeId,
                x: newX,
                y: newY,
                angle: newAngle,
                parentId: node.parentId,
                meta: {
                    generation: node.meta.generation + 1,
                    roles: nodeRoles,
                    siblingCount: neighbors.length,
                    siblingIndex: i
                }
            });

            // Connect new node to the neighbor it should also get labeled as 'hole-seg' and 'split' in its edge roles
            const edgeRoles: EdgeRoles = {
                orientation: 'not-center',
                ordinality: 'middle',
                functionalRoles: ['hole-seg', 'split'],
                modRoles: []
            };

            graph.addEdge({
                id: `${newNodeId}-${neighborId}`,
                a: newNodeId,
                b: neighborId,
                meta: {
                    roles: edgeRoles,
                    generation: node.meta.generation + 1,
                    siblingCount: 1,
                    siblingIndex: 0
                }
            });
            this.connectNeighbor(graph, newNodeId, neighborId);

            // Connect new nodes in a ring
            if (i > 0) {
                const prevNewNodeId = newNodeIds[i - 1];
                this.connectNeighbor(graph, prevNewNodeId, newNodeId, edgeRoles);
            }
            // Connect the last new node to the first new node to complete the ring
            if (i === neighbors.length - 1 && newNodeIds.length > 1) {
                const firstNewNodeId = newNodeIds[0];
                this.connectNeighbor(graph, newNodeId, firstNewNodeId, edgeRoles);
            }
            // delete the original node and its edges
            graph.nodes.delete(nodeId);
            for (const neighborId of neighbors) {
                const edgeId = `${nodeId}-${neighborId}`;
                graph.edges.delete(edgeId);
            }
        }
    }
}
