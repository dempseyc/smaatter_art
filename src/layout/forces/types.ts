import { Graph, NodeId } from '../../graph/Graph';

export interface SpringSettings {
    stiffness?: number; // 0-1, how strongly edges pull
    minLength?: number; // minimum edge length
    maxLength?: number; // maximum edge length
    targetLength?: number; // desired edge length (or average if 0)
    grow?: number; // optional multiplier for average length, default 1
}

export interface MinDistForceSettings {
    enabled?: boolean;
    minDist?: number;
    weight?: number;
    excludeBorder?: boolean;
    excludeTerminal?: boolean;
}

export interface SquareLensingForceSettings {
    enabled?: boolean;
    roundness?: number;
    weight?: number;
    maxRadialScale?: number;
    includeAnchors?: boolean;
    excludeBorder?: boolean;
    excludeTerminal?: boolean;
    debug?: boolean;
}

export interface ForceToolkitSettings {
    increment?: number;
    edgeTargetWeight?: number;
    minDistForce?: MinDistForceSettings;
    squareLensingForce?: SquareLensingForceSettings;
}

export type WeightedTarget = { x: number; y: number; w: number };
export type ForceTarget = { nodeId: NodeId; x: number; y: number; weight: number };

export interface ForceRuntimeContext {
    graph: Graph;
    anchorIds: Set<NodeId>;
    avgLength: number;
    springSettings: SpringSettings;
    forceSettings: ForceToolkitSettings;
}

export interface ForceProvider {
    key: string;
    isEnabled: (context: ForceRuntimeContext) => boolean;
    getTargets: (context: ForceRuntimeContext) => ForceTarget[];
}
