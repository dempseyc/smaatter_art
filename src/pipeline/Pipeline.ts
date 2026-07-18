import { Graph } from '../graph/Graph';
import { Analyser } from './Analyser';
import { GraphGenerator } from '../graph/GraphGenerator';
import { GraphLayoutEngine } from '../layout/GraphLayoutEngine';
import { GraphSnapshot, applySnapshotAsTargets, captureSnapshot } from '../graph/GraphSnapshot';

export interface AnalysisResult {
    graph: Graph;
    /** Node positions captured immediately before any mutations. */
    snapshots: GraphSnapshot[]; // [snapshot0, snapshot1, 2,3,4,etc]
}

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


    /** One pass of connecting nearby nodes that are not already connected. */
    private static runConnectNearby(graph: Graph, width: number): boolean {
        const ops = Analyser.findConnectableNeighbors(graph, width);
        if (ops.length === 0) return false;
        for (const op of ops) {
            GraphGenerator.connectNeighbor(graph, op.sourceId, op.targetId);
        }
        return true;
    }

    /** One pass of line-to-line intersections: finds crossing edges and creates intersection nodes. */
    private static runLineLineIntersections(graph: Graph): boolean {
        const ops = Analyser.findEdgeIntersections(graph);
        if (ops.length === 0) return false;

        const modified = new Set<string>();
        for (const op of ops) {
            if (modified.has(op.edgeA) || modified.has(op.edgeB)) continue;
            GraphGenerator.intersectEdges(graph, op.edgeA, op.edgeB, op.targetX, op.targetY);
            modified.add(op.edgeA);
            modified.add(op.edgeB);
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

    /** If a node has > 5 edges, make it a hole, by makeng a new node interpolated between itself and each neighbor,
     * then connecting those new nodes to each other in a ring, then removing the original node. This is a one-pass operation, and may need to be repeated if new nodes are created that also have > 5 edges. */
    static runHoleCreation(graph: Graph): boolean {
        const ops = Analyser.findExpandableNodes(graph);
        if (ops.length === 0) return false;
        for (const op of ops) {
            GraphGenerator.createHole(graph, op.nodeId);
        }
        return true;
    }

    /** Runs a full analysis pass on the graph, returning the final graph and snapshots of node positions before and after mutations. */

    static runFullAnalysis(graph: Graph, width: number): AnalysisResult {
        const currentGraph = graph.clone();
        const snapshot0 = captureSnapshot(currentGraph);
        const maxIterations = 50;
        Analyser.findTwins(currentGraph, width); // mark twins before running further operations, so that all future transformations remain symmetrical

        for (let i = 0; i < maxIterations; i++) {
            // Always merge first to a clean state
            if (Pipeline.runMerges(currentGraph, width)) continue; // later make dynamic based on count of mergeRuns
            if (Pipeline.runLineLineIntersections(currentGraph)) continue; // if we made any intersections, we need to re-run merges and intersections
            // if (Pipeline.runConnectNearby(currentGraph, width)) continue;  // not needed yet

            // Geometry is stable — wire border connections, then re-merge
            if (Pipeline.runBorderConnections(currentGraph, width)) continue; // if we made any border connections, we need to re-run merges and intersections

            // Nothing left to do
            break;
        }

        const snapshot1 = captureSnapshot(currentGraph);


        // Pipeline.runHoleCreation(currentGraph);
        const snapshot2 = captureSnapshot(currentGraph);

        applySnapshotAsTargets(currentGraph, snapshot2);


        return { graph: currentGraph, snapshots: [snapshot0, snapshot1, snapshot2] };
    }
}