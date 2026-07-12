import Graphology from 'graphology';

export function runRandom(graphologyGraph: Graphology, width: number, height: number, centerX: number, centerY: number): void {
    const nodes = graphologyGraph.nodes();
    const radius = Math.min(width, height) * 0.3;

    nodes.forEach((nodeId) => {
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * radius;
        graphologyGraph.setNodeAttribute(nodeId, 'x', centerX + Math.cos(angle) * distance);
        graphologyGraph.setNodeAttribute(nodeId, 'y', centerY + Math.sin(angle) * distance);
    });
}
