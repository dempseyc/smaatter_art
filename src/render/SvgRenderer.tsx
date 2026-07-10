import type { Graph } from '../graph/Graph';
// @ts-ignore
import './SvgStyles.css';

interface SvgRendererProps {
    graph: Graph;
}

const width = 760;
const height = 520;


export function SvgRenderer({ graph }: SvgRendererProps) {
    const nodeCSSclasses = (node: any) => {
        const classes = ['node'];
        if (node.meta?.roles) {
            classes.push(...node.meta.roles);
        }
        return classes.join(' ');
    }
    const edgeCSSclasses = (edge: any) => {
        const classes = ['edge'];
        if (edge.meta?.roles) {
            classes.push(...edge.meta.roles);
        }
        return classes.join(' ');
    }
    return (
        <div style={{ width: '100%', height: '100%', minHeight: 480, background: '#0b0b0b', borderRadius: 12, border: '1px solid #2a2a2a', overflow: 'hidden' }}>
            <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <rect x="0" y="0" width={width} height={height} fill="#0b0b0b" />
                {Array.from(graph.edges.values()).map((edge) => {
                    const source = graph.nodes.get(edge.a);
                    const target = graph.nodes.get(edge.b);
                    if (!source || !target) {
                        return null;
                    }

                    return <line key={edge.id} x1={source.x} y1={source.y} x2={target.x} y2={target.y} className={edgeCSSclasses(edge)} />;
                })}
                {Array.from(graph.nodes.values()).map((node) => (
                    <g key={node.id}>
                        <circle cx={node.x} cy={node.y} r="10" className={nodeCSSclasses(node)} />
                        <text x={node.x} y={node.y + 4} textAnchor="middle" fontSize="24" fill="white">
                            {node.id}
                        </text>
                    </g>
                ))}
            </svg>
        </div>
    );
}
