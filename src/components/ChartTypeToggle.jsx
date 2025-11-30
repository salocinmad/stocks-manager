import React from 'react';
import './ChartTypeToggle.css';

const ChartTypeToggle = ({ chartType, onChartTypeChange }) => {
    return (
        <div className="chart-type-toggle">
            <button
                className={`toggle-button ${chartType === 'line' ? 'active' : ''}`}
                onClick={() => onChartTypeChange('line')}
                type="button"
            >
                📈 Lineal
            </button>
            <button
                className={`toggle-button ${chartType === 'candlestick' ? 'active' : ''}`}
                onClick={() => onChartTypeChange('candlestick')}
                type="button"
            >
                📊 Velas
            </button>
            <button
                className={`toggle-button ${chartType === 'bar' ? 'active' : ''}`}
                onClick={() => onChartTypeChange('bar')}
                type="button"
            >
                📊 Barras
            </button>
            <button
                className={`toggle-button ${chartType === 'area' ? 'active' : ''}`}
                onClick={() => onChartTypeChange('area')}
                type="button"
            >
                📈 Área
            </button>
            <button
                className={`toggle-button ${chartType === 'pointandfigure' ? 'active' : ''}`}
                onClick={() => onChartTypeChange('pointandfigure')}
                type="button"
            >
                ✖️ Puntos y Figura
            </button>
            <button
                className={`toggle-button ${chartType === 'kagi' ? 'active' : ''}`}
                onClick={() => onChartTypeChange('kagi')}
                type="button"
            >
                〰️ Kagi
            </button>
            <button
                className={`toggle-button ${chartType === 'renko' ? 'active' : ''}`}
                onClick={() => onChartTypeChange('renko')}
                type="button"
            >
                🧱 Renko
            </button>

        </div>
    );
};

export default ChartTypeToggle;
