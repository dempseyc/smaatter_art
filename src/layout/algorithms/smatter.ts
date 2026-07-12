import Graphology from 'graphology';

export function runSmatter(graphologyGraph: Graphology, width: number, height: number, centerX: number, centerY: number): void {
    const nodes = graphologyGraph.nodes();
    if (nodes.length === 0) {
        return;
    }

    const rootId = graphologyGraph.hasNode('0') ? '0' : nodes[0];
    const radiusBase = Math.min(width, height) * 0.25;
    const visited = new Set<string>();

    const layout = (
        nodeId: string,
        parentId: string | null,
        depth: number,
        accumulatedAngle: number
    ) => {
        visited.add(nodeId);

        // The angle given by GraphGenerator.ts for this node
        const localAngle = (graphologyGraph.getNodeAttribute(nodeId, 'angle') as number) ?? 0;

        // The total angle branching out is the parent's angle + this child's local angle offset
        const totalAngle = accumulatedAngle + localAngle;

        // Save it back to the node in case we want it for drawing/reference later
        graphologyGraph.setNodeAttribute(nodeId, 'angle', totalAngle);

        // depth 0 is root, distance from center is 0. 
        // depth > 0 is branch, length gets smaller by dividing by depth
        const radius = depth === 0 ? 0 : radiusBase / depth;

        const parentX = parentId !== null ? graphologyGraph.getNodeAttribute(parentId, 'x') as number : centerX;
        const parentY = parentId !== null ? graphologyGraph.getNodeAttribute(parentId, 'y') as number : centerY;

        // turn 90deg, start 0 at inside
        graphologyGraph.setNodeAttribute(nodeId, 'x', parentX + (Math.cos(totalAngle + Math.PI / 2) * radius));
        graphologyGraph.setNodeAttribute(nodeId, 'y', parentY + (Math.sin(totalAngle + Math.PI / 2) * radius));

        // Only traverse outward to true children (not sibling-chain links).
        // Since child IDs are formatted like "N0", "N1" from root "0", 
        // and "N0-0", "N0-1" from parent "N0".
        const children = graphologyGraph.neighbors(nodeId)
            .filter((neighbor) => {
                if (neighbor === parentId || visited.has(neighbor)) {
                    return false;
                }

                const myGen = graphologyGraph.getNodeAttribute(nodeId, 'generation') as number;
                const neighborGen = graphologyGraph.getNodeAttribute(neighbor, 'generation') as number;

                // Only traverse outward to true children (next generation)
                return neighborGen === myGen + 1;
            });

        if (children.length === 0) {
            return;
        }

        children.forEach((child) => {
            // Pass the current totalAngle down as the parent's angle to the next generation
            layout(child, nodeId, depth + 1, totalAngle);
        });
    };

    // Root node starts with angle 0 (or whatever it's assigned)
    layout(rootId, null, 0, 0);
}

