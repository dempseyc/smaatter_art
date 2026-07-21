import type { ForceProvider, ForceRuntimeContext, ForceTarget } from './types';

export const minDistForceProvider: ForceProvider = {
    key: 'minDistForce',
    isEnabled: (context: ForceRuntimeContext) => Boolean(context.forceSettings.minDistForce?.enabled),
    getTargets: (context: ForceRuntimeContext): ForceTarget[] => {
        const { graph, anchorIds, forceSettings } = context;
        const settings = forceSettings.minDistForce ?? {};
        const minDist = settings.minDist ?? 24;
        const minDistWeight = settings.weight ?? 1;
        const excludeBorder = settings.excludeBorder ?? true;
        const excludeTerminal = settings.excludeTerminal ?? true;

        const targets: ForceTarget[] = [];
        const candidates = Array.from(graph.nodes.values()).filter(node => {
            if (anchorIds.has(node.id)) return false;
            const roles = node.meta.roles.functionalRoles;
            const isBorder = roles.some(r => r === 'border' || r === 'border-joint');
            const isTerminal = roles.some(r => r === 'terminal');
            if (excludeBorder && isBorder) return false;
            if (excludeTerminal && isTerminal) return false;
            return true;
        });

        for (let i = 0; i < candidates.length; i++) {
            for (let j = i + 1; j < candidates.length; j++) {
                const nodeA = candidates[i];
                const nodeB = candidates[j];

                const dx = nodeB.x - nodeA.x;
                const dy = nodeB.y - nodeA.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist >= minDist) continue;

                const safeDist = Math.max(dist, 0.001);
                const overlapRatio = (minDist - safeDist) / minDist;
                const push = overlapRatio * minDistWeight;
                const dirX = dx / safeDist;
                const dirY = dy / safeDist;

                const axTarget = nodeA.x - dirX * push;
                const ayTarget = nodeA.y - dirY * push;
                const bxTarget = nodeB.x + dirX * push;
                const byTarget = nodeB.y + dirY * push;

                targets.push({ nodeId: nodeA.id, x: axTarget, y: ayTarget, weight: minDistWeight });
                targets.push({ nodeId: nodeB.id, x: bxTarget, y: byTarget, weight: minDistWeight });
            }
        }

        return targets;
    },
};
