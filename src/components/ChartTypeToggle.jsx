import React from 'react';
import './ChartTypeToggle.css';

const Icons = {
    Line: () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
        </svg>
    ),
    Candlestick: () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 5v4"></path>
            <rect x="7" y="9" width="4" height="6"></rect>
            <path d="M9 15v4"></path>
            <path d="M17 3v2"></path>
            <rect x="15" y="5" width="4" height="12"></rect>
            <path d="M17 17v3"></path>
        </svg>
    ),
    Bar: () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="20" x2="12" y2="10"></line>
            <line x1="18" y1="20" x2="18" y2="4"></line>
            <line x1="6" y1="20" x2="6" y2="16"></line>
        </svg>
    ),
    Area: () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
            <path d="M22 12h-4l-3 9L9 3l-3 9H2v9h20v-9z" fill="currentColor" fillOpacity="0.2" stroke="none"></path>
        </svg>
    )
};

const ChartTypeToggle = ({ chartType, onChartTypeChange, allowedTypes = ['line', 'candlestick', 'bar', 'area'] }) => {
    const chartTypes = [
        { key: 'line', Icon: Icons.Line, label: 'Lineal', title: 'Gráfico de Línea' },
        { key: 'candlestick', Icon: Icons.Candlestick, label: 'Velas', title: 'Gráfico de Velas' },
        { key: 'bar', Icon: Icons.Bar, label: 'Barras', title: 'Gráfico de Barras' },
        { key: 'area', Icon: Icons.Area, label: 'Área', title: 'Gráfico de Área' }
    ];

    return (
        <div className="chart-type-toggle">
            {chartTypes
                .filter(type => allowedTypes.includes(type.key))
                .map(({ key, Icon, label, title }) => (
                    <button
                        key={key}
                        className={`toggle-button ${chartType === key ? 'active' : ''}`}
                        onClick={() => onChartTypeChange(key)}
                        type="button"
                        title={title}
                    >
                        <Icon />
                        <span>{label}</span>
                    </button>
                ))
            }
        </div>
    );
};

export default ChartTypeToggle;
