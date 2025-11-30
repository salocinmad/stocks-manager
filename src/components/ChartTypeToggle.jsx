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

const ChartTypeToggle = ({ chartType, onChartTypeChange }) => {
    return (
        <div className="chart-type-toggle">
            <button
                className={`toggle-button ${chartType === 'line' ? 'active' : ''}`}
                onClick={() => onChartTypeChange('line')}
                type="button"
                title="Gráfico de Línea"
            >
                <Icons.Line />
                <span>Lineal</span>
            </button>
            <button
                className={`toggle-button ${chartType === 'candlestick' ? 'active' : ''}`}
                onClick={() => onChartTypeChange('candlestick')}
                type="button"
                title="Gráfico de Velas"
            >
                <Icons.Candlestick />
                <span>Velas</span>
            </button>
            <button
                className={`toggle-button ${chartType === 'bar' ? 'active' : ''}`}
                onClick={() => onChartTypeChange('bar')}
                type="button"
                title="Gráfico de Barras"
            >
                <Icons.Bar />
                <span>Barras</span>
            </button>
            <button
                className={`toggle-button ${chartType === 'area' ? 'active' : ''}`}
                onClick={() => onChartTypeChange('area')}
                type="button"
                title="Gráfico de Área"
            >
                <Icons.Area />
                <span>Área</span>
            </button>
        </div>
    );
};

export default ChartTypeToggle;
