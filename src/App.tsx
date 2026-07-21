import { useMemo, useRef, useState } from 'react';
import { Graph } from './graph/Graph';
import { GraphLayoutEngine } from './layout/GraphLayoutEngine';
import { SvgRenderer } from './render/SvgRenderer';
import { Toolbar } from './components/Toolbar';
import { Inspector } from './components/Inspector';
import { Pipeline } from './pipeline/Pipeline';
import { captureSnapshot } from './graph/GraphSnapshot';
import type { GraphSnapshot } from './graph/GraphSnapshot';
import { Animator } from './animation/Animator';

export type LayoutMode = 'force' | 'circle' | 'grid' | 'breadthfirst' | 'concentric' | 'random' | 'kamada' | 'smatter';

function App() {
    const [graph, setGraph] = useState<Graph>(() => new Graph());
    const [layoutMode, setLayoutMode] = useState<LayoutMode>("smatter");
    const [positionedGraph, setPositionedGraph] = useState<Graph>(() => new Graph());
    const [_snapshotBefore, setSnapshotBefore] = useState<GraphSnapshot | null>(null);
    const [_snapshotAfter, setSnapshotAfter] = useState<GraphSnapshot | null>(null);
    const [displayGraph, setDisplayGraph] = useState<Graph>(() => new Graph());

    // Animator instance
    const animator = useRef(new Animator());

    // Set up animator callback to update display
    useMemo(() => {
        animator.current.setFrameCallback((snapshot: GraphSnapshot) => {
            // Create a clone of positionedGraph with snapshot positions applied
            const displayClone = positionedGraph.clone();
            snapshot.nodes.forEach((nodeSnapshot) => {
                const node = displayClone.nodes.get(nodeSnapshot.id);
                if (node) {
                    node.x = nodeSnapshot.x;
                    node.y = nodeSnapshot.y;
                    node.angle = nodeSnapshot.angle;
                }
            });
            setDisplayGraph(displayClone);
        });
    }, [positionedGraph]);


    const layout = useMemo(() => {
        const algorithm = layoutMode === 'circle'
            ? 'circular'
            : layoutMode === 'grid'
                ? 'grid'
                : layoutMode === 'breadthfirst'
                    ? 'breadthFirst'
                    : layoutMode === 'concentric'
                        ? 'concentric'
                        : layoutMode === 'random'
                            ? 'random'
                            : layoutMode === 'kamada'
                                ? 'kamadaKawai'
                                : layoutMode === 'smatter'
                                    ? 'smatter'
                                    : 'fruchtermanReingold';

        return new GraphLayoutEngine(algorithm, { width: 734, height: 734 });
    }, [layoutMode]);


    const runAnalysisPass = () => {
        const result = Pipeline.runFullAnalysis(graph, 734, { mode: "forces", toolkit: { increment: 0.08, minDistForce: { enabled: true, minDist: 9, weight: 1 } } });
        setSnapshotBefore(result.snapshots[0]);
        setSnapshotAfter(result.snapshots[2]);
        setGraph(result.graph);
        const newPositionedGraph = result.graph.clone();
        setPositionedGraph(newPositionedGraph);

        // Apply first snapshot directly, then queue remaining for animation
        const firstSnapshot = result.snapshots[0];
        const displayClone = newPositionedGraph.clone();
        firstSnapshot.nodes.forEach((nodeSnapshot) => {
            const node = displayClone.nodes.get(nodeSnapshot.id);
            if (node) {
                node.x = nodeSnapshot.x;
                node.y = nodeSnapshot.y;
                node.angle = nodeSnapshot.angle;
            }
        });
        setDisplayGraph(displayClone);
        animator.current.queueSnapshots(result.snapshots.slice(1));
    };

    useMemo(() => {
        const fullGraph = Pipeline.generateInitialGraph(layout);
        setGraph(fullGraph);
        const newPositionedGraph = fullGraph.clone();
        setPositionedGraph(newPositionedGraph);

        // Apply first snapshot directly, then queue to animator
        const snapshot0 = captureSnapshot(fullGraph);
        const displayClone = newPositionedGraph.clone();
        snapshot0.nodes.forEach((nodeSnapshot) => {
            const node = displayClone.nodes.get(nodeSnapshot.id);
            if (node) {
                node.x = nodeSnapshot.x;
                node.y = nodeSnapshot.y;
                node.angle = nodeSnapshot.angle;
            }
        });
        setDisplayGraph(displayClone);
        animator.current.queueSnapshots([snapshot0]);
    }, [layout]);

    const randomize = () => {
        const newGraph = Pipeline.generateInitialGraph(layout);
        setGraph(newGraph);
        const newPositionedGraph = newGraph.clone();
        setPositionedGraph(newPositionedGraph);

        // Apply first snapshot directly, then queue to animator
        const snapshot0 = captureSnapshot(newGraph);
        const displayClone = newPositionedGraph.clone();
        snapshot0.nodes.forEach((nodeSnapshot) => {
            const node = displayClone.nodes.get(nodeSnapshot.id);
            if (node) {
                node.x = nodeSnapshot.x;
                node.y = nodeSnapshot.y;
                node.angle = nodeSnapshot.angle;
            }
        });
        setDisplayGraph(displayClone);
        animator.current.queueSnapshots([]);
    };

    const rerunLayout = () => {
        setGraph((current) => current.clone());
        runAnalysisPass();
    };

    const runRelaxPass = () => {
        const graphToRelax = positionedGraph.clone();
        Pipeline.runRelaxPassWithIntersectionCheck(graphToRelax, 734);

        const snapshot = captureSnapshot(graphToRelax);
        setSnapshotAfter(snapshot);
        setPositionedGraph(graphToRelax);

        // Update displayGraph immediately to show the result
        const displayClone = graphToRelax.clone();
        snapshot.nodes.forEach((nodeSnapshot) => {
            const node = displayClone.nodes.get(nodeSnapshot.id);
            if (node) {
                node.x = nodeSnapshot.x;
                node.y = nodeSnapshot.y;
                node.angle = nodeSnapshot.angle;
            }
        });
        setDisplayGraph(displayClone);
    };

    const exportSvg = () => {
        const width = 734;
        const height = 734;
        const scale = 0.03;
        const pixels = 1;
        const graphToExport = displayGraph.nodes.size > 0 ? displayGraph : positionedGraph;

        const nodeCSSclasses = (node: any): string => {
            const classes = ['node'];
            const roles = node.meta?.roles;
            if (roles && typeof roles === 'object') {
                Object.values(roles).forEach((val) => {
                    if (Array.isArray(val)) {
                        val.forEach((role: string) => classes.push(role));
                    } else if (typeof val === 'string') {
                        classes.push(val);
                    }
                });
            }
            return classes.join(' ');
        };

        const edgeCSSclasses = (edge: any): string => {
            const classes = ['edge', 'dotted'];
            const roles = edge.meta?.roles;
            if (roles && typeof roles === 'object') {
                Object.values(roles).forEach((val) => {
                    if (Array.isArray(val)) {
                        val.forEach((role: string) => classes.push(role));
                    } else if (typeof val === 'string') {
                        classes.push(val);
                    }
                });
            } else if (typeof roles === 'string') {
                classes.push(roles);
            }
            return classes.join(' ');
        };

        const escapeXml = (value: string): string =>
            value
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&apos;');

        const getSvgStylesText = (): string => {
            for (const sheet of Array.from(document.styleSheets)) {
                try {
                    const owner = sheet.ownerNode as HTMLElement | null;
                    const ownerId = owner?.getAttribute('data-vite-dev-id') ?? '';
                    const href = (sheet as CSSStyleSheet).href ?? '';
                    const looksLikeSvgStyles = ownerId.includes('SvgStyles.css') || href.includes('SvgStyles.css');
                    if (!looksLikeSvgStyles) continue;

                    const rules = (sheet as CSSStyleSheet).cssRules;
                    let cssText = '';
                    for (const rule of Array.from(rules)) {
                        cssText += `${rule.cssText}\n`;
                    }
                    return cssText;
                } catch {
                    // Ignore stylesheets that cannot be read.
                }
            }
            return '';
        };

        const svgStyles = getSvgStylesText();

        const edgeMarkup = Array.from(graphToExport.edges.values()).map((edge) => {
            const source = graphToExport.nodes.get(edge.a);
            const target = graphToExport.nodes.get(edge.b);
            if (!source || !target) {
                return '';
            }
            return `<line x1="${source.x}" y1="${source.y}" x2="${target.x}" y2="${target.y}" class="${escapeXml(edgeCSSclasses(edge))}" />`;
        }).join('');

        const nodeMarkup = Array.from(graphToExport.nodes.values()).map((node) => {
            const s = width * scale / ((node.meta.generation + 1) * pixels);
            const nodeClass = escapeXml(nodeCSSclasses(node));
            const rotation = ((node.angle * 180) / Math.PI) - 90;
            const points = `${-s},${-s} ${s * 1.6},0 ${-s},${s}`;
            return `<g transform="translate(${node.x}, ${node.y}) rotate(${rotation})"><polygon points="${points}" class="${nodeClass}" /></g>`;
        }).join('');

        const svgMarkup = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<style><![CDATA[
${svgStyles}
]]></style>
<rect x="0" y="0" width="${width}" height="${height}" fill="#0b0b0b" />
${edgeMarkup}
${nodeMarkup}
</svg>`;

        const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'smatter-art-graph.svg';
        document.body.appendChild(link);

        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: '#111', color: '#f4f4f4', fontFamily: 'Inter, sans-serif' }}>
            <aside style={{ width: 260, padding: 20, borderRight: '1px solid #2a2a2a', background: '#181818' }}>
                <Toolbar layoutMode={layoutMode} onLayoutChange={setLayoutMode} onRandomize={randomize} onRerunLayout={rerunLayout} onExportSvg={exportSvg} onAnalysisPass={runAnalysisPass} onRelaxPass={runRelaxPass} />
                <Inspector graph={positionedGraph} />
            </aside>
            <main style={{ flex: 1, padding: 24 }}>
                <SvgRenderer graph={displayGraph.nodes.size > 0 ? displayGraph : positionedGraph} />
            </main>
        </div>
    );
}

export default App;
