import { Graph } from './Graph';
import { NodeId } from './Node';

// edge and node roles
export type OrientationRole = 'L' | 'C' | 'R';
export type OrdinalityRole = 'first' | 'last' | 'middle';
export type ModRole = 'odd' | 'even' | 'mod3';
// node roles
export type FunctionalNodeRoles = 'point' | 'gen1' | 'gen0' | 'genN' | 'loop-root' | 'loop-joint' | 'y-fork' | 'hub' | 'terminal';
// edge roles
export type FunctionalEdgeRoles = 'seg' | 'gen0-seg' | 'gen1-seg' | 'genN-seg' | 'loop-seg' | 'spoke' | 'y-branch' | 'terminal';

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
        const ranB = Math.ceil(Math.random() * 5); // Number of gen1 nodes
        // const ranC = Math.ceil(Math.random() * 21); // Number of grandchildren, center parent
        // const ranD = Math.ceil(Math.random() * 3); // Number of grandchildren, non-center parent
        const ranC = 7;
        const ranD = 4;
        const gen1Ids: string[] = [];

        // add a root node
        graph.addNode({ id: '0', angle: 0, meta: { generation: 0, roles: { functionalRoles: ['gen0', 'hub'], modRoles: ['odd', 'mod3'], orientation: 'C', ordinality: 'first' } } });

        // create gen1 nodes and connect them to parent.  connect siblings in a chain, with the last one connecting back to the first
        for (let i = 0; i < ranB; i++) {
            const gen1Id = `N${i}`;
            const nodeRoles: NodeRoles = {
                orientation: 'C',
                ordinality: 'middle',
                functionalRoles: ['gen1', 'loop-joint'],
                modRoles: ['odd'],
            };
            const edgeRoles: EdgeRoles = {
                orientation: 'C',
                ordinality: 'middle',
                functionalRoles: ['gen0-seg', 'spoke'],
                modRoles: ['odd'],
            };
            // in radians
            const angle = (Math.PI * 2 / ranB) * i + Math.PI / ranB;

            const orientation =
                (ranB % 2 !== 0) && (i === Math.floor(ranB / 2)) ? 'C'
                    : (i < Math.floor(ranB / 2)) ? 'L'
                        : 'R';

            edgeRoles.orientation = orientation;
            nodeRoles.orientation = orientation;
            console.log('orientation ranB', orientation)

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
            gen1Ids.push(gen1Id);

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
            console.log(`Added gen1 node: ${gen1Id}`);
            // Connect gen1 nodes in a chain and connect the last one to the first
            edgeRoles.functionalRoles = ['gen1-seg', 'loop-seg'];
            edgeRoles.modRoles = [`${(i + 1) % 2 ? 'even' : 'odd'}`];
            if ((i + 1) % 3 === 0) { edgeRoles.modRoles.push('mod3'); }
            if (i + 1 === ranB) {
                graph.addEdge({
                    id: `${gen1Id}-${gen1Ids[0]}`,
                    a: gen1Id,
                    b: gen1Ids[0],
                    meta: {
                        roles: edgeRoles,
                        generation: 1,
                        siblingCount: ranB,
                        siblingIndex: i,
                    }
                });
            }
            if (i > 0) {
                const from = gen1Ids[i - 1];
                const to = gen1Id;
                graph.addEdge({ id: `${from}-${to}`, a: from, b: to, meta: { roles: edgeRoles, generation: 1, siblingCount: ranB, siblingIndex: i } });
            }
        }
        // Create child nodes for each gen1 node
        const addChildNodes = (parentIds: string[]) => {
            const nodeRoles: NodeRoles = {
                orientation: 'C',
                ordinality: 'middle',
                functionalRoles: ['terminal'],
                modRoles: ['odd'],
            };
            const edgeRoles: EdgeRoles = {
                orientation: 'C',
                ordinality: 'middle',
                functionalRoles: ['terminal'],
                modRoles: ['odd'],
            };

            for (let parentId of parentIds) {
                let centerParent: NodeId | null = (parentIds.length % 2 !== 0) ? parentIds[Math.floor(parentIds.length / 2)] : null;
                let ranChildren = (parentIds.length % 2 !== 0 && parentId === centerParent) ? ranC : ranD;
                centerParent && console.log('center parent', centerParent)
                for (let j = 0; j < ranChildren; j++) {
                    nodeRoles.orientation =
                        ranChildren % 2 !== 0 && j === Math.floor(ranChildren / 2) ? 'C'
                            : (j < Math.floor(ranChildren / 2)) ? 'L'
                                : 'R';
                    edgeRoles.orientation = nodeRoles.orientation;
                    nodeRoles.orientation === 'C' && console.log('C');
                    const childId = `${parentId}-${j}`;
                    graph.addNode({ id: childId, angle: ((Math.PI * 2 / ranChildren) * j + (Math.PI / ranChildren)), meta: { roles: nodeRoles, generation: 2, siblingIndex: j, siblingCount: ranChildren } });
                    graph.addEdge({ id: `${parentId}-${childId}`, a: parentId, b: childId, meta: { roles: edgeRoles, generation: 2, siblingCount: ranChildren, siblingIndex: j } });
                }
            }
        };
        addChildNodes(gen1Ids);
        return graph;
    }
}
