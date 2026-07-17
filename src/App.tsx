import { useMemo, useState } from 'react';
import { Graph } from './graph/Graph';
import { GraphLayoutEngine } from './layout/GraphLayoutEngine';
import { SvgRenderer } from './render/SvgRenderer';
import { Toolbar } from './components/Toolbar';
import { Inspector } from './components/Inspector';
import { Pipeline } from './pipeline/Pipeline';

export type LayoutMode = 'force' | 'circle' | 'grid' | 'breadthfirst' | 'concentric' | 'random' | 'kamada' | 'smatter';

function App() {
    const [graph, setGraph] = useState<Graph>(() => new Graph());
    const [layoutMode, setLayoutMode] = useState<LayoutMode>("force");
    const [positionedGraph, setPositionedGraph] = useState<Graph>(() => new Graph());


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

    useMemo(() => {
        const fullGraph = Pipeline.generateInitialGraph(layout);
        setGraph(fullGraph);
        setPositionedGraph(fullGraph.clone());
    }, [layout]);

    const randomize = () => {
        const newGraph = Pipeline.generateInitialGraph(layout);
        setGraph(newGraph);
        setPositionedGraph(newGraph.clone());
    };

    const runAnalysisPass = () => {
        const nextGraph = Pipeline.runFullAnalysis(graph, layout, 734);
        setGraph(nextGraph);
        setPositionedGraph(nextGraph.clone());
    };

    const rerunLayout = () => {
        setGraph((current) => current.clone());
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
                <Toolbar layoutMode={layoutMode} onLayoutChange={setLayoutMode} onRandomize={randomize} onRerunLayout={rerunLayout} onExportSvg={exportSvg} onAnalysisPass={runAnalysisPass} />
                <Inspector graph={positionedGraph} />
            </aside>
            <main style={{ flex: 1, padding: 24 }}>
                <SvgRenderer graph={positionedGraph} />
            </main>
        </div>
    );
}

export default App;
