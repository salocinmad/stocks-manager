import React, { useState, useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';
import ChartTypeToggle from './ChartTypeToggle';
import './StockHistoryChart.css';

const PnLChart = ({ data, theme, onTimePeriodChange }) => {
    const [chartType, setChartType] = useState('area'); // Default: area
    const [timePeriod, setTimePeriod] = useState('1m'); // 7d, 1m, 3m, 6m
    const chartContainerRef = useRef(null);
    const chartRef = useRef(null);

    // Notify parent when time period changes
    useEffect(() => {
        if (onTimePeriodChange) {
            const daysMap = {
                '7d': 7,
                '1m': 30,
                '3m': 90,
                '6m': 180
            };
            onTimePeriodChange(daysMap[timePeriod] || 30);
        }
    }, [timePeriod, onTimePeriodChange]);

    useEffect(() => {
        if (!data || data.length === 0 || !chartContainerRef.current) return;

        // Remove existing chart
        if (chartRef.current) {
            chartRef.current.remove();
            chartRef.current = null;
        }

        // Create chart
        const chart = createChart(chartContainerRef.current, {
            width: chartContainerRef.current.clientWidth,
            height: 300,
            layout: {
                background: { color: 'transparent' },
                textColor: theme === 'dark' ? '#9ca3af' : '#475569',
            },
            grid: {
                vertLines: { color: theme === 'dark' ? '#1f2937' : '#e5e7eb' },
                horzLines: { color: theme === 'dark' ? '#1f2937' : '#e5e7eb' },
            },
            crosshair: {
                mode: 1,
            },
            timeScale: {
                borderColor: theme === 'dark' ? '#404040' : '#cbd5e1',
                timeVisible: false, // Hide time, show only date
            },
            rightPriceScale: {
                borderColor: theme === 'dark' ? '#404040' : '#cbd5e1',
            },
            handleScroll: {
                mouseWheel: true,
                pressedMouseMove: true,
            },
            handleScale: {
                mouseWheel: true,
                pinch: true,
            },
            localization: {
                priceFormatter: (price) => {
                    return price.toFixed(2) + ' €';
                },
            },
        });

        chartRef.current = chart;

        // Convert data to lightweight-charts format
        const formattedData = data.map(item => {
            // Use date string directly (YYYY-MM-DD) to avoid time display issues
            const time = item.date;
            const value = item.pnlEUR || 0;
            return {
                time,
                value,
                // For candlestick and bar: simulate OHLC based on PnL
                open: value,
                high: value,
                low: value,
                close: value
            };
        }).sort((a, b) => (new Date(a.time) - new Date(b.time)));

        // Add series based on chart type
        let series;
        switch (chartType) {
            case 'bar':
                series = chart.addHistogramSeries({
                    color: '#82ca9d'
                });
                series.setData(formattedData.map(d => ({
                    time: d.time,
                    value: d.value,
                    color: d.value >= 0 ? '#10b981' : '#ef4444'
                })));
                break;
            case 'area':
                series = chart.addAreaSeries({
                    topColor: 'rgba(96, 165, 250, 0.4)',
                    bottomColor: 'rgba(96, 165, 250, 0.0)',
                    lineColor: '#60a5fa',
                    lineWidth: 2,
                });
                series.setData(formattedData.map(d => ({ time: d.time, value: d.value })));
                break;
            case 'line':
            default:
                series = chart.addLineSeries({
                    color: '#60a5fa',
                    lineWidth: 2
                });
                series.setData(formattedData.map(d => ({ time: d.time, value: d.value })));
                break;
        }

        chart.timeScale().fitContent();

        // Create custom tooltip
        const tooltipDiv = document.createElement('div');
        tooltipDiv.style.position = 'absolute';
        tooltipDiv.style.display = 'none';
        tooltipDiv.style.padding = '8px 12px';
        tooltipDiv.style.background = theme === 'dark' ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)';
        tooltipDiv.style.color = theme === 'dark' ? '#e5e7eb' : '#1f2937';
        tooltipDiv.style.borderRadius = '6px';
        tooltipDiv.style.fontSize = '12px';
        tooltipDiv.style.fontWeight = '500';
        tooltipDiv.style.pointerEvents = 'none';
        tooltipDiv.style.zIndex = '1000';
        tooltipDiv.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
        tooltipDiv.style.border = theme === 'dark' ? '1px solid #374151' : '1px solid #e5e7eb';
        chartContainerRef.current.appendChild(tooltipDiv);

        chart.subscribeCrosshairMove((param) => {
            if (!param.time || !param.seriesData || param.seriesData.size === 0) {
                tooltipDiv.style.display = 'none';
                return;
            }

            const data = param.seriesData.get(series);
            if (!data) {
                tooltipDiv.style.display = 'none';
                return;
            }

            const value = data.value !== undefined ? data.value : data.close;
            const dateStr = typeof param.time === 'string' ? param.time : new Date(param.time * 1000).toISOString().split('T')[0];

            // Format date nicely (e.g., "28 oct '25")
            const date = new Date(dateStr);
            const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
            const formattedDate = `${date.getDate()} ${months[date.getMonth()]} '${date.getFullYear().toString().slice(-2)}`;

            tooltipDiv.innerHTML = `
                <div style="margin-bottom: 4px; color: ${theme === 'dark' ? '#9ca3af' : '#6b7280'};">${formattedDate}</div>
                <div style="font-size: 14px; font-weight: 600;">PnL: ${value.toFixed(2)} €</div>
            `;

            const coordinate = param.point;
            if (!coordinate) {
                tooltipDiv.style.display = 'none';
                return;
            }

            tooltipDiv.style.display = 'block';
            tooltipDiv.style.left = coordinate.x + 15 + 'px';
            tooltipDiv.style.top = coordinate.y - 50 + 'px';
        });

        // Handle resize
        const handleResize = () => {
            if (chartContainerRef.current && chartRef.current) {
                chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            if (tooltipDiv.parentNode) {
                tooltipDiv.parentNode.removeChild(tooltipDiv);
            }
            if (chartRef.current) {
                chartRef.current.remove();
                chartRef.current = null;
            }
        };
    }, [data, theme, chartType]);

    if (!data || data.length === 0) {
        return <p style={{ textAlign: 'center', padding: '20px', color: '#888' }}>No hay datos disponibles</p>;
    }

    return (
        <div className="stock-history-container">
            <div className="chart-controls-row">
                <ChartTypeToggle
                    chartType={chartType}
                    onChartTypeChange={setChartType}
                    allowedTypes={['line', 'bar', 'area']}
                />
            </div>

            <div className="time-period-selector">
                {['7d', '1m', '3m', '6m'].map(period => (
                    <button
                        key={period}
                        className={`period-button ${timePeriod === period ? 'active' : ''}`}
                        onClick={() => setTimePeriod(period)}
                    >
                        {period.toUpperCase()}
                    </button>
                ))}
            </div>

            <div className="chart-wrapper">
                <div ref={chartContainerRef} style={{ width: '100%', height: '300px' }} />
            </div>
        </div>
    );
};

export default PnLChart;
