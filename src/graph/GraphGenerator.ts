import { Graph } from './Graph';
import { NodeId, NodeRoles } from './Node';
import { EdgeRoles } from './Edge';

export class GraphGenerator {
    // edge and node roles
    // private static readonly orientationRoles = ['L', 'C', 'R'];
    // private static readonly ordinalityRoles = ['first', 'last', 'middle'];
    // private static readonly modRoles = ['odd', 'even', 'mod3'];
    // private static readonly sizeRoles = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    // // node roles
    // private static readonly connectionRoles = ['parent', 'child', 'sibling'];
    // private static readonly functionalNodeRoles = ['gen0', 'joint', 'loop-joint', 'looper', 'y-fork', 'intersection', 'terminal'];
    // // edge roles
    // private static readonly functionalEdgeRoles = ['stem', 'neck', 'finger', 'loop-stem', 'spoke', 'y-branch', 'intersection'];

    static generateGraph(): Graph {

        const graph = new Graph();

        const ranB = Math.ceil(Math.random() * 5); // Number of gen1 nodes
        const ranC = Math.ceil(Math.random() * 5); // Number of grandchildren, center parent
        const ranD = Math.ceil(Math.random() * 3); // Number of grandchildren, non-center parent
        const gen1Ids: string[] = [];

        // add a root node
        graph.addNode({ id: '0', meta: { roles: ['gen0'], siblingIndex: 0, siblingCount: 0 } });

        // create gen1 nodes and connect them to parent.  connect siblings in a chain, with the last one connecting back to the first
        for (let i = 0; i < ranB; i++) {
            const gen1Id = `N${i}`;
            const nodeRoles: NodeRoles[] = ['gen1' as NodeRoles];
            const edgeRoles: EdgeRoles[] = ['gen0' as EdgeRoles];
            const centerNodes: NodeId[] = [];
            // connect gen1 node to parent gen0 node.  assign 'C' to middle edge
            graph.addEdge({ id: `N-${gen1Id}`, a: '0', b: gen1Id, meta: { roles: [edgeRoles.pop() || edgeRoles[0], ...(i === Math.floor(ranB / 2) ? ['C' as EdgeRoles] : [])] } });
            edgeRoles.push('gen1' as EdgeRoles);
            // if odd number of gen1 nodes, assign 'C' role to the middle node, otherwise assign 'L' and 'R' roles to the left and right nodes respectively
            if (ranB % 2 !== 0 && i === Math.floor(ranB / 2)) {
                nodeRoles.push('C');
                centerNodes.push(gen1Id);
            } else {
                if (i < ranB / 2) {
                    nodeRoles.push('L');
                } else {
                    nodeRoles.push('R');
                }
            }
            gen1Ids.push(gen1Id);
            graph.addNode({ id: gen1Id, meta: { roles: nodeRoles, siblingIndex: i, siblingCount: ranB } });
            console.log(`Added gen1 node: ${gen1Id}`);
            // Connect gen1 nodes in a chain and connect the last one to the first
            if (i + 1 === ranB) {
                graph.addEdge({ id: `${gen1Id}-${gen1Ids[0]}`, a: gen1Id, b: gen1Ids[0], meta: { roles: [...edgeRoles, 'loop-stem'] } });
                console.log(`Added edge from ${gen1Id} to ${gen1Ids[0]}`);
            }
            if (i > 0) {
                const from = gen1Ids[i - 1];
                const to = gen1Id;
                graph.addEdge({ id: `${from}-${to}`, a: from, b: to, meta: { roles: [...edgeRoles, 'loop-stem'] } });
                console.log(`Added edge from ${from} to ${to}`);
            }
        }
        // Create child nodes for each gen1 node
        const addChildNodes = (parentIds: string[]) => {
            for (const parentId of parentIds) {
                const isCenterParent = graph.nodes.get(parentId)?.meta.roles.includes('C');
                const ranChildren = isCenterParent ? ranC : ranD;
                for (let j = 0; j < ranChildren; j++) {
                    const childId = `${parentId}-${j}`;
                    graph.addNode({ id: childId, meta: { roles: ['child', 'terminal'], siblingIndex: j, siblingCount: ranChildren } });
                    graph.addEdge({ id: `${parentId}-${childId}`, a: parentId, b: childId, meta: { roles: ['stem'] } });
                    console.log(`Added child node: ${childId} and edge from ${parentId} to ${childId}`);
                }
            }
        };
        addChildNodes(gen1Ids);
        return graph;
    }
}
