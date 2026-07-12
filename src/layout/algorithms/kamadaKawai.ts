import Graphology from 'graphology';

function computeShortestPaths(graphologyGraph: Graphology): Map<string, Map<string, number>> {
    const nodes = graphologyGraph.nodes();
    const distances = new Map<string, Map<string, number>>();

    nodes.forEach((nodeId) => {
        const visited = new Set<string>();
        const queue: Array<{ id: string; distance: number }> = [{ id: nodeId, distance: 0 }];
        const results = new Map<string, number>();
        visited.add(nodeId);
        results.set(nodeId, 0);

        while (queue.length > 0) {
            const current = queue.shift();
            if (!current) {
                continue;
            }
            graphologyGraph.neighbors(current.id).forEach((neighbor) => {
                if (visited.has(neighbor)) {
                    return;
                }
                visited.add(neighbor);
                const nextDistance = current.distance + 1;
                results.set(neighbor, nextDistance);
                queue.push({ id: neighbor, distance: nextDistance });
            });
        }

        distances.set(nodeId, results);
    });

    return distances;
}

export function runKamadaKawai(graphologyGraph: Graphology, width: number, height: number, centerX: number, centerY: number, iterations: number = 90): void {
    const nodes = graphologyGraph.nodes();
    if (nodes.length <= 1) {
        return;
    }

    const positions = new Map<string, { x: number; y: number }>();
    const nodeCount = nodes.length;
    const radius = Math.min(width, height) * 0.28;

    nodes.forEach((nodeId, index) => {
        const angle = (index / nodeCount) * Math.PI * 2;
        positions.set(nodeId, {
            x: centerX + Math.cos(angle) * radius,
            y: centerY + Math.sin(angle) * radius,
        });
    });

    const shortestPaths = computeShortestPaths(graphologyGraph);
    const targetScale = Math.max(40, radius / Math.max(2, Math.sqrt(nodeCount)));

    for (let iteration = 0; iteration < iterations; iteration += 1) {
        let moved = false;

        nodes.forEach((nodeId) => {
            const current = positions.get(nodeId);
            if (!current) {
                return;
            }

            let deltaX = 0;
            let deltaY = 0;

            nodes.forEach((otherId) => {
                if (otherId === nodeId) {
                    return;
                }

                const other = positions.get(otherId);
                if (!other) {
                    return;
                }

                const dx = other.x - current.x;
                const dy = other.y - current.y;
                const distance = Math.hypot(dx, dy) || 0.001;
                const pathLength = shortestPaths.get(nodeId)?.get(otherId) ?? 1;
                const idealDistance = Math.max(28, targetScale * pathLength);
                const diff = distance - idealDistance;
                const step = diff * 0.012;
                const directionX = dx / distance;
                const directionY = dy / distance;

                deltaX += directionX * step;
                deltaY += directionY * step;
            });

            const pullX = (centerX - current.x) * 0.008;
            const pullY = (centerY - current.y) * 0.008;
            const nextX = current.x + deltaX + pullX;
            const nextY = current.y + deltaY + pullY;

            current.x = Math.max(24, Math.min(width - 24, nextX));
            current.y = Math.max(24, Math.min(height - 24, nextY));

            if (Math.abs(nextX - current.x) > 0.001 || Math.abs(nextY - current.y) > 0.001) {
                moved = true;
            }
        });

        if (!moved) {
            break;
        }
    }

    nodes.forEach((nodeId) => {
        const position = positions.get(nodeId);
        if (!position) {
            return;
        }
        graphologyGraph.setNodeAttribute(nodeId, 'x', position.x);
        graphologyGraph.setNodeAttribute(nodeId, 'y', position.y);
    });
}
