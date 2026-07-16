import { Graph } from './Graph';

// edge and node roles
export type OrientationRole = 'centered' | 'not-center';
export type OrdinalityRole = 'end' | 'middle';
export type ModRole = 'odd' | 'even' | 'mod3' | 'serial';
// node roles
export type FunctionalNodeRoles = 'point' | 'gen1' | 'gen0' | 'genN' | 'loop-root' | 'loop-joint' | 'sibling-joint' | 'y-fork' | 'hub' | 'terminal' | 'border' | 'border-joint' | 'top-border' | 'right-border' | 'bottom-border' | 'left-border';
// edge roles
export type FunctionalEdgeRoles = 'seg' | 'gen0-seg' | 'gen1-seg' | 'genN-seg' | 'loop-seg' | 'sibling-seg' | 'spoke' | 'y-branch' | 'to-terminal' | 'to-border' | 'border-chain';

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
        const ranB = Math.ceil(Math.random() * 7); // Number of gen1 nodes

        let currentGenIds: string[] = [];
        const centerChildIds: string[] = [];

        // add a root node
        graph.addNode({ id: '0', angle: 0, meta: { generation: 0, roles: { functionalRoles: ['gen0', 'hub',], modRoles: ['odd', 'mod3'], orientation: 'centered', ordinality: 'end' } } });

        // create gen1 nodes and connect them to parent.  connect siblings in a chain, with the last one connecting back to the first
        for (let i = 0; i < ranB; i++) {
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
            const angle = (Math.PI * 2 / ranB) * i + Math.PI / ranB;

            const orientation =
                ranB % 2 !== 0 && i === Math.floor(ranB / 2) ? 'centered'
                    : 'not-center';
            // set roles for child siblings and edges
            nodeRoles.orientation = orientation;
            if (i === 0 || i === ranB - 1) { edgeRoles.ordinality = 'end'; nodeRoles.ordinality = 'end'; }
            else { edgeRoles.ordinality = 'middle'; nodeRoles.ordinality = 'middle'; }
            // only apply odd, even labels to odd groups of spokes
            if ((ranB % 2 !== 0) && ranB > 3) { nodeRoles.modRoles.push(i % 2 === 0 ? 'odd' : 'even'); edgeRoles.modRoles.push(i % 2 === 0 ? 'odd' : 'even') }
            // if ranB is one more than mod3 === 0, start with first child, then every other three
            if (ranB % 3 === 1 && i % 3 === 0 && ranB > 6) { nodeRoles.modRoles.push('mod3'); edgeRoles.modRoles.push('mod3') }

            graph.addEdge({
                id: `N-${gen1Id}`,
                a: '0',
                b: gen1Id,
                meta: {
                    roles: edgeRoles,
                    generation: 1,
                    siblingCount: ranB,
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
                    siblingCount: ranB
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
            if (i === 0 || i === ranB - 1) { nodeRoles.ordinality = 'end'; }

            // don't apply odd even to loop chain            
            // if ranB is one more than mod3 === 0, start with first child, then every other three
            if (ranB % 3 === 1 && i % 3 === 0 && ranB > 6) { siblingEdgeRoles.modRoles.push('mod3'); edgeRoles.modRoles.push('mod3') }

            // Connect gen1 nodes in a chain and connect the last one to the first
            if (i + 1 === ranB) {
                graph.addEdge({
                    id: `${gen1Id}-${currentGenIds[0]}`,
                    a: gen1Id,
                    b: currentGenIds[0],
                    meta: {
                        roles: siblingEdgeRoles,
                        generation: 1,
                        siblingCount: ranB,
                        siblingIndex: i,
                    }
                });
            }
            if (i > 0) {
                const from = currentGenIds[i - 1];
                const to = gen1Id;
                graph.addEdge({ id: `${from}-${to}`, a: from, b: to, meta: { roles: siblingEdgeRoles, generation: 1, siblingCount: ranB, siblingIndex: i } });
            }
        }
        // initial build done
        //

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

        const ranC = Math.ceil(((Math.random() * 34) / 2) + 1); // Number of grandchildren, center parent
        const ranD = Math.ceil(Math.random() * 7); // Number of grandchildren, non-center parent
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
                const toBorderEdgeRoles: EdgeRoles = {
                    orientation: parentOrientation,
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

            // Create ranB - 1 nodes between them
            const chainNodeCount = ranB - 1;
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
                    orientation: 'centered',
                    ordinality: 'middle',
                    functionalRoles: ['genN'],
                    modRoles: []
                };

                graph.addNode({
                    id: chainNodeId,
                    angle: interpAngle,
                    meta: { roles: chainNodeRoles, generation: 3, siblingIndex: c, siblingCount: chainNodeCount }
                });

                const chainEdgeRoles: EdgeRoles = {
                    orientation: 'centered',
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
                    orientation: 'centered',
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
                // If chainNodeCount is 0 (ranB was 1), connect start to end directly
                const directChainEdgeRoles: EdgeRoles = {
                    orientation: 'centered',
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
}

