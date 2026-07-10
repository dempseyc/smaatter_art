import Graphology from 'graphology';
import type { Graph } from '../graph/Graph';

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
        const width = this.options.width ?? 760;
        const height = this.options.height ?? 520;
        const centerX = this.options.centerX ?? width / 2;
        const centerY = this.options.centerY ?? height / 2;
        const graphologyGraph = new Graphology();

        Array.from(graph.nodes.keys()).forEach((nodeId) => {
            const node = graph.nodes.get(nodeId);
            graphologyGraph.addNode(nodeId, {
                x: node?.x ?? centerX,
                y: node?.y ?? centerY,
            });
        });

        Array.from(graph.edges.values()).forEach((edge) => {
            if (graphologyGraph.hasNode(edge.a) && graphologyGraph.hasNode(edge.b) && !graphologyGraph.hasEdge(edge.a, edge.b)) {
                graphologyGraph.addEdge(edge.a, edge.b);
            }
        });

        switch (this.algorithm) {
            case 'circular':
                this.runCircular(graphologyGraph, width, height, centerX, centerY);
                break;
            case 'random':
                this.runRandom(graphologyGraph, width, height, centerX, centerY);
                break;
            case 'grid':
                this.runGrid(graphologyGraph, width, height, centerX, centerY);
                break;
            case 'concentric':
                this.runConcentric(graphologyGraph, width, height, centerX, centerY);
                break;
            case 'breadthFirst':
                this.runBreadthFirst(graphologyGraph, width, height, centerX, centerY);
                break;
            case 'kamadaKawai':
                this.runKamadaKawai(graphologyGraph, width, height, centerX, centerY);
                break;
            case 'smatter':
                this.runSmatter(graphologyGraph, width, height, centerX, centerY);
                break;
            case 'force':
            case 'fruchtermanReingold':
            default:
                this.runForce(graphologyGraph, width, height, centerX, centerY);
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

    private runSmatter(graphologyGraph: Graphology, width: number, height: number, centerX: number, centerY: number): void {
        const nodes = graphologyGraph.nodes();
        if (nodes.length === 0) {
            return;
        }

        const radius = Math.min(width, height) * 0.28;
        const angleIncrement = (Math.PI * 2) / nodes.length;

        nodes.forEach((nodeId, index) => {
            const angle = index * angleIncrement;
            const distance = radius * (0.5 + Math.random() * 0.5);
            graphologyGraph.setNodeAttribute(nodeId, 'x', centerX + Math.cos(angle) * distance);
            graphologyGraph.setNodeAttribute(nodeId, 'y', centerY + Math.sin(angle) * distance);
        });
    }

    private runForce(graphologyGraph: Graphology, width: number, height: number, centerX: number, centerY: number): void {
        const nodes = graphologyGraph.nodes();
        if (nodes.length === 0) {
            return;
        }

        const positions = new Map<string, { x: number; y: number }>();
        const radius = Math.min(width, height) * 0.28;
        const iterations = this.options.iterations ?? 120;

        nodes.forEach((nodeId, index) => {
            const angle = (index / Math.max(1, nodes.length)) * Math.PI * 2;
            positions.set(nodeId, {
                x: centerX + Math.cos(angle) * radius,
                y: centerY + Math.sin(angle) * radius,
            });
        });

        const k = Math.sqrt((width * height) / Math.max(1, nodes.length)) * 0.7;

        for (let iteration = 0; iteration < iterations; iteration += 1) {
            const displacements = new Map<string, { x: number; y: number }>(nodes.map((nodeId) => [nodeId, { x: 0, y: 0 }]));

            nodes.forEach((nodeId) => {
                const current = positions.get(nodeId);
                if (!current) {
                    return;
                }

                nodes.forEach((otherId) => {
                    if (otherId === nodeId) {
                        return;
                    }

                    const other = positions.get(otherId);
                    if (!other) {
                        return;
                    }

                    const dx = current.x - other.x;
                    const dy = current.y - other.y;
                    const distance = Math.hypot(dx, dy) || 0.0001;
                    const force = (k * k) / Math.max(24, distance);
                    const displacement = displacements.get(nodeId);
                    if (!displacement) {
                        return;
                    }

                    displacement.x += (dx / distance) * force * 0.4;
                    displacement.y += (dy / distance) * force * 0.4;
                });
            });

            graphologyGraph.forEachEdge((_, __, source, target) => {
                const sourcePosition = positions.get(source);
                const targetPosition = positions.get(target);
                if (!sourcePosition || !targetPosition) {
                    return;
                }

                const dx = targetPosition.x - sourcePosition.x;
                const dy = targetPosition.y - sourcePosition.y;
                const distance = Math.hypot(dx, dy) || 0.0001;
                const force = (distance * distance) / (k * 2.2);
                const displacementSource = displacements.get(source);
                const displacementTarget = displacements.get(target);

                if (displacementSource) {
                    displacementSource.x += (dx / distance) * force * 0.35;
                    displacementSource.y += (dy / distance) * force * 0.35;
                }
                if (displacementTarget) {
                    displacementTarget.x -= (dx / distance) * force * 0.35;
                    displacementTarget.y -= (dy / distance) * force * 0.35;
                }
            });

            nodes.forEach((nodeId) => {
                const current = positions.get(nodeId);
                const displacement = displacements.get(nodeId);
                if (!current || !displacement) {
                    return;
                }

                current.x += displacement.x * 0.05;
                current.y += displacement.y * 0.05;
                current.x += (centerX - current.x) * 0.01;
                current.y += (centerY - current.y) * 0.01;
            });
        }

        nodes.forEach((nodeId) => {
            const position = positions.get(nodeId);
            if (!position) {
                return;
            }
            graphologyGraph.setNodeAttribute(nodeId, 'x', position.x);
            graphologyGraph.setNodeAttribute(nodeId, 'y', position.y);
        });
    }

    private runCircular(graphologyGraph: Graphology, width: number, height: number, centerX: number, centerY: number): void {
        const nodes = graphologyGraph.nodes();
        if (nodes.length === 0) {
            return;
        }

        const radius = Math.min(width, height) * 0.3;
        nodes.forEach((nodeId, index) => {
            const angle = (index / Math.max(1, nodes.length)) * Math.PI * 2;
            graphologyGraph.setNodeAttribute(nodeId, 'x', centerX + Math.cos(angle) * radius);
            graphologyGraph.setNodeAttribute(nodeId, 'y', centerY + Math.sin(angle) * radius);
        });
    }

    private runRandom(graphologyGraph: Graphology, width: number, height: number, centerX: number, centerY: number): void {
        const nodes = graphologyGraph.nodes();
        const radius = Math.min(width, height) * 0.3;

        nodes.forEach((nodeId) => {
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * radius;
            graphologyGraph.setNodeAttribute(nodeId, 'x', centerX + Math.cos(angle) * distance);
            graphologyGraph.setNodeAttribute(nodeId, 'y', centerY + Math.sin(angle) * distance);
        });
    }

    private runGrid(graphologyGraph: Graphology, width: number, height: number, centerX: number, centerY: number): void {
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

    private runConcentric(graphologyGraph: Graphology, width: number, height: number, centerX: number, centerY: number): void {
        const nodes = graphologyGraph.nodes();
        if (nodes.length === 0) {
            return;
        }

        const layers = new Map<string, number>();
        const visited = new Set<string>();
        const queue: Array<{ id: string; depth: number }> = [{ id: nodes[0], depth: 0 }];
        visited.add(nodes[0]);

        while (queue.length > 0) {
            const current = queue.shift();
            if (!current) {
                continue;
            }
            layers.set(current.id, current.depth);
            graphologyGraph.neighbors(current.id).forEach((neighbor) => {
                if (!visited.has(neighbor)) {
                    visited.add(neighbor);
                    queue.push({ id: neighbor, depth: current.depth + 1 });
                }
            });
        }

        const radiusBase = Math.min(width, height) * 0.28;

        nodes.forEach((nodeId, index) => {
            const depth = layers.get(nodeId) ?? 0;
            const radius = radiusBase * (0.8 + depth * 0.25);
            const angle = (index / Math.max(1, nodes.length)) * Math.PI * 2;
            graphologyGraph.setNodeAttribute(nodeId, 'x', centerX + Math.cos(angle) * radius);
            graphologyGraph.setNodeAttribute(nodeId, 'y', centerY + Math.sin(angle) * radius);
        });
    }

    private runBreadthFirst(graphologyGraph: Graphology, width: number, height: number, centerX: number, centerY: number): void {
        const nodes = graphologyGraph.nodes();
        if (nodes.length === 0) {
            return;
        }

        const levels = new Map<string, number>();
        const visited = new Set<string>();
        const queue: Array<{ id: string; level: number }> = [{ id: nodes[0], level: 0 }];
        visited.add(nodes[0]);

        while (queue.length > 0) {
            const current = queue.shift();
            if (!current) {
                continue;
            }
            levels.set(current.id, current.level);
            graphologyGraph.neighbors(current.id).forEach((neighbor) => {
                if (!visited.has(neighbor)) {
                    visited.add(neighbor);
                    queue.push({ id: neighbor, level: current.level + 1 });
                }
            });
        }

        const maxLevel = Math.max(...Array.from(levels.values()), 0);
        const spacing = Math.min(width, height) / Math.max(2, maxLevel + 2);

        nodes.forEach((nodeId) => {
            const level = levels.get(nodeId) ?? 0;
            const index = Array.from(levels.entries()).filter(([, value]) => value === level).findIndex(([id]) => id === nodeId);
            const column = level;
            const row = index;
            graphologyGraph.setNodeAttribute(nodeId, 'x', centerX + (column - maxLevel / 2) * spacing);
            graphologyGraph.setNodeAttribute(nodeId, 'y', centerY + (row - 2) * spacing * 0.85);
        });
    }

    private runKamadaKawai(graphologyGraph: Graphology, width: number, height: number, centerX: number, centerY: number): void {
        const nodes = graphologyGraph.nodes();
        if (nodes.length <= 1) {
            return;
        }

        const positions = new Map<string, { x: number; y: number }>();
        const nodeCount = nodes.length;
        const radius = Math.min(width, height) * 0.28;

        nodes.forEach((nodeId, index) => {
            const angle = (index / nodeCount) * Math.PI * 2;
            positions.set(nodeId, {
                x: centerX + Math.cos(angle) * radius,
                y: centerY + Math.sin(angle) * radius,
            });
        });

        const shortestPaths = this.computeShortestPaths(graphologyGraph);
        const targetScale = Math.max(40, radius / Math.max(2, Math.sqrt(nodeCount)));
        const iterations = this.options.iterations ?? 90;

        for (let iteration = 0; iteration < iterations; iteration += 1) {
            let moved = false;

            nodes.forEach((nodeId) => {
                const current = positions.get(nodeId);
                if (!current) {
                    return;
                }

                let deltaX = 0;
                let deltaY = 0;

                nodes.forEach((otherId) => {
                    if (otherId === nodeId) {
                        return;
                    }

                    const other = positions.get(otherId);
                    if (!other) {
                        return;
                    }

                    const dx = other.x - current.x;
                    const dy = other.y - current.y;
                    const distance = Math.hypot(dx, dy) || 0.001;
                    const pathLength = shortestPaths.get(nodeId)?.get(otherId) ?? 1;
                    const idealDistance = Math.max(28, targetScale * pathLength);
                    const diff = distance - idealDistance;
                    const step = diff * 0.012;
                    const directionX = dx / distance;
                    const directionY = dy / distance;

                    deltaX += directionX * step;
                    deltaY += directionY * step;
                });

                const pullX = (centerX - current.x) * 0.008;
                const pullY = (centerY - current.y) * 0.008;
                const nextX = current.x + deltaX + pullX;
                const nextY = current.y + deltaY + pullY;

                current.x = Math.max(24, Math.min(width - 24, nextX));
                current.y = Math.max(24, Math.min(height - 24, nextY));

                if (Math.abs(nextX - current.x) > 0.001 || Math.abs(nextY - current.y) > 0.001) {
                    moved = true;
                }
            });

            if (!moved) {
                break;
            }
        }

        nodes.forEach((nodeId) => {
            const position = positions.get(nodeId);
            if (!position) {
                return;
            }
            graphologyGraph.setNodeAttribute(nodeId, 'x', position.x);
            graphologyGraph.setNodeAttribute(nodeId, 'y', position.y);
        });
    }

    private computeShortestPaths(graphologyGraph: Graphology): Map<string, Map<string, number>> {
        const nodes = graphologyGraph.nodes();
        const distances = new Map<string, Map<string, number>>();

        nodes.forEach((nodeId) => {
            const visited = new Set<string>();
            const queue: Array<{ id: string; distance: number }> = [{ id: nodeId, distance: 0 }];
            const results = new Map<string, number>();
            visited.add(nodeId);
            results.set(nodeId, 0);

            while (queue.length > 0) {
                const current = queue.shift();
                if (!current) {
                    continue;
                }
                graphologyGraph.neighbors(current.id).forEach((neighbor) => {
                    if (visited.has(neighbor)) {
                        return;
                    }
                    visited.add(neighbor);
                    const nextDistance = current.distance + 1;
                    results.set(neighbor, nextDistance);
                    queue.push({ id: neighbor, distance: nextDistance });
                });
            }

            distances.set(nodeId, results);
        });

        return distances;
    }

    private normalizeCoordinate(value: number | undefined, fallback: number, span: number): number {
        if (typeof value !== 'number' || Number.isNaN(value)) {
            return fallback;
        }

        return Math.min(span - 24, Math.max(24, value));
    }
}
