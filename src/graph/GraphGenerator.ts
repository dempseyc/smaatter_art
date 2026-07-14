import { Graph } from './Graph';

// edge and node roles
export type OrientationRole = 'centered' | 'twinned';
export type OrdinalityRole = 'end' | 'middle';
export type ModRole = 'odd' | 'even' | 'mod3' | 'serial';
// node roles
export type FunctionalNodeRoles = 'point' | 'gen1' | 'gen0' | 'genN' | 'loop-root' | 'loop-joint' | 'sibling-joint' | 'y-fork' | 'hub' | 'terminal' | 'border' | 'top-border' | 'right-border' | 'bottom-border' | 'left-border';
// edge roles
export type FunctionalEdgeRoles = 'seg' | 'gen0-seg' | 'gen1-seg' | 'genN-seg' | 'loop-seg' | 'sibling-seg' | 'spoke' | 'y-branch' | 'terminal' | 'to-border';

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

        // const ranB = 7; // Number of gen1 nodes
        // const ranC = 17;
        // const ranD = 9;
        // const ranE = 5;

        let currentGenIds: string[] = [];
        const centerChildIds: string[] = [];

        // add a root node
        graph.addNode({ id: '0', angle: 0, meta: { generation: 0, roles: { functionalRoles: ['gen0', 'hub'], modRoles: ['odd', 'mod3'], orientation: 'centered', ordinality: 'end' } } });

        // create gen1 nodes and connect them to parent.  connect siblings in a chain, with the last one connecting back to the first
        for (let i = 0; i < ranB; i++) {
            const gen1Id = `N${i}`;
            const nodeRoles: NodeRoles = {
                orientation: 'centered',
                ordinality: 'middle',
                functionalRoles: ['gen1', 'sibling-joint'],
                modRoles: [],
            };
            const edgeRoles: EdgeRoles = {
                orientation: 'centered',
                ordinality: 'middle',
                functionalRoles: ['gen0-seg', 'spoke'],
                modRoles: [],
            };
            // in radians
            const angle = (Math.PI * 2 / ranB) * i + Math.PI / ranB;

            const orientation =
                ranB % 2 !== 0 && i === Math.floor(ranB / 2) ? 'centered'
                    : 'twinned';

            // set roles for spokes and child siblings
            edgeRoles.orientation = orientation;
            nodeRoles.orientation = orientation;
            if (i === 0 || i === ranB - 1) { edgeRoles.ordinality = 'end'; nodeRoles.ordinality = 'end'; }
            else { edgeRoles.ordinality = 'middle'; nodeRoles.ordinality = 'middle'; }
            // only apply odd, even labels to odd groups of siblings
            if (ranB % 2 !== 0) { nodeRoles.modRoles.push(i % 2 === 0 ? 'odd' : 'even'); edgeRoles.modRoles.push(i % 2 === 0 ? 'odd' : 'even') }
            // if one more than mod3 === 0, start with first child, then every other three
            if (ranB % 3 === 1 && i % 3 === 1) { nodeRoles.modRoles.push('mod3'); edgeRoles.modRoles.push('mod3') }

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

            // set roles
            edgeRoles.functionalRoles = ['gen1-seg', 'sibling-seg'];
            edgeRoles.modRoles = [`${(i + 1) % 2 ? 'even' : 'odd'}`];
            edgeRoles.orientation = orientation;
            if ((i + 1) % 3 === 0) { edgeRoles.modRoles.push('mod3'); }

            // Connect gen1 nodes in a chain and connect the last one to the first
            if (i + 1 === ranB) {
                graph.addEdge({
                    id: `${gen1Id}-${currentGenIds[0]}`,
                    a: gen1Id,
                    b: currentGenIds[0],
                    meta: {
                        roles: edgeRoles,
                        generation: 1,
                        siblingCount: ranB,
                        siblingIndex: i,
                    }
                });
            }
            if (i > 0) {
                const from = currentGenIds[i - 1];
                const to = gen1Id;
                graph.addEdge({ id: `${from}-${to}`, a: from, b: to, meta: { roles: edgeRoles, generation: 1, siblingCount: ranB, siblingIndex: i } });
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
                        orientation: "centered",
                        ordinality: "middle",
                        functionalRoles: [],
                        modRoles: [],
                    };
                    const edgeRoles: EdgeRoles = {
                        orientation: "centered",
                        ordinality: "middle",
                        functionalRoles: [],
                        modRoles: [],
                    };

                    nodeRoles.orientation =
                        ranChildren % 2 !== 0 && j === Math.floor(ranChildren / 2) ? "centered"
                            : "twinned";
                    edgeRoles.orientation = nodeRoles.orientation;
                    // only apply odd, even labels to odd groups of siblings
                    if (ranB % 2 !== 0) { nodeRoles.modRoles.push(j % 2 === 0 ? 'odd' : 'even'); edgeRoles.modRoles.push(j % 2 === 0 ? 'odd' : 'even') }
                    // if one more than mod3 === 0, start with first child, then every other three
                    if (ranB % 3 === 1 && j % 3 === 0) { nodeRoles.modRoles.push('mod3'); edgeRoles.modRoles.push('mod3') }

                    const childId = `${parentId}-${j}`;
                    graph.addNode({ id: childId, angle: ((Math.PI * 2 / ranChildren) * j + (Math.PI / ranChildren)) - Math.PI, meta: { roles: nodeRoles, generation: generation, siblingIndex: j, siblingCount: ranChildren } });
                    graph.addEdge({ id: `${parentId}-${childId}`, a: parentId, b: childId, meta: { roles: edgeRoles, generation: generation, siblingCount: ranChildren, siblingIndex: j } });
                    nextGenIds.push(childId);
                    if (ranChildren % 2 !== 0 && j === Math.floor(ranChildren / 2)) {
                        centerChildIds.push(childId);
                    }
                }
            }
            return nextGenIds;
        };

        const ranC = Math.ceil(((Math.random() * 34) / 2) + 1); // Number of grandchildren, center parent
        const ranD = Math.ceil(Math.random() * 9); // Number of grandchildren, non-center parent
        const ranE = Math.ceil(((Math.random() * 6) / 2) + 1) // make it an odd number 
        currentGenIds = addChildNodes([...currentGenIds], ranC, ranD, 2);
        currentGenIds = addChildNodes(currentGenIds, ranC, ranE, 3); // ranE, ranC always odd
        console.log('cchildids', centerChildIds);
        // add border nodes, v-border gets parents y, x is 0 or width, min distance.

        return graph;
    }
}

