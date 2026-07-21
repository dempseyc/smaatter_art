import Graphology from 'graphology';

export function runSmatter(graphologyGraph: Graphology, width: number, height: number, centerX: number, centerY: number): void {
    const nodes = graphologyGraph.nodes();
    if (nodes.length === 0) {
        return;
    }

    const rootId = graphologyGraph.hasNode('0') ? '0' : nodes[0];
    const radiusBase = Math.min(width, height) * 0.25;
    const visited = new Set<string>();

    const layout0to3 = (
        nodeId: string,
        parentId: string | null,
        depth: number,
        accumulatedAngle: number
    ) => {
        visited.add(nodeId);

        const roles = (graphologyGraph.getNodeAttribute(nodeId, 'meta') as any)?.roles;
        const functionalRoles = roles?.functionalRoles || [];
        const isDerived = functionalRoles.includes('derived') || functionalRoles.includes('derived2');

        let totalAngle: number;

        if (isDerived) {
            // Derived nodes already have their absolute global geometry calculated by Analyzer/mergeNodes
            totalAngle = (graphologyGraph.getNodeAttribute(nodeId, 'angle') as number) ?? 0;
        } else {
            // The angle given by GraphGenerator.ts for this node
            const localAngle = (graphologyGraph.getNodeAttribute(nodeId, 'angle') as number) ?? 0;

            // The total angle branching out is the parent's angle + this child's local angle offset
            totalAngle = accumulatedAngle + localAngle; // Add Pi to flip the direction so that 0 is at the top (12 o'clock) instead of the right (3 o'clock)

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
        }

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
            const childGen = graphologyGraph.getNodeAttribute(child, 'generation') as number;
            if (childGen <= 2) {
                layout0to3(child, nodeId, depth + 1, totalAngle);
            }
        });
    };

    // Root node starts with angle 0 (or whatever it's assigned)
    layout0to3(rootId, null, 0, 0);

    // After recursive tree layout is complete, position border and terminal nodes absolutely
    // 3/8 width = width * 0.375
    // 1/2 width = width * 0.5 (minus a small margin to keep them on screen)
    const borderRadius = Math.min(width, height) * 0.425;
    const terminalRadius = (Math.min(width, height) * 0.5) - 20;

    nodes.forEach(nodeId => {
        const roles = (graphologyGraph.getNodeAttribute(nodeId, 'meta') as any)?.roles;
        const functionalRoles = roles?.functionalRoles || [];
        const isBorder = functionalRoles.includes('border') || (nodeId.startsWith('BC-')) || (nodeId.startsWith('B-'));
        const isTerminal = functionalRoles.includes('terminal') || (nodeId.startsWith('T-'));
        const isDerived = functionalRoles.includes('derived') || functionalRoles.includes('derived2');

        if (isDerived) {
            // Do not override derived nodes created by Analyzer pipeline operations
            return;
        }

        if (isBorder || isTerminal) {
            // These nodes have their global angle encoded directly from GraphGenerator
            let angle = (graphologyGraph.getNodeAttribute(nodeId, 'angle') as number) ?? 0;

            // if it is a terminal node starting with 'parentId-j', its angle is relative to the parent
            // we should get the total calculated angle that the parent accumulated
            if (isTerminal && !nodeId.startsWith('T-')) {
                const parentId = (graphologyGraph.getNodeAttribute(nodeId, 'parentId') as string) || (nodeId.split('-').slice(0, 2).join('-'));
                const parentAngle = (graphologyGraph.getNodeAttribute(parentId, 'angle') as number) ?? 0;
                angle = parentAngle + angle;
            }

            const radius = isTerminal ? terminalRadius : borderRadius;

            // We add Pi / 2 here to match the angle rotation used in layout0to3 above
            graphologyGraph.setNodeAttribute(nodeId, 'x', centerX + (Math.cos(angle + Math.PI / 2) * radius));
            graphologyGraph.setNodeAttribute(nodeId, 'y', centerY + (Math.sin(angle + Math.PI / 2) * radius));
        }
    });
}

