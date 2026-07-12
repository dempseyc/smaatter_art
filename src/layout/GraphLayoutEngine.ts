import Graphology from 'graphology';
import type { Graph } from '../graph/Graph';
import { runBreadthFirst } from './algorithms/breadthFirst';
import { runCircular } from './algorithms/circular';
import { runConcentric } from './algorithms/concentric';
import { runForce } from './algorithms/force';
import { runGrid } from './algorithms/grid';
import { runKamadaKawai } from './algorithms/kamadaKawai';
import { runRandom } from './algorithms/random';
import { runSmatter } from './algorithms/smatter';

export interface LayoutEngine {
    name: string;
    apply(graph: Graph): void;
}

export type LayoutAlgorithm = 'force' | 'fruchtermanReingold' | 'kamadaKawai' | 'circular' | 'random' | 'grid' | 'concentric' | 'breadthFirst' | 'smatter';

export interface LayoutOptions {
    width?: number;
    height?: number;
    centerX?: number;
    centerY?: number;
    iterations?: number;
}

export class GraphLayoutEngine implements LayoutEngine {
    name: string;

    constructor(private readonly algorithm: LayoutAlgorithm = 'fruchtermanReingold', private readonly options: LayoutOptions = {}) {
        this.name = this.algorithm;
    }

    apply(graph: Graph): void {
        const width = this.options.width ?? 734;
        const height = this.options.height ?? 734;
        const centerX = this.options.centerX ?? width / 2;
        const centerY = this.options.centerY ?? height / 2;
        const graphologyGraph = new Graphology();

        Array.from(graph.nodes.keys()).forEach((nodeId) => {
            const node = graph.nodes.get(nodeId);
            graphologyGraph.addNode(nodeId, {
                x: node?.x ?? centerX,
                y: node?.y ?? centerY,
                angle: node?.angle ?? 0,
                generation: node?.meta.generation ?? 0,
            });
        });

        Array.from(graph.edges.values()).forEach((edge) => {
            if (graphologyGraph.hasNode(edge.a) && graphologyGraph.hasNode(edge.b) && !graphologyGraph.hasEdge(edge.a, edge.b)) {
                graphologyGraph.addEdge(edge.a, edge.b);
            }
        });

        switch (this.algorithm) {
            case 'circular':
                runCircular(graphologyGraph, width, height, centerX, centerY);
                break;
            case 'random':
                runRandom(graphologyGraph, width, height, centerX, centerY);
                break;
            case 'grid':
                runGrid(graphologyGraph, width, height, centerX, centerY);
                break;
            case 'concentric':
                runConcentric(graphologyGraph, width, height, centerX, centerY);
                break;
            case 'breadthFirst':
                runBreadthFirst(graphologyGraph, width, height, centerX, centerY);
                break;
            case 'kamadaKawai':
                runKamadaKawai(graphologyGraph, width, height, centerX, centerY, this.options.iterations);
                break;
            case 'smatter':
                runSmatter(graphologyGraph, width, height, centerX, centerY);
                break;
            case 'force':
            case 'fruchtermanReingold':
            default:
                runForce(graphologyGraph, width, height, centerX, centerY, this.options.iterations);
                break;
        }

        graphologyGraph.forEachNode((nodeId, attributes) => {
            const node = graph.nodes.get(nodeId);
            if (!node) {
                return;
            }

            node.x = this.normalizeCoordinate(attributes.x as number | undefined, centerX, width);
            node.y = this.normalizeCoordinate(attributes.y as number | undefined, centerY, height);
        });
    }

    private normalizeCoordinate(value: number | undefined, fallback: number, span: number): number {
        if (typeof value !== 'number' || Number.isNaN(value)) {
            return fallback;
        }

        return Math.min(span - 24, Math.max(24, value));
    }
}
