import { Graph } from '../graph/Graph';
import { Node } from '../graph/Node';
import { Analyser, type IntersectionOperation } from './Analyser';
import { GraphGenerator } from '../graph/GraphGenerator';
import { GraphLayoutEngine } from '../layout/GraphLayoutEngine';
import { captureSnapshot } from '../graph/GraphSnapshot';
import type { GraphSnapshot } from '../graph/GraphSnapshot';
import { Relaxer } from '../layout/Relaxer';

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

    /** One pass of node-line intersections: finds nodes close to edges and snaps them onto the edge. */
    private static runNodeLineIntersections(graph: Graph, width: number): boolean {
        const ops = Analyser.findNodeLineIntersections(graph);
        if (ops.length === 0) return false;

        console.log(`[NodeLineIntersections] Found ${ops.length} node-line intersections`);
        ops.forEach((op, i) => {
            console.log(`  Op ${i}: node ${op.nodeId} -> edge ${op.edgeId} at (${op.targetX.toFixed(2)}, ${op.targetY.toFixed(2)})`);
        });

        for (const op of ops) {
            console.log(`[NodeLineIntersections] Processing node ${op.nodeId} on edge ${op.edgeId}`);
            GraphGenerator.insertNodeIntoEdge(graph, op.nodeId, op.edgeId, op.targetX, op.targetY);
        }
        return true;
    }

    /** One pass of line-to-line intersections: finds crossing edges and creates intersection nodes. */
    private static runLineLineIntersections(graph: Graph, width: number, useToBorder: boolean = true, skipIntersectionEdges: boolean = true): boolean {
        const ops = Analyser.findEdgeIntersections(graph, width, useToBorder, skipIntersectionEdges);
        if (ops.length === 0) return false;

        ops.forEach((op, i) => {
            console.log(`  Op ${i}: edges ${op.edgeA} x ${op.edgeB} at (${op.targetX.toFixed(2)}, ${op.targetY.toFixed(2)})`);
        });

        // Deduplicate operations
        const seen = new Set<string>();
        const uniqueOps = [];
        for (const op of ops) {
            const key = [op.edgeA, op.edgeB].sort().join('-');
            if (!seen.has(key)) {
                seen.add(key);
                uniqueOps.push(op);
            }
        }

        // Helper: calculate t parameter (0-1 position) for a point on a line segment
        const calculateT = (nodeA: Node, nodeB: Node, x: number, y: number): number => {
            const dx = nodeB.x - nodeA.x;
            const dy = nodeB.y - nodeA.y;
            const lengthSq = dx * dx + dy * dy;
            if (lengthSq === 0) return 0;
            const t = ((x - nodeA.x) * dx + (y - nodeA.y) * dy) / lengthSq;
            return Math.max(0, Math.min(1, t));
        };

        // Group intersections by edge and sort by position along edge
        interface IntersectionOnEdge {
            op: IntersectionOperation;
            otherEdgeId: string;
            t: number;
            x: number;
            y: number;
        }

        const intersectionsByEdge = new Map<string, IntersectionOnEdge[]>();
        const originalEdgeEndpoints = new Map<string, { nodeA: string; nodeB: string }>();

        for (const op of uniqueOps) {
            const edgeA = graph.edges.get(op.edgeA);
            const edgeB = graph.edges.get(op.edgeB);
            if (!edgeA || !edgeB) continue;

            // Store original endpoints before we potentially delete these edges
            if (!originalEdgeEndpoints.has(op.edgeA)) {
                originalEdgeEndpoints.set(op.edgeA, { nodeA: edgeA.a, nodeB: edgeA.b });
            }
            if (!originalEdgeEndpoints.has(op.edgeB)) {
                originalEdgeEndpoints.set(op.edgeB, { nodeA: edgeB.a, nodeB: edgeB.b });
            }

            const nodeAa = graph.nodes.get(edgeA.a);
            const nodeAb = graph.nodes.get(edgeA.b);
            const nodeBa = graph.nodes.get(edgeB.a);
            const nodeBb = graph.nodes.get(edgeB.b);
            if (!nodeAa || !nodeAb || !nodeBa || !nodeBb) continue;

            const tA = calculateT(nodeAa, nodeAb, op.targetX, op.targetY);
            const tB = calculateT(nodeBa, nodeBb, op.targetX, op.targetY);

            if (!intersectionsByEdge.has(op.edgeA)) {
                intersectionsByEdge.set(op.edgeA, []);
            }
            intersectionsByEdge.get(op.edgeA)!.push({
                op, otherEdgeId: op.edgeB, t: tA, x: op.targetX, y: op.targetY
            });

            if (!intersectionsByEdge.has(op.edgeB)) {
                intersectionsByEdge.set(op.edgeB, []);
            }
            intersectionsByEdge.get(op.edgeB)!.push({
                op, otherEdgeId: op.edgeA, t: tB, x: op.targetX, y: op.targetY
            });
        }

        // Sort intersections on each edge by t (position along edge)
        for (const intersections of intersectionsByEdge.values()) {
            intersections.sort((a, b) => a.t - b.t);
        }

        // Sort edges by number of intersections (process busier edges first)
        const sortedEdges = Array.from(intersectionsByEdge.entries())
            .sort((a, b) => b[1].length - a[1].length);

        // Pre-split each edge at all its intersection points in order
        const edgeSegments = new Map<string, string[]>(); // originalEdgeId -> [segment0, segment1, ...]
        const createdIntersectionNodes = new Set<string>();

        for (const [originalEdgeId, intersections] of sortedEdges) {
            const segments: string[] = [];
            let currentEdgeId = originalEdgeId;

            for (const intersection of intersections) {
                const edge = graph.edges.get(currentEdgeId);
                if (!edge) break;

                // Create intersection node ID
                const sortedIds = [intersection.otherEdgeId, currentEdgeId].sort();
                const intersectionNodeId = `I-${sortedIds[0]}-${sortedIds[1]}`;

                // Ensure intersection node exists
                let intersectionNode = graph.nodes.get(intersectionNodeId);
                if (!intersectionNode) {
                    const angleA = graph.nodes.get(edge.a)?.angle ?? 0;
                    const angleB = graph.nodes.get(edge.b)?.angle ?? 0;
                    const otherEdge = graph.edges.get(intersection.otherEdgeId);
                    const angleC = otherEdge ? graph.nodes.get(otherEdge.a)?.angle ?? 0 : 0;
                    const angleD = otherEdge ? graph.nodes.get(otherEdge.b)?.angle ?? 0 : 0;
                    const angle = (angleA + angleB + angleC + angleD) / 4;

                    intersectionNode = graph.addNode({
                        id: intersectionNodeId,
                        angle,
                        meta: {
                            generation: Math.max(edge.meta.generation, otherEdge?.meta.generation ?? 0) + 1,
                            roles: {
                                orientation: 'not-center',
                                ordinality: 'middle',
                                functionalRoles: ['point', 'split'],
                                modRoles: []
                            }
                        }
                    });

                    if (intersectionNode) {
                        intersectionNode.x = intersection.x;
                        intersectionNode.y = intersection.y;
                    }
                    createdIntersectionNodes.add(intersectionNodeId);
                }

                // Split current edge at this intersection point
                const newEdge1Id = `${edge.a}-${intersectionNodeId}`;
                const newEdge2Id = `${intersectionNodeId}-${edge.b}`;

                // Create the two new edges via derivedEdge
                GraphGenerator.derivedEdge(graph, currentEdgeId, intersectionNodeId, intersection.x, intersection.y);

                segments.push(newEdge1Id);
                currentEdgeId = newEdge2Id;
            }

            // Record all segments for this original edge
            if (segments.length > 0) {
                segments.push(currentEdgeId);
                edgeSegments.set(originalEdgeId, segments);
                console.log(`[Pipeline] Pre-split edge ${originalEdgeId} into ${segments.length} segments`);
            }
        }

        // Now create the actual intersection connections between the resolved edges
        const processedIntersections = new Set<string>();

        for (const op of uniqueOps) {
            const key = [op.edgeA, op.edgeB].sort().join('-');
            if (processedIntersections.has(key)) continue;
            processedIntersections.add(key);

            // Get the actual segments these edges resolved to
            let resolvedEdgeA = op.edgeA;
            let resolvedEdgeB = op.edgeB;

            if (edgeSegments.has(op.edgeA)) {
                const segments = edgeSegments.get(op.edgeA)!;
                // Find which segment contains this intersection point
                const endpoints = originalEdgeEndpoints.get(op.edgeA);
                if (endpoints) {
                    const nodeAa = graph.nodes.get(endpoints.nodeA);
                    const nodeAb = graph.nodes.get(endpoints.nodeB);
                    if (nodeAa && nodeAb) {
                        const tA = calculateT(nodeAa, nodeAb, op.targetX, op.targetY);
                        resolvedEdgeA = this.findSegmentAtT(graph, segments, tA);
                    }
                }
            }

            if (edgeSegments.has(op.edgeB)) {
                const segments = edgeSegments.get(op.edgeB)!;
                const endpoints = originalEdgeEndpoints.get(op.edgeB);
                if (endpoints) {
                    const nodeBa = graph.nodes.get(endpoints.nodeA);
                    const nodeBb = graph.nodes.get(endpoints.nodeB);
                    if (nodeBa && nodeBb) {
                        const tB = calculateT(nodeBa, nodeBb, op.targetX, op.targetY);
                        resolvedEdgeB = this.findSegmentAtT(graph, segments, tB);
                    }
                }
            }

            const edgeAObj = graph.edges.get(resolvedEdgeA);
            const edgeBObj = graph.edges.get(resolvedEdgeB);

            if (!edgeAObj || !edgeBObj) continue;

            // Create the intersection connection
            const sortedIds = [resolvedEdgeA, resolvedEdgeB].sort();
            const intersectionNodeId = `I-${sortedIds[0]}-${sortedIds[1]}`;
            const intersectionNode = graph.nodes.get(intersectionNodeId);

            if (intersectionNode) {
                // Link twin nodes if applicable
                const layoutWidth = 734;
                const symmetricX = layoutWidth - intersectionNode.x;
                const twinIntersection = Array.from(graph.nodes.values()).find(n =>
                    n.id.startsWith('I-') &&
                    Math.abs(n.x - symmetricX) < 1 &&
                    Math.abs(n.y - intersectionNode.y) < 1 &&
                    n.id !== intersectionNodeId
                );

                if (twinIntersection && !intersectionNode.twinId) {
                    intersectionNode.twinId = twinIntersection.id;
                    twinIntersection.twinId = intersectionNodeId;
                }

                console.log(`[Intersections] Linked intersection node ${intersectionNodeId} for edges ${resolvedEdgeA} x ${resolvedEdgeB}`);
            }
        }

        return true;
    }

    /** Helper: find which segment a point (at parameter t) falls within */
    private static findSegmentAtT(graph: Graph, segments: string[], t: number): string {
        // t ranges from 0 to 1 across the original edge
        // segments were created in order, so we interpolate which one to use
        // Simplified: if we have N intersections creating N+1 segments,
        // and segment t values are at [0, t1], [t1, t2], ..., [tN, 1]
        // Since we don't know the exact t values of previous splits, use the first segment that exists
        for (const segment of segments) {
            if (graph.edges.has(segment)) {
                return segment;
            }
        }
        return segments[0]; // Fallback to first segment
    }

    /** One pass of border-joint → nearest interior node connections. */
    private static runBorderConnections(graph: Graph, width: number): boolean {
        const ops = Analyser.findBorderConnections(graph, width);
        if (ops.length === 0) return false;

        // Identify which border-joints are getting new connections
        const jointTargets = new Map<string, string[]>();
        for (const op of ops) {
            if (!jointTargets.has(op.sourceId)) {
                jointTargets.set(op.sourceId, []);
            }
            jointTargets.get(op.sourceId)!.push(op.targetId);
        }

        // Remove old connections to farther nodes before adding new ones
        for (const [jointId, targetIds] of jointTargets.entries()) {
            const edgesToRemove: string[] = [];
            for (const edge of graph.edges.values()) {
                if (edge.a === jointId && !targetIds.includes(edge.b)) {
                    const targetNode = graph.nodes.get(edge.b);
                    if (targetNode && !targetNode.meta.roles.functionalRoles.some(r => r.includes('border')) &&
                        !targetNode.meta.roles.functionalRoles.includes('terminal')) {
                        edgesToRemove.push(edge.id);
                        console.log(`[BorderConn] Removing old connection from ${jointId} to ${edge.b}`);
                    }
                } else if (edge.b === jointId && !targetIds.includes(edge.a)) {
                    const targetNode = graph.nodes.get(edge.a);
                    if (targetNode && !targetNode.meta.roles.functionalRoles.some(r => r.includes('border')) &&
                        !targetNode.meta.roles.functionalRoles.includes('terminal')) {
                        edgesToRemove.push(edge.id);
                        console.log(`[BorderConn] Removing old connection from ${jointId} to ${edge.a}`);
                    }
                }
            }
            for (const edgeId of edgesToRemove) {
                graph.edges.delete(edgeId);
            }
        }

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

    /** Run a single relax pass, check for new intersections, and resolve them. */
    static runRelaxPassWithIntersectionCheck(graph: Graph, width: number): void {
        const maxIterations = 10;
        const useToBorder = true;
        for (let i = 0; i < maxIterations; i++) {
            Pipeline.runRelax(graph, 30);
            if (Pipeline.runLineLineIntersections(graph, width, useToBorder)) {
                // if we made any intersections, merge and relax again
                Pipeline.runMerges(graph, width);
                continue;
            }
            break; // no new intersections found, exit loop
        }
    }

    /** Run relaxation to adjust node positions using spring forces. */
    static runRelax(graph: Graph, iterations: number = 10): void {
        Relaxer.relax(graph, iterations);
    }

    /** Runs a full analysis pass on the graph, returning the final graph and snapshots of node positions before and after mutations. */

    static runFullAnalysis(graph: Graph, width: number): AnalysisResult {
        const currentGraph = graph.clone();
        const snapshot0 = captureSnapshot(currentGraph);
        const maxIterations = 100;
        Analyser.findTwins(currentGraph, width); // mark twins before running further operations, so that all future transformations remain symmetrical

        for (let i = 0; i < maxIterations; i++) {
            console.log(`Iteration ${i}`);
            if (Pipeline.runLineLineIntersections(currentGraph, width)) continue; // if we made any intersections, we need to re-run merges and intersections
            if (Pipeline.runNodeLineIntersections(currentGraph, width)) continue; // snap nodes to edges
            if (Pipeline.runMerges(currentGraph, width)) continue; // later make dynamic based on count of mergeRuns

            // Geometry is stable — wire border connections, then re-merge
            // if (Pipeline.runBorderConnections(currentGraph, width)) {
            //     // Border connections might create new edge crossings, check for them
            //     if (Pipeline.runLineLineIntersections(currentGraph, width)) {
            //         Pipeline.runMerges(currentGraph, width);
            //         continue;
            //     }
            //     Pipeline.runRelax(currentGraph, 5);
            //     continue;
            // }

            // Nothing left to do
            break;
        }

        for (let i = 0; i < maxIterations; i++) {
            if (Pipeline.runLineLineIntersections(currentGraph, width)) continue; // if we made any intersections, we need to re-run merges and intersections
            if (Pipeline.runNodeLineIntersections(currentGraph, width)) continue; // snap nodes to edges
        }

        const snapshot1 = captureSnapshot(currentGraph);


        // Pipeline.runHoleCreation(currentGraph);

        // Capture snapshot2 as starting positions for relaxation
        const snapshot2 = captureSnapshot(currentGraph);

        /**
         *  iteratively relax the graph, and check for any new point line intersections.  
         * if found, run merges and intersections again, then relax again, until no new intersections are found or max iterations reached
        */
        const useToBorder = true; // whether to consider border nodes as anchors during relaxation

        for (let i = 0; i < maxIterations; i++) {
            Pipeline.runRelax(currentGraph, 0);
            if (Pipeline.runLineLineIntersections(currentGraph, width, useToBorder) || Pipeline.runNodeLineIntersections(currentGraph, width)) {
                // if we made any intersections, we need to re-run merges and intersections
                Pipeline.runMerges(currentGraph, width);
                continue;
            }
            break; // no new intersections found, exit loop
        }


        const snapshot3 = captureSnapshot(currentGraph);


        // now look at average edge length. compare it to each non-border edge, and if any edge is longer than 1.3x the average, split it in half by creating a new node at the midpoint
        // const avgEdgeLength = Relaxer.calculateAverageEdgeLength(currentGraph);
        // const edgesToSplit: { edgeId: string; targetX: number; targetY: number }[] = [];
        // const ratio: number = 1.35; // edges longer than this ratio of the average will be split
        // for (const edge of currentGraph.edges.values()) {
        //     const nodeA = currentGraph.nodes.get(edge.a);
        //     const nodeB = currentGraph.nodes.get(edge.b);
        //     if (!nodeA || !nodeB) continue;
        //     if (nodeA.meta.roles.functionalRoles.includes('border') || nodeA.meta.roles.functionalRoles.includes('border-joint') ||
        //         nodeB.meta.roles.functionalRoles.includes('border') || nodeB.meta.roles.functionalRoles.includes('border-joint')) continue;

        //     const dx = nodeA.x - nodeB.x;
        //     const dy = nodeA.y - nodeB.y;
        //     const length = Math.sqrt(dx * dx + dy * dy);
        //     if (length > ratio * avgEdgeLength) {
        //         edgesToSplit.push({
        //             edgeId: edge.id,
        //             targetX: (nodeA.x + nodeB.x) / 2,
        //             targetY: (nodeA.y + nodeB.y) / 2
        //         });
        //     }
        // }

        // for (const split of edgesToSplit) {
        //     GraphGenerator.splitEdge(currentGraph, split.edgeId, split.targetX, split.targetY);
        // }


        const snapshot4 = captureSnapshot(currentGraph);

        return { graph: currentGraph, snapshots: [snapshot0, snapshot1, snapshot2, snapshot3, snapshot4] };
    }
} 