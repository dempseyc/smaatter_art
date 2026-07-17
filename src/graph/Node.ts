import { NodeRoles } from './GraphGenerator';

export type NodeId = string;

export interface Node {
    id: NodeId;
    x: number;
    y: number;
    angle: number;
    /** Weighted target position set from the post-mutation snapshot. Used by layout algorithms. */
    targetX?: number;
    targetY?: number;
    parentId: string;
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
    targetX?: number;
    targetY?: number;
    parentId;
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
        this.targetX = data.targetX;
        this.targetY = data.targetY;
        this.parentId = '';
        this.meta = {
            roles: data.meta?.roles ?? { functionalRoles: ['point'], modRoles: ['odd'], orientation: 'centered', ordinality: 'middle' } as NodeRoles,
            generation: data.meta?.generation ?? 0,
            siblingIndex: data.meta?.siblingIndex,
            siblingCount: data.meta?.siblingCount,
        };
    }
}
