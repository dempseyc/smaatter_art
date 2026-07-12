import Graphology from 'graphology';

export function runGrid(graphologyGraph: Graphology, width: number, height: number, centerX: number, centerY: number): void {
    const nodes = graphologyGraph.nodes();
    const cols = Math.ceil(Math.sqrt(nodes.length));
    const rows = Math.ceil(nodes.length / cols);
    const spacingX = Math.min(width, height) / Math.max(2, cols + 1);
    const spacingY = Math.min(width, height) / Math.max(2, rows + 1);

    nodes.forEach((nodeId, index) => {
        const row = Math.floor(index / cols);
        const col = index % cols;
        graphologyGraph.setNodeAttribute(nodeId, 'x', centerX + (col - (cols - 1) / 2) * spacingX);
        graphologyGraph.setNodeAttribute(nodeId, 'y', centerY + (row - (rows - 1) / 2) * spacingY);
    });
}
