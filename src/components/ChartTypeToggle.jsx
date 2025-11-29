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
        </div>
    );
};

export default ChartTypeToggle;
