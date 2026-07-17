import { Graph } from '../graph/Graph';
import { Analyser } from './Analyser';
import { GraphGenerator } from '../graph/GraphGenerator';
import { GraphLayoutEngine } from '../layout/GraphLayoutEngine';

export class Pipeline {
    static generateInitialGraph(layoutEngine: GraphLayoutEngine): Graph {
        let graph = GraphGenerator.generateGraph();
        layoutEngine.apply(graph);
        return graph;
    }

    /** Repeatedly merges close/coincident nodes until the graph is fully stable. */
    private static runMerges(graph: Graph, width: number): boolean {
        let anyMerged = false;
        let found = true;
        while (found) {
            const ops = Analyser.findMergeableNodes(graph, width);
            if (ops.length === 0) { found = false; break; }
            const modified = new Set<string>();
            for (const op of ops) {
                if (op.nodes.some(n => modified.has(n))) continue;
                GraphGenerator.mergeNodes(graph, op.nodes);
                op.nodes.forEach(n => modified.add(n));
                anyMerged = true;
            }
        }
        return anyMerged;
    }

    /** One pass of edge proximity snapping and edge intersection splitting. */
    private static runIntersections(graph: Graph, width: number): boolean {
        const ops = [
            ...Analyser.findEdgeProximities(graph, width),
            ...Analyser.findEdgeIntersections(graph),
        ];
        if (ops.length === 0) return false;

        const modified = new Set<string>();
        for (const op of ops) {
            if (op.type === 'split-edge') {
                if (modified.has(op.edgeId)) continue;
                const edge = graph.edges.get(op.edgeId);
                if (!edge) continue;
                const splitNodeId = `split-${op.edgeId}-${Math.random().toString(36).substring(2, 7)}`;
                graph.addNode({
                    id: splitNodeId,
                    x: op.targetX,
                    y: op.targetY,
                    angle: 0,
                    meta: {
                        generation: edge.meta.generation + 1,
                        roles: {
                            orientation: 'centered',
                            ordinality: 'middle',
                            functionalRoles: ['point', 'derived2'],
                            modRoles: [],
                        },
                    },
                });
                GraphGenerator.splitEdge(graph, op.edgeId, splitNodeId, op.targetX, op.targetY);
                modified.add(op.edgeId);
            } else if (op.type === 'intersect') {
                if (modified.has(op.edgeA) || modified.has(op.edgeB)) continue;
                GraphGenerator.intersectEdges(graph, op.edgeA, op.edgeB, op.targetX, op.targetY);
                modified.add(op.edgeA);
                modified.add(op.edgeB);
            }
        }
        return true;
    }

    /** One pass of border-joint → nearest interior node connections. */
    private static runBorderConnections(graph: Graph, width: number): boolean {
        const ops = Analyser.findBorderConnections(graph, width);
        if (ops.length === 0) return false;
        for (const op of ops) {
            GraphGenerator.connectNeighbor(graph, op.sourceId, op.targetId);
        }
        return true;
    }

    static runFullAnalysis(graph: Graph, width: number): Graph {
        const currentGraph = graph.clone();
        const maxIterations = 25;

        for (let i = 0; i < maxIterations; i++) {
            // Always merge first to a clean state
            Pipeline.runMerges(currentGraph, width);

            // If there is still geometry to resolve, loop back to merge again
            if (Pipeline.runIntersections(currentGraph, width)) continue;

            // Geometry is stable — wire border connections, then re-merge
            if (Pipeline.runBorderConnections(currentGraph, width)) continue;

            // Nothing left to do
            break;
        }

        return currentGraph;
    }
}
