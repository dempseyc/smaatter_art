import Graphology from 'graphology';

export function runForce(graphologyGraph: Graphology, width: number, height: number, centerX: number, centerY: number, iterations: number = 120): void {
    const nodes = graphologyGraph.nodes();
    if (nodes.length === 0) {
        return;
    }

    const positions = new Map<string, { x: number; y: number }>();
    const radius = Math.min(width, height) * 0.28;

    nodes.forEach((nodeId, index) => {
        const angle = (index / Math.max(1, nodes.length)) * Math.PI * 2;
        positions.set(nodeId, {
            x: centerX + Math.cos(angle) * radius,
            y: centerY + Math.sin(angle) * radius,
        });
    });

    const k = Math.sqrt((width * height) / Math.max(1, nodes.length)) * 0.7;

    for (let iteration = 0; iteration < iterations; iteration += 1) {
        const displacements = new Map<string, { x: number; y: number }>(nodes.map((nodeId) => [nodeId, { x: 0, y: 0 }]));

        nodes.forEach((nodeId) => {
            const current = positions.get(nodeId);
            if (!current) {
                return;
            }

            nodes.forEach((otherId) => {
                if (otherId === nodeId) {
                    return;
                }

                const other = positions.get(otherId);
                if (!other) {
                    return;
                }

                const dx = current.x - other.x;
                const dy = current.y - other.y;
                const distance = Math.hypot(dx, dy) || 0.0001;
                const force = (k * k) / Math.max(24, distance);
                const displacement = displacements.get(nodeId);
                if (!displacement) {
                    return;
                }

                displacement.x += (dx / distance) * force * 0.4;
                displacement.y += (dy / distance) * force * 0.4;
            });
        });

        graphologyGraph.forEachEdge((_, __, source, target) => {
            const sourcePosition = positions.get(source);
            const targetPosition = positions.get(target);
            if (!sourcePosition || !targetPosition) {
                return;
            }

            const dx = targetPosition.x - sourcePosition.x;
            const dy = targetPosition.y - sourcePosition.y;
            const distance = Math.hypot(dx, dy) || 0.0001;
            const force = (distance * distance) / (k * 2.2);
            const displacementSource = displacements.get(source);
            const displacementTarget = displacements.get(target);

            if (displacementSource) {
                displacementSource.x += (dx / distance) * force * 0.35;
                displacementSource.y += (dy / distance) * force * 0.35;
            }
            if (displacementTarget) {
                displacementTarget.x -= (dx / distance) * force * 0.35;
                displacementTarget.y -= (dy / distance) * force * 0.35;
            }
        });

        nodes.forEach((nodeId) => {
            const current = positions.get(nodeId);
            const displacement = displacements.get(nodeId);
            if (!current || !displacement) {
                return;
            }

            current.x += displacement.x * 0.05;
            current.y += displacement.y * 0.05;
            current.x += (centerX - current.x) * 0.01;
            current.y += (centerY - current.y) * 0.01;
        });
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
