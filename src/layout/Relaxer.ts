import { Graph, NodeId } from '../graph/Graph';

export interface SpringSettings {
    stiffness?: number; // 0-1, how strongly edges pull
    minLength?: number; // minimum edge length
    maxLength?: number; // maximum edge length
    targetLength?: number; // desired edge length (or average if 0)
    grow?: number; // optional multiplier for average length, default 1
}

export class Relaxer {
    private static readonly DEFAULT_SPRINGS: SpringSettings = {
        stiffness: 0.5,
        minLength: 5,
        maxLength: 100,
        grow: 0.9, // can be + or -
        targetLength: 0 // 0 means bias toward shorter than average
    };

    /**
     * Calculate the average edge length in the graph.
     */
    static calculateAverageEdgeLength(graph: Graph): number {
        const edges = Array.from(graph.edges.values());
        if (edges.length === 0) return 50;

        let totalLength = 0;
        for (const edge of edges) {
            const nodeA = graph.nodes.get(edge.a);
            const nodeB = graph.nodes.get(edge.b);
            if (!nodeA || !nodeB) continue;

            const dx = nodeA.x - nodeB.x;
            const dy = nodeA.y - nodeB.y;
            totalLength += Math.sqrt(dx * dx + dy * dy);
        }
        console.log(`Average edge length: ${totalLength / edges.length}`);
        return totalLength / edges.length;
    }

    /**
     * Run relaxation iterations on the graph.
     * Border nodes and terminal nodes are fixed anchors.
     * N0 (root) can move.
     */
    static relax(graph: Graph, iterations: number = 50, springs: SpringSettings = {}, useBorder: boolean = true): void {
        // Merge provided springs with defaults (defaults used unless overridden)
        const settings = { ...this.DEFAULT_SPRINGS, ...springs };
        const avgLength = settings.targetLength! > 0 ? settings.targetLength! : this.calculateAverageEdgeLength(graph) * (settings.grow ?? 1);
        const DAMPING = 0.05; // Damping factor to reduce jitter
        // Identify anchor nodes (terminal nodes cannot move, and optionally border nodes)
        const anchorIds = new Set<NodeId>();
        for (const node of graph.nodes.values()) {
            const isTerminal = node.meta.roles.functionalRoles.some(r => r === 'terminal');
            const isBorder = !useBorder && node.meta.roles.functionalRoles.some(r =>
                r === 'border' || r === 'border-joint'
            );

            if (isTerminal || isBorder) {
                anchorIds.add(node.id);
            }
        }

        // Iterate relaxation
        for (let iter = 0; iter < iterations; iter++) {
            const forces = new Map<NodeId, { x: number; y: number }>();

            // Initialize forces
            for (const node of graph.nodes.values()) {
                forces.set(node.id, { x: 0, y: 0 });
            }

            // Calculate spring forces from edges
            for (const edge of graph.edges.values()) {
                const nodeA = graph.nodes.get(edge.a);
                const nodeB = graph.nodes.get(edge.b);
                if (!nodeA || !nodeB) continue;

                // Skip if both nodes are anchors
                const aIsAnchor = anchorIds.has(edge.a);
                const bIsAnchor = anchorIds.has(edge.b);
                if (aIsAnchor && bIsAnchor) continue;

                const dx = nodeB.x - nodeA.x;
                const dy = nodeB.y - nodeA.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < 0.001) continue; // Skip coincident nodes

                // Calculate desired length
                const desiredLength = avgLength;

                // Calculate spring force
                const lengthDiff = dist - desiredLength;
                const forceMagnitude = lengthDiff * settings.stiffness!;

                // Normalize direction
                const dirX = dx / dist;
                const dirY = dy / dist;

                // Calculate forces
                const forceX = dirX * forceMagnitude;
                const forceY = dirY * forceMagnitude;

                const forceA = forces.get(edge.a)!;
                const forceB = forces.get(edge.b)!;

                if (!aIsAnchor) {
                    // Node A can move: apply force
                    forceA.x += forceX;
                    forceA.y += forceY;
                }

                if (!bIsAnchor) {
                    // Node B can move: apply force
                    forceB.x -= forceX;
                    forceB.y -= forceY;
                }

                // If one is anchor and one is not, the moving node gets all the force
                // If neither is anchor, forces cancel (as before)
            }

            // Apply forces to nodes (except anchors)
            const damping = DAMPING; // Reduce jitter
            for (const node of graph.nodes.values()) {
                if (anchorIds.has(node.id)) continue; // Skip anchor nodes

                const force = forces.get(node.id)!;
                node.x += force.x * damping;
                node.y += force.y * damping;
            }
        }
    }
}
