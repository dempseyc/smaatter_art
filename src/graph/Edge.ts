import type { OrientationRole, OrdinalityRole, ModRole, FunctionalEdgeRoles } from './GraphGenerator';
import type { NodeId } from './Node';

export type EdgeId = string;

export interface Edge {
    id: EdgeId;
    a: NodeId;
    b: NodeId;
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

export class EdgeRecord implements Edge {
    id: EdgeId;
    a: NodeId;
    b: NodeId;
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

    constructor(data: Partial<Edge> & Pick<Edge, 'id' | 'a' | 'b'>) {
        this.id = data.id;
        this.a = data.a;
        this.b = data.b;
        this.meta = {
            roles: data.meta?.roles ?? { orientation: 'C', ordinality: 'middle', modRoles: ['odd'], functionalRoles: ['seg'] },
            generation: data.meta?.generation ?? 0,
            siblingCount: data.meta?.siblingCount || 0,
            siblingIndex: data.meta?.siblingIndex || 0,
        };
    }
}
