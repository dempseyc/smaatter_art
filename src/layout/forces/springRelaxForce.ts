import type { ForceProvider, ForceRuntimeContext, ForceTarget } from './types';

export const springRelaxForceProvider: ForceProvider = {
    key: 'springRelaxForce',
    isEnabled: () => true,
    getTargets: (context: ForceRuntimeContext): ForceTarget[] => {
        const { graph, anchorIds, lockedNodeIds, avgLength, springSettings, forceSettings } = context;
        const edgeWeight = forceSettings.edgeTargetWeight ?? 1;
        const stiffness = springSettings.stiffness ?? 0.5;
        const targets: ForceTarget[] = [];

        for (const edge of graph.edges.values()) {
            const nodeA = graph.nodes.get(edge.a);
            const nodeB = graph.nodes.get(edge.b);
            if (!nodeA || !nodeB) continue;

            const aIsAnchor = anchorIds.has(edge.a);
            const bIsAnchor = anchorIds.has(edge.b);
            const aIsLocked = lockedNodeIds.has(edge.a);
            const bIsLocked = lockedNodeIds.has(edge.b);
            if (aIsAnchor && bIsAnchor) continue;

            const dx = nodeB.x - nodeA.x;
            const dy = nodeB.y - nodeA.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 0.001) continue;

            const lengthDiff = dist - avgLength;
            const forceMagnitude = lengthDiff * stiffness;
            const dirX = dx / dist;
            const dirY = dy / dist;

            const axTarget = nodeA.x + dirX * forceMagnitude;
            const ayTarget = nodeA.y + dirY * forceMagnitude;
            const bxTarget = nodeB.x - dirX * forceMagnitude;
            const byTarget = nodeB.y - dirY * forceMagnitude;

            if (!aIsAnchor && !aIsLocked) {
                targets.push({ nodeId: nodeA.id, x: axTarget, y: ayTarget, weight: edgeWeight });
            }
            if (!bIsAnchor && !bIsLocked) {
                targets.push({ nodeId: nodeB.id, x: bxTarget, y: byTarget, weight: edgeWeight });
            }
        }

        return targets;
    },
};
