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
    const [layoutMode, setLayoutMode] = useState<LayoutMode>("force");
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
        const result = Pipeline.runFullAnalysis(graph, 734);
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
        const svgMarkup = `
            <svg xmlns="http://www.w3.org/2000/svg" width="1400" height="900" viewBox="0 0 1400 900">
                <rect width="100%" height="100%" fill="#0b0b0b" />
                ${Array.from(positionedGraph.edges.values()).map((edge) => {
            const source = positionedGraph.nodes.get(edge.a);
            const target = positionedGraph.nodes.get(edge.b);
            if (!source || !target) {
                return '';
            }

            return `<line x1="${source.x}" y1="${source.y}" x2="${target.x}" y2="${target.y}" stroke="#7b7b7b" stroke-width="2" />`;
        }).join('')}
                ${Array.from(positionedGraph.nodes.values()).map((node) => `
                    <g>
                        <circle cx="${node.x}" cy="${node.y}" r="10" fill="#f0b429" stroke="#fff1c2" stroke-width="1" />
                        <text x="${node.x}" y="${node.y + 4}" text-anchor="middle" font-size="12" fill="#f4f4f4">${node.id}</text>
                    </g>
                `).join('')}
            </svg>
        `;

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
