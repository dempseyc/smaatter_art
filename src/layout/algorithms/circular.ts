import Graphology from 'graphology';

export function runCircular(graphologyGraph: Graphology, width: number, height: number, centerX: number, centerY: number): void {
    const nodes = graphologyGraph.nodes();
    if (nodes.length === 0) {
        return;
    }

    const radius = Math.min(width, height) * 0.3;
    nodes.forEach((nodeId, index) => {
        const angle = (index / Math.max(1, nodes.length)) * Math.PI * 2;
        graphologyGraph.setNodeAttribute(nodeId, 'x', centerX + Math.cos(angle) * radius);
        graphologyGraph.setNodeAttribute(nodeId, 'y', centerY + Math.sin(angle) * radius);
    });
}
