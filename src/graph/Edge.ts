import type { NodeId } from './Node';

export type EdgeId = string;

export type EdgeRoles = "stem" | "gen0" | "gen1" | "genN" | "loop-stem" | "spoke" | "y-branch" | "intersection" | "L" | "C" | "R" | "odd" | "even" | "mod3";

export interface Edge {
    id: EdgeId;
    a: NodeId;
    b: NodeId;
    meta: {
        roles: EdgeRoles[];
    }
}

export class EdgeRecord implements Edge {
    id: EdgeId;
    a: NodeId;
    b: NodeId;
    meta: {
        roles: EdgeRoles[];
    };

    constructor(data: Partial<Edge> & Pick<Edge, 'id' | 'a' | 'b'>) {
        this.id = data.id;
        this.a = data.a;
        this.b = data.b;
        this.meta = {
            roles: data.meta?.roles ?? ['stem']
        };
    }
}
