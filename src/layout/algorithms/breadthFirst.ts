import Graphology from 'graphology';

export function runBreadthFirst(graphologyGraph: Graphology, width: number, height: number, centerX: number, centerY: number): void {
    const nodes = graphologyGraph.nodes();
    if (nodes.length === 0) {
        return;
    }

    const levels = new Map<string, number>();
    const visited = new Set<string>();
    const queue: Array<{ id: string; level: number }> = [{ id: nodes[0], level: 0 }];
    visited.add(nodes[0]);

    while (queue.length > 0) {
        const current = queue.shift();
        if (!current) {
            continue;
        }
        levels.set(current.id, current.level);
        graphologyGraph.neighbors(current.id).forEach((neighbor) => {
            if (!visited.has(neighbor)) {
                visited.add(neighbor);
                queue.push({ id: neighbor, level: current.level + 1 });
            }
        });
    }

    const maxLevel = Math.max(...Array.from(levels.values()), 0);
    const spacing = Math.min(width, height) / Math.max(2, maxLevel + 2);

    nodes.forEach((nodeId) => {
        const level = levels.get(nodeId) ?? 0;
        const index = Array.from(levels.entries()).filter(([, value]) => value === level).findIndex(([id]) => id === nodeId);
        const column = level;
        const row = index;
        graphologyGraph.setNodeAttribute(nodeId, 'x', centerX + (column - maxLevel / 2) * spacing);
        graphologyGraph.setNodeAttribute(nodeId, 'y', centerY + (row - 2) * spacing * 0.85);
    });
}
