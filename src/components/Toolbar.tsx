import type { LayoutMode } from '../App';


interface ToolbarProps {
    layoutMode: LayoutMode;
    onLayoutChange: (mode: LayoutMode) => void;
    onRandomize: () => void;
    onRerunLayout: () => void;
    onExportSvg: () => void;
    onAnalysisPass: () => void;
    onRelaxPass: () => void;
}

const modes: LayoutMode[] = ['force', 'circle', 'grid', 'breadthfirst', 'concentric', 'random', 'kamada', 'smatter'];

export function Toolbar({ layoutMode, onLayoutChange, onRandomize, onRerunLayout, onExportSvg, onAnalysisPass, onRelaxPass }: ToolbarProps) {
    return (
        <div style={{ marginBottom: 16 }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 18 }}>Layout</h2>
            <div style={{ display: 'grid', gap: 8 }}>
                {modes.map((mode) => (
                    <label key={mode} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                        <input type="radio" name="layout" checked={layoutMode === mode} onChange={() => onLayoutChange(mode)} />
                        <span style={{ textTransform: 'capitalize' }}>{mode}</span>
                    </label>
                ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
                <button onClick={onRandomize}>Randomize Graph</button>
                <button onClick={onRerunLayout}>Re-run Layout</button>
                <button onClick={onAnalysisPass} style={{ background: '#4422bb', color: 'white', fontWeight: 'bold' }}>Run Analysis Pass</button>
                <button onClick={onRelaxPass} style={{ background: '#22bb44', color: 'white', fontWeight: 'bold' }}>Run Relax Pass</button>
                <button onClick={onExportSvg}>Export SVG</button>
            </div>
        </div>
    );
}
