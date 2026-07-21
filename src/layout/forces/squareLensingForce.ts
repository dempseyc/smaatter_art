import type { ForceProvider, ForceRuntimeContext, ForceTarget } from './types';

export const squareLensingForceProvider: ForceProvider = {
    key: 'squareLensingForce',
    isEnabled: (context: ForceRuntimeContext) => Boolean(context.forceSettings.squareLensingForce?.enabled),
    getTargets: (context: ForceRuntimeContext): ForceTarget[] => {
        const { graph, anchorIds, forceSettings } = context;
        const settings = forceSettings.squareLensingForce ?? {};
        const roundness = Math.max(0, settings.roundness ?? 0);
        const weight = settings.weight ?? 1;
        const maxRadialScale = Math.max(1, settings.maxRadialScale ?? 1.35);
        const includeAnchors = settings.includeAnchors ?? true;
        const excludeBorder = settings.excludeBorder ?? false;
        const excludeTerminal = settings.excludeTerminal ?? false;
        const debug = settings.debug ?? true;

        // roundness=0 means "no movement" by design.
        if (roundness <= 0 || weight <= 0) return [];

        const candidates = Array.from(graph.nodes.values()).filter(node => {
            if (!includeAnchors && anchorIds.has(node.id)) return false;
            const roles = node.meta.roles.functionalRoles;
            const isBorder = roles.some(r => r === 'border' || r === 'border-joint');
            const isTerminal = roles.some(r => r === 'terminal');
            if (excludeBorder && isBorder) return false;
            if (excludeTerminal && isTerminal) return false;
            return true;
        });

        if (candidates.length === 0) return [];

        const allNodes = Array.from(graph.nodes.values());

        // Compute center from candidate bounds to define local radial coordinates.
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        for (const node of candidates) {
            minX = Math.min(minX, node.x);
            maxX = Math.max(maxX, node.x);
            minY = Math.min(minY, node.y);
            maxY = Math.max(maxY, node.y);
        }

        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        // Use whole-graph bounds as frame limits so lensing stays inside the visible footprint.
        let frameMinX = Infinity;
        let frameMaxX = -Infinity;
        let frameMinY = Infinity;
        let frameMaxY = -Infinity;
        for (const node of allNodes) {
            frameMinX = Math.min(frameMinX, node.x);
            frameMaxX = Math.max(frameMaxX, node.x);
            frameMinY = Math.min(frameMinY, node.y);
            frameMaxY = Math.max(frameMaxY, node.y);
        }

        if (!Number.isFinite(frameMinX) || !Number.isFinite(frameMaxX) || !Number.isFinite(frameMinY) || !Number.isFinite(frameMaxY)) {
            frameMinX = minX;
            frameMaxX = maxX;
            frameMinY = minY;
            frameMaxY = maxY;
        }

        // circleRadius is the max distance from center among candidates.
        let circleRadius = 0;
        for (const node of candidates) {
            const dx = node.x - centerX;
            const dy = node.y - centerY;
            const r = Math.sqrt(dx * dx + dy * dy);
            circleRadius = Math.max(circleRadius, r);
        }

        if (circleRadius < 0.001) return [];

        const targets: ForceTarget[] = [];

        for (const node of candidates) {
            const dx = node.x - centerX;
            const dy = node.y - centerY;
            const r = Math.sqrt(dx * dx + dy * dy);
            if (r < 0.001) continue;

            const ux = dx / r;
            const uy = dy / r;

            const maxAxis = Math.max(Math.abs(ux), Math.abs(uy));
            if (maxAxis < 0.000001) continue;

            const t = 1 / maxAxis;
            const squareX = ux * t;
            const squareY = uy * t;

            // Ray distance from center to graph frame in this direction.
            const tx = Math.abs(ux) < 1e-9
                ? Number.POSITIVE_INFINITY
                : (ux > 0 ? (frameMaxX - centerX) / ux : (frameMinX - centerX) / ux);
            const ty = Math.abs(uy) < 1e-9
                ? Number.POSITIVE_INFINITY
                : (uy > 0 ? (frameMaxY - centerY) / uy : (frameMinY - centerY) / uy);
            const frameRayDist = Math.min(tx, ty);

            const fraction = Math.min(1, r / circleRadius);

            // Offset at roundness=1 (square lensing target at same radial fraction).
            const squareOffsetX = squareX * fraction * frameRayDist;
            const squareOffsetY = squareY * fraction * frameRayDist;

            let targetOffsetX = squareOffsetX;
            let targetOffsetY = squareOffsetY;

            if (roundness <= 1) {
                // roundness=0 -> current position; roundness=1 -> full square target.
                targetOffsetX = dx + (squareOffsetX - dx) * roundness;
                targetOffsetY = dy + (squareOffsetY - dy) * roundness;
            } else {
                // roundness>1 exaggerates corners and compresses edge directions.
                const cornerness = Math.min(1, Math.abs(ux * uy) * 2);
                const directionalGain = Math.max(0.1, 1 + (roundness - 1) * (2 * cornerness - 1));
                targetOffsetX = squareOffsetX * directionalGain;
                targetOffsetY = squareOffsetY * directionalGain;
            }

            // Keep radial magnitude from shrinking so lensing grows/fills toward corners.
            const targetRadius = Math.sqrt(targetOffsetX * targetOffsetX + targetOffsetY * targetOffsetY);
            if (targetRadius > 0 && targetRadius < r) {
                const grow = r / targetRadius;
                targetOffsetX *= grow;
                targetOffsetY *= grow;
            }

            // Clamp expansion to prevent diagonal overshoot and extreme distortion.
            const expandedRadius = Math.sqrt(targetOffsetX * targetOffsetX + targetOffsetY * targetOffsetY);
            const maxAllowedRadius = Math.min(frameRayDist, r * maxRadialScale);
            if (expandedRadius > maxAllowedRadius && expandedRadius > 0) {
                const shrink = maxAllowedRadius / expandedRadius;
                targetOffsetX *= shrink;
                targetOffsetY *= shrink;
            }

            targets.push({
                nodeId: node.id,
                x: centerX + targetOffsetX,
                y: centerY + targetOffsetY,
                weight,
            });
        }

        if (debug) {
            console.log(
                `[squareLensingForce] enabled=${settings.enabled} roundness=${roundness} weight=${weight} includeAnchors=${includeAnchors} ` +
                `excludeBorder=${excludeBorder} excludeTerminal=${excludeTerminal} maxRadialScale=${maxRadialScale} candidates=${candidates.length} targets=${targets.length}`
            );
        }

        return targets;
    },
};
