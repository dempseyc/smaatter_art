import { Graph, NodeId } from '../graph/Graph';

export interface SpringSettings {
    stiffness: number; // 0-1, how strongly edges pull
    minLength: number; // minimum edge length
    maxLength: number; // maximum edge length
    targetLength: number; // desired edge length (or average if 0)
}

export class Relaxer2 {
    private static readonly DEFAULT_SPRINGS: SpringSettings = {
        stiffness: 0.5,
        minLength: 5,
        maxLength: 100,
        targetLength: 1 // 0.9 means bias toward shorter than average
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
    static relax(graph: Graph, iterations: number = 50, options: { springs: SpringSettings } = { springs: this.DEFAULT_SPRINGS }): void {
        const avgLength = options.springs.targetLength > 0 ? options.springs.targetLength : this.calculateAverageEdgeLength(graph);

        // Identify anchor nodes (border and terminal nodes cannot move)
        const anchorIds = new Set<NodeId>();
        for (const node of graph.nodes.values()) {
            const isBorder = node.meta.roles.functionalRoles.some(r =>
                r === 'terminal'
                // r === 'border' || r === 'terminal' || r === 'border-joint'
            );
            if (isBorder) {
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

                const dx = nodeB.x - nodeA.x;
                const dy = nodeB.y - nodeA.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < 0.001) continue; // Skip coincident nodes

                // Calculate desired length
                const desiredLength = avgLength;

                // Calculate spring force
                const lengthDiff = dist - desiredLength;
                const forceMagnitude = lengthDiff * options.springs.stiffness;

                // Normalize direction
                const dirX = dx / dist;
                const dirY = dy / dist;

                // Apply force (push apart if too close, pull together if too far)
                const forceX = dirX * forceMagnitude;
                const forceY = dirY * forceMagnitude;

                const forceA = forces.get(edge.a)!;
                const forceB = forces.get(edge.b)!;

                forceA.x += forceX;
                forceA.y += forceY;
                forceB.x -= forceX;
                forceB.y -= forceY;
            }

            // Apply forces to nodes (except anchors)
            const damping = 0.3; // Reduce jitter
            for (const node of graph.nodes.values()) {
                if (anchorIds.has(node.id)) continue; // Skip anchor nodes

                const force = forces.get(node.id)!;
                node.x += force.x * damping;
                node.y += force.y * damping;
            }
        }
    }
}
