import { Graph, NodeId } from '../graph/Graph';
import { DEFAULT_FORCE_PROVIDERS, type ForceProvider, type ForceToolkitSettings, type SpringSettings, type WeightedTarget } from './forces';

export type { SpringSettings, MinDistForceSettings, ForceToolkitSettings } from './forces';

export class Relaxer {
    private static readonly FORCE_PROVIDERS: ForceProvider[] = DEFAULT_FORCE_PROVIDERS;

    private static readonly DEFAULT_SPRINGS: SpringSettings = {
        stiffness: 0.5,
        minLength: 5,
        maxLength: 100,
        grow: 1.2, // can be + or -
        targetLength: 0 // 0 means bias toward shorter than average
    };

    private static readonly DEFAULT_FORCE_TOOLKIT: ForceToolkitSettings = {
        increment: 0.08,
        edgeTargetWeight: 1,
        minDistForce: {
            enabled: true,
            minDist: 24,
            weight: 1,
            excludeBorder: true,
            excludeTerminal: true,
        },
        squareLensingForce: {
            enabled: true,
            roundness: 1,
            weight: 0.9,
            maxRadialScale: 1.35,
            includeAnchors: true,
            excludeBorder: false,
            excludeTerminal: false,
            debug: true,
        },
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
     * Force-toolkit relaxer with incremental retargeting.
     * Forces produce weighted target positions, then each node moves toward its blended target each increment.
     */
    static relaxWithForces(
        graph: Graph,
        iterations: number = 50,
        springs: SpringSettings = {},
        toolkit: ForceToolkitSettings = {},
        useBorder: boolean = false
    ): void {
        const springSettings = { ...this.DEFAULT_SPRINGS, ...springs };
        const minDistDefaults = this.DEFAULT_FORCE_TOOLKIT.minDistForce ?? {};
        const minDistForce = {
            ...minDistDefaults,
            ...(toolkit.minDistForce ?? {}),
        };
        const squareLensingDefaults = this.DEFAULT_FORCE_TOOLKIT.squareLensingForce ?? {};
        const squareLensingForce = {
            ...squareLensingDefaults,
            ...(toolkit.squareLensingForce ?? {}),
        };
        const forceSettings: ForceToolkitSettings = {
            ...this.DEFAULT_FORCE_TOOLKIT,
            ...toolkit,
            minDistForce,
            squareLensingForce,
        };

        const anchorIds = this.getAnchorIds(graph, useBorder);
        const lockedNodeIds = this.getLockedNodeIds(graph);
        const avgLength = springSettings.targetLength! > 0
            ? springSettings.targetLength!
            : this.calculateAverageEdgeLength(graph) * (springSettings.grow ?? 1);

        const addTarget = (
            targets: Map<NodeId, WeightedTarget>,
            nodeId: NodeId,
            x: number,
            y: number,
            weight: number
        ): void => {
            if (weight <= 0) return;
            const current = targets.get(nodeId);
            if (!current) {
                targets.set(nodeId, { x: x * weight, y: y * weight, w: weight });
                return;
            }
            current.x += x * weight;
            current.y += y * weight;
            current.w += weight;
        };

        for (let iter = 0; iter < iterations; iter++) {
            const targets = new Map<NodeId, WeightedTarget>();

            for (const node of graph.nodes.values()) {
                // Initialize targets for all nodes to 0 
                targets.set(node.id, { x: 0, y: 0, w: 0 });
            }

            const forceContext = {
                graph,
                anchorIds,
                lockedNodeIds,
                avgLength,
                springSettings,
                forceSettings,
            };

            // Execute enabled force providers and aggregate all target proposals.
            for (const provider of this.FORCE_PROVIDERS) {
                if (!provider.isEnabled(forceContext)) continue;
                const forceTargets = provider.getTargets(forceContext);
                if (iter === 0 && forceSettings.squareLensingForce?.debug) {
                    // console.log(`[Relaxer] provider=${provider.key} targets=${forceTargets.length}`);
                }
                for (const target of forceTargets) {
                    addTarget(targets, target.nodeId, target.x, target.y, target.weight);
                }
            }

            if (iter === 0 && forceSettings.squareLensingForce?.debug) {
                // console.log(
                //     `[Relaxer] mode=forces increment=${forceSettings.increment ?? 0.08} useBorder=${useBorder} ` +
                //     `squareLensing=${JSON.stringify(forceSettings.squareLensingForce)}`
                // );
            }

            // Apply weighted targets incrementally, then retarget next iteration.
            const increment = forceSettings.increment ?? 0.08;
            const allowAnchorMove = Boolean(
                forceSettings.squareLensingForce?.enabled && forceSettings.squareLensingForce?.includeAnchors
            );
            for (const node of graph.nodes.values()) {
                if (lockedNodeIds.has(node.id)) continue;
                if (anchorIds.has(node.id) && !allowAnchorMove) continue;
                const target = targets.get(node.id);
                if (!target || target.w <= 0) continue;

                const tx = target.x / target.w;
                const ty = target.y / target.w;
                node.x += (tx - node.x) * increment;
                node.y += (ty - node.y) * increment;
            }
        }
    }

    private static getAnchorIds(graph: Graph, useBorder: boolean): Set<NodeId> {
        const anchorIds = new Set<NodeId>();
        for (const node of graph.nodes.values()) {
            if (node.meta.layoutLocked) {
                anchorIds.add(node.id);
                continue;
            }
            const isTerminal = node.meta.roles.functionalRoles.some(r => r === 'terminal');
            const isBorder = !useBorder && node.meta.roles.functionalRoles.some(r =>
                r === 'border' || r === 'border-joint'
            );
            if (isTerminal || isBorder) {
                anchorIds.add(node.id);
            }
        }
        return anchorIds;
    }

    private static getLockedNodeIds(graph: Graph): Set<NodeId> {
        const lockedNodeIds = new Set<NodeId>();
        for (const node of graph.nodes.values()) {
            if (node.meta.layoutLocked || node.id.startsWith('SN-')) {
                lockedNodeIds.add(node.id);
            }
        }
        return lockedNodeIds;
    }
}
