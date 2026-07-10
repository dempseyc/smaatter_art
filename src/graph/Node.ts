export type NodeId = string;

export type NodeRoles = "gen0" | "gen1" | "genN" | "sibling" | "ghost" | "child" | "parent" | "terminal" | "joint" | "loop-joint" | "looper" | "y-fork" | "intersection" | "first" | "last" | "middle" | "L" | "C" | "R" | "odd" | "even" | "mod3";

export interface Node {
    id: NodeId;
    x: number;
    y: number;
    meta: {
        roles: NodeRoles[];
        siblingIndex?: number;
        siblingCount?: number;
    };
}

export class NodeRecord implements Node {
    id: NodeId;
    x: number;
    y: number;
    meta: {
        roles: NodeRoles[];
        siblingIndex?: number;
        siblingCount?: number;
    };

    constructor(data: Partial<Node> & Pick<Node, 'id'>) {
        this.id = data.id;
        this.x = data.x ?? 0;
        this.y = data.y ?? 0;
        this.meta = {
            roles: data.meta?.roles ?? [],
            siblingIndex: data.meta?.siblingIndex,
            siblingCount: data.meta?.siblingCount,
        };
    }
}
