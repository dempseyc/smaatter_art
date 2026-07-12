import Graphology from 'graphology';

export function runConcentric(graphologyGraph: Graphology, width: number, height: number, centerX: number, centerY: number): void {
    const nodes = graphologyGraph.nodes();
    if (nodes.length === 0) {
        return;
    }

    const layers = new Map<string, number>();
    const visited = new Set<string>();
    const queue: Array<{ id: string; depth: number }> = [{ id: nodes[0], depth: 0 }];
    visited.add(nodes[0]);

    while (queue.length > 0) {
        const current = queue.shift();
        if (!current) {
            continue;
        }
        layers.set(current.id, current.depth);
        graphologyGraph.neighbors(current.id).forEach((neighbor) => {
            if (!visited.has(neighbor)) {
                visited.add(neighbor);
                queue.push({ id: neighbor, depth: current.depth + 1 });
            }
        });
    }

    const radiusBase = Math.min(width, height) * 0.28;

    nodes.forEach((nodeId, index) => {
        const depth = layers.get(nodeId) ?? 0;
        const radius = radiusBase * (0.8 + depth * 0.25);
        const angle = (index / Math.max(1, nodes.length)) * Math.PI * 2;
        graphologyGraph.setNodeAttribute(nodeId, 'x', centerX + Math.cos(angle) * radius);
        graphologyGraph.setNodeAttribute(nodeId, 'y', centerY + Math.sin(angle) * radius);
    });
}
