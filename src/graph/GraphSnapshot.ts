import type { Graph } from './Graph';
import type { OrientationRole, OrdinalityRole, ModRole, FunctionalNodeRoles, FunctionalEdgeRoles } from './GraphGenerator';

export interface NodeSnapshot {
    id: string;
    x: number;
    y: number;
    angle: number;
    targetX?: number;
    targetY?: number;
    parentId: string | undefined;
    meta: {
        roles: {
            orientation: OrientationRole;
            ordinality: OrdinalityRole;
            functionalRoles: FunctionalNodeRoles[];
            modRoles: ModRole[];
        };
        generation: number;
        siblingIndex?: number;
        siblingCount?: number;
    };
}

export interface EdgeSnapshot {
    id: string;
    a: string;
    b: string;
    meta: {
        roles: {
            orientation: OrientationRole;
            ordinality: OrdinalityRole;
            modRoles: ModRole[];
            functionalRoles: FunctionalEdgeRoles[];
        };
        generation: number;
        siblingCount: number;
        siblingIndex: number;
    };
}

/**
 * Full snapshot of every node and edge in a graph at a moment in time.
 * Nodes keyed by id; edges keyed by id.
 */
export interface GraphSnapshot {
    nodes: Map<string, NodeSnapshot>;
    edges: Map<string, EdgeSnapshot>;
}

/** Capture the full state of every node and edge. */
export function captureSnapshot(graph: Graph): GraphSnapshot {
    const nodes = new Map<string, NodeSnapshot>();
    graph.nodes.forEach((node, id) => {
        nodes.set(id, {
            id,
            x: node.x,
            y: node.y,
            angle: node.angle,
            targetX: node.targetX,
            targetY: node.targetY,
            parentId: node.parentId,
            meta: {
                roles: {
                    orientation: node.meta.roles.orientation,
                    ordinality: node.meta.roles.ordinality,
                    functionalRoles: [...node.meta.roles.functionalRoles],
                    modRoles: [...node.meta.roles.modRoles],
                },
                generation: node.meta.generation,
                siblingIndex: node.meta.siblingIndex,
                siblingCount: node.meta.siblingCount,
            },
        });
    });

    const edges = new Map<string, EdgeSnapshot>();
    graph.edges.forEach((edge, id) => {
        edges.set(id, {
            id,
            a: edge.a,
            b: edge.b,
            meta: {
                roles: {
                    orientation: edge.meta.roles.orientation,
                    ordinality: edge.meta.roles.ordinality,
                    modRoles: [...edge.meta.roles.modRoles],
                    functionalRoles: [...edge.meta.roles.functionalRoles],
                },
                generation: edge.meta.generation,
                siblingCount: edge.meta.siblingCount,
                siblingIndex: edge.meta.siblingIndex,
            },
        });
    });

    return { nodes, edges };
}

