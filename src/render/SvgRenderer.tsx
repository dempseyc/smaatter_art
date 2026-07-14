import type { Graph } from '../graph/Graph';
// @ts-ignore
import './SvgStyles.css';

interface SvgRendererProps {
    graph: Graph;
}

const width = 734;
const height = 734;


export function SvgRenderer({ graph }: SvgRendererProps) {
    const nodeCSSclasses = (node: any) => {
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
    }
    const edgeCSSclasses = (edge: any) => {
        const classes = ['edge'];
        const roles = edge.meta?.roles;
        if (roles && typeof roles === 'object') {
            // If roles is an object with arrays or strings as values
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
    }
    return (
        <div style={{ width: '734px', height: '734px', background: '#0b0b0b', borderRadius: 12, border: '1px solid #2a2a2a', overflow: 'hidden' }}>
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
                        <text x={node.x} y={node.y + 4} className="label" textAnchor="middle" fill="white">
                            {node.id}
                        </text>
                    </g>
                ))}
            </svg>
        </div>
    );
}
