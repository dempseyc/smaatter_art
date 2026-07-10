import type { Graph } from '../graph/Graph';

interface InspectorProps {
    graph: Graph;
}

export function Inspector({ graph }: InspectorProps) {
    return (
        <div style={{ marginTop: 24 }}>
            <h3 style={{ marginBottom: 8 }}>Inspector</h3>
            <p style={{ margin: 0, color: '#a3a3a3' }}>Nodes: {graph.nodes.size}</p>
            <p style={{ margin: '4px 0 0', color: '#a3a3a3' }}>Edges: {graph.edges.size}</p>
        </div>
    );
}
