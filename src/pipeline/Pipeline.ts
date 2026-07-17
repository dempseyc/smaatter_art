import { Graph } from '../graph/Graph';
import { Analyser, GraphOperation } from './Analyser';
import { GraphGenerator } from '../graph/GraphGenerator';
import { GraphLayoutEngine } from '../layout/GraphLayoutEngine';

export class Pipeline {
    static generateInitialGraph(layoutEngine: GraphLayoutEngine): Graph {
        let graph = GraphGenerator.generateGraph();
        layoutEngine.apply(graph);
        return graph;
    }

    static runFullAnalysis(graph: Graph, width: number): Graph {
        let currentGraph = graph.clone();

        let needsAnotherPass = true;
        let iteration = 0;
        const maxIterations = 50;

        let mergePhaseComplete = false;

        while (needsAnotherPass && iteration < maxIterations) {
            needsAnotherPass = false;

            const ops: GraphOperation[] = [];

            // Do all merges first. Only start doing intersections when no more merges exist

            if (!mergePhaseComplete) {
                const mergeOps = Analyser.findMergeableNodes(currentGraph, width);
                if (mergeOps.length > 0) {
                    ops.push(...mergeOps);
                } else {
                    mergePhaseComplete = true;
                }
            }

            if (mergePhaseComplete) {
                const intersectOps = [
                    ...Analyser.findEdgeProximities(currentGraph, width),
                    ...Analyser.findEdgeIntersections(currentGraph)
                ];

                if (intersectOps.length > 0) {
                    ops.push(...intersectOps);
                    mergePhaseComplete = false;
                } else {
                    // Only find border connections when ALL merges AND intersections are fully stabilized
                    ops.push(...Analyser.findBorderConnections(currentGraph, width));
                }
            }

            if (ops.length > 0) {
                // Keep track of modified edges/nodes in this pass so we don't apply multiple operations 
                // to entities that no longer exist (e.g. edge was already split/deleted)
                const modifiedEntities = new Set<string>();

                // Apply operations to the graph
                for (const op of ops) {
                    if (op.type === 'merge') {
                        // Check if any of the target nodes were already merged/split this pass
                        if (op.nodes.some(n => modifiedEntities.has(n))) continue;

                        GraphGenerator.mergeNodes(currentGraph, op.nodes);
                        op.nodes.forEach(n => modifiedEntities.add(n));
                        needsAnotherPass = true;
                    } else if (op.type === 'split-edge') {
                        if (modifiedEntities.has(op.edgeId)) continue;

                        const edge = currentGraph.edges.get(op.edgeId);
                        if (!edge) continue;
                        const targetGen = edge.meta.generation + 1;

                        // Generate a temporary unique ID for the node being snapped to the line
                        const splitNodeId = `split-${op.edgeId}-${Math.random().toString(36).substring(2, 7)}`;
                        currentGraph.addNode({
                            id: splitNodeId,
                            x: op.targetX,
                            y: op.targetY,
                            angle: 0,
                            meta: {
                                generation: targetGen, // derived
                                roles: {
                                    orientation: 'centered',
                                    ordinality: 'middle',
                                    functionalRoles: ['point', 'derived2'],
                                    modRoles: []
                                }
                            }
                        });
                        GraphGenerator.splitEdge(currentGraph, op.edgeId, splitNodeId, op.targetX, op.targetY);
                        modifiedEntities.add(op.edgeId);
                        needsAnotherPass = true;
                    } else if (op.type === 'intersect') {
                        if (modifiedEntities.has(op.edgeA) || modifiedEntities.has(op.edgeB)) continue;

                        GraphGenerator.intersectEdges(currentGraph, op.edgeA, op.edgeB, op.targetX, op.targetY);
                        modifiedEntities.add(op.edgeA);
                        modifiedEntities.add(op.edgeB);
                        // Force layout update after geometry generation
                        needsAnotherPass = true;
                    } else if (op.type === 'connect-neighbor') {
                        GraphGenerator.connectNeighbor(currentGraph, op.sourceId, op.targetId);
                        needsAnotherPass = true;
                        // New border edges may bring nodes close enough to merge —
                        // reset so the merge phase runs before the next border pass.
                        mergePhaseComplete = false;
                    }
                }

                // Positions are derived directly from node coordinates by the mutation
                // functions (splitEdge, intersectEdges, mergeNodes). Layout is not re-run
                // here so those precise placements are preserved across iterations.
            }

            iteration++;
        }

        return currentGraph;
    }
}