import { OrientationRole, OrdinalityRole, ModRole, FunctionalNodeRoles, NodeRoles } from './GraphGenerator';

export type NodeId = string;

export interface Node {
    id: NodeId;
    x: number;
    y: number;
    angle: number;
    meta: {
        roles: NodeRoles;
        generation: number;
        siblingIndex?: number;
        siblingCount?: number;
    }
}

export class NodeRecord implements Node {
    id: NodeId;
    x: number;
    y: number;
    angle: number;
    meta: {
        roles: NodeRoles;
        generation: number;
        siblingIndex?: number;
        siblingCount?: number;
    };

    constructor(data: Partial<Node> & Pick<Node, 'id'>) {
        this.id = data.id;
        this.x = data.x ?? 0;
        this.y = data.y ?? 0;
        this.angle = data.angle ?? 0;
        this.meta = {
            roles: data.meta?.roles ?? { functionalRoles: ['point'], modRoles: ['odd'], orientation: 'C', ordinality: 'middle' } as NodeRoles,
            generation: data.meta?.generation ?? 0,
            siblingIndex: data.meta?.siblingIndex,
            siblingCount: data.meta?.siblingCount,
        };
    }
}
