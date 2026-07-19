import { EdgeRecord, type Edge, type EdgeId } from './Edge';
import { NodeRecord, type Node, type NodeId } from './Node';

export type { Node, Edge, NodeId, EdgeId };

export interface GraphData {
    nodes: Map<NodeId, Node>;
    edges: Map<EdgeId, Edge>;
}

export class Graph implements GraphData {
    nodes = new Map<NodeId, Node>();
    edges = new Map<EdgeId, Edge>();

    addNode(data: Partial<Node> & Pick<Node, 'id'>): Node {
        const node = new NodeRecord(data);
        this.nodes.set(node.id, node);
        return node;
    }

    addEdge(data: Partial<Edge> & Pick<Edge, 'a' | 'b'>): Edge {
        const edge = new EdgeRecord({
            id: data.id ?? `${data.a}-${data.b}`,
            a: data.a,
            b: data.b,
            meta: {
                generation: data.meta?.generation || 0,
                roles: data.meta?.roles ?? { orientation: 'centered', ordinality: 'middle', modRoles: ['odd'], functionalRoles: ['seg'] },
                siblingCount: data.meta?.siblingCount || 0,
                siblingIndex: data.meta?.siblingIndex || 0,
            },
        });

        this.edges.set(edge.id, edge);
        return edge;
    }

    clone(): Graph {
        const copy = new Graph();
        // First pass: create all nodes
        this.nodes.forEach((node) => {
            copy.addNode({
                id: node.id,
                x: node.x,
                y: node.y,
                angle: node.angle,
                targetX: node.targetX,
                targetY: node.targetY,
                parentId: node.parentId,
                twinId: node.twinId,
                meta: {
                    roles: { ...node.meta.roles },
                    generation: node.meta.generation,
                    siblingIndex: node.meta.siblingIndex,
                    siblingCount: node.meta.siblingCount,
                }
            });
        });
        // Second pass: restore twinId references
        this.nodes.forEach((node) => {
            const copiedNode = copy.nodes.get(node.id);
            if (copiedNode && node.twinId) {
                copiedNode.twinId = node.twinId;
            }
        });
        this.edges.forEach((edge) => {
            copy.addEdge({ id: edge.id, a: edge.a, b: edge.b, meta: { roles: { ...edge.meta.roles }, generation: edge.meta.generation, siblingCount: edge.meta.siblingCount, siblingIndex: edge.meta.siblingIndex } });
        });
        return copy;
    }
}
