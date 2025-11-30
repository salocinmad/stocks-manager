import React, { useState, useEffect, useRef } from 'react';
import { positionsAPI } from '../services/api';
import { createChart } from 'lightweight-charts';
import ChartTypeToggle from './ChartTypeToggle';
import './StockHistoryChart.css';

const StockHistoryChart = ({ positionKey, userId, portfolioId, theme }) => {
    const [chartType, setChartType] = useState('line');
    const [historicalData, setHistoricalData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [timePeriod, setTimePeriod] = useState('1m'); // 7d, 1m, 3m, 6m
    const chartContainerRef = useRef(null);
    const chartRef = useRef(null);
    const seriesRef = useRef(null);

    // Fetch data whenever positionKey, portfolioId, or timePeriod changes
    useEffect(() => {
        fetchHistoricalData();
    }, [positionKey, portfolioId, timePeriod]);

    // Create/update chart whenever theme, chartType, or data changes
    useEffect(() => {
        if (historicalData.length > 0 && chartContainerRef.current) {
            createOrUpdateChart();
        }
        return () => {
            // Cleanup chart on unmount
            if (chartRef.current) {
                chartRef.current.remove();
                chartRef.current = null;
                seriesRef.current = null;
            }
        };
    }, [historicalData, chartType, theme]);

    const fetchHistoricalData = async () => {
        try {
            setLoading(true);
            setError(null);

            // Map time period to days
            const daysMap = {
                '7d': 7,
                '1m': 30,
                '3m': 90,
                '6m': 180
            };
            const days = daysMap[timePeriod] || 30;

            const result = await positionsAPI.getHistory(positionKey, days);

            if (result.success && result.data) {
                // Format data for Lightweight Charts
                const formattedData = result.data.map(item => {
                    const date = new Date(item.date);
                    // Lightweight Charts uses Unix timestamps in seconds
                    const time = Math.floor(date.getTime() / 1000);

                    const close = parseFloat(item.close) || 0;
                    const open = parseFloat(item.open) || close;
                    const high = parseFloat(item.high) || close;
                    const low = parseFloat(item.low) || close;

                    return {
                        time,
                        open,
                        high,
                        low,
                        close,
                        value: close // For line and area charts
                    };
                });

                // Sort by time ascending
                formattedData.sort((a, b) => a.time - b.time);
                setHistoricalData(formattedData);
            } else {
                setHistoricalData([]);
            }
        } catch (err) {
            console.error('Error fetching historical data:', err);
            setError(err.message || 'Error al cargar datos');
            setHistoricalData([]);
        } finally {
            setLoading(false);
        }
    };

    const createOrUpdateChart = () => {
        if (!chartContainerRef.current) return;

        // Remove existing chart if any
        if (chartRef.current) {
            chartRef.current.remove();
            chartRef.current = null;
            seriesRef.current = null;
        }

        // Create new chart
        const chart = createChart(chartContainerRef.current, {
            width: chartContainerRef.current.clientWidth,
            height: 250,
            layout: {
                background: { color: 'transparent' },
                textColor: theme === 'dark' ? '#9ca3af' : '#475569',
            },
            grid: {
                vertLines: { color: theme === 'dark' ? '#1f2937' : '#e5e7eb' },
                horzLines: { color: theme === 'dark' ? '#1f2937' : '#e5e7eb' },
            },
            crosshair: {
                mode: 1, // Normal crosshair
                vertLine: {
                    width: 1,
                    color: theme === 'dark' ? '#60a5fa' : '#3b82f6',
                    style: 3, // Dashed
                },
                horzLine: {
                    width: 1,
                    color: theme === 'dark' ? '#60a5fa' : '#3b82f6',
                    style: 3,
                },
            },
            timeScale: {
                borderColor: theme === 'dark' ? '#404040' : '#cbd5e1',
                timeVisible: true,
                secondsVisible: false,
            },
            rightPriceScale: {
                borderColor: theme === 'dark' ? '#404040' : '#cbd5e1',
            },
            handleScroll: {
                mouseWheel: true,
                pressedMouseMove: true,
                horzTouchDrag: true,
                vertTouchDrag: true,
            },
            handleScale: {
                axisPressedMouseMove: true,
                mouseWheel: true,
                pinch: true,
            },
        });

        chartRef.current = chart;

        // Create series based on chart type
        let series;

        switch (chartType) {
            case 'candlestick':
                series = chart.addCandlestickSeries({
                    upColor: '#10b981',
                    downColor: '#ef4444',
                    borderUpColor: '#10b981',
                    borderDownColor: '#ef4444',
                    wickUpColor: '#10b981',
                    wickDownColor: '#ef4444',
                });
                series.setData(historicalData);
                break;

            case 'bar':
                series = chart.addHistogramSeries({
                    color: '#82ca9d',
                    priceFormat: {
                        type: 'price',
                        precision: 2,
                        minMove: 0.01,
                    },
                });
                series.setData(historicalData.map(d => ({
                    time: d.time,
                    value: d.close,
                    color: '#82ca9d'
                })));
                break;

            case 'area':
                series = chart.addAreaSeries({
                    topColor: 'rgba(136, 132, 216, 0.4)',
                    bottomColor: 'rgba(136, 132, 216, 0.0)',
                    lineColor: '#8884d8',
                    lineWidth: 2,
                });
                series.setData(historicalData.map(d => ({
                    time: d.time,
                    value: d.close
                })));
                break;

            case 'line':
            default:
                series = chart.addLineSeries({
                    color: '#60a5fa',
                    lineWidth: 2,
                });
                series.setData(historicalData.map(d => ({
                    time: d.time,
                    value: d.close
                })));
                break;
        }

        seriesRef.current = series;

        // Fit content to view
        chart.timeScale().fitContent();

        // Handle window resize
        const handleResize = () => {
            if (chartContainerRef.current && chartRef.current) {
                chartRef.current.applyOptions({
                    width: chartContainerRef.current.clientWidth
                });
            }
        };

        window.addEventListener('resize', handleResize);

        // Store cleanup function
        chartRef.current.resizeHandler = () => {
            window.removeEventListener('resize', handleResize);
        };
    };

    if (loading) {
        return (
            <div className="stock-history-container">
                <p style={{ textAlign: 'center', padding: '20px', color: '#888' }}>
                    ⏳ Cargando datos históricos...
                </p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="stock-history-container">
                <p style={{ textAlign: 'center', padding: '20px', color: '#ef4444' }}>
                    ⚠️ {error}
                </p>
            </div>
        );
    }

    if (historicalData.length === 0) {
        return (
            <div className="stock-history-container">
                <p style={{ textAlign: 'center', padding: '20px', color: '#888' }}>
                    No hay datos históricos disponibles para esta acción
                </p>
            </div>
        );
    }

    return (
        <div className="stock-history-container">
            <ChartTypeToggle chartType={chartType} onChartTypeChange={setChartType} />

            {/* Time Period Selector */}
            <div className="time-period-selector">
                <button
                    className={`period-button ${timePeriod === '7d' ? 'active' : ''}`}
                    onClick={() => setTimePeriod('7d')}
                    type="button"
                >
                    7D
                </button>
                <button
                    className={`period-button ${timePeriod === '1m' ? 'active' : ''}`}
                    onClick={() => setTimePeriod('1m')}
                    type="button"
                >
                    1M
                </button>
                <button
                    className={`period-button ${timePeriod === '3m' ? 'active' : ''}`}
                    onClick={() => setTimePeriod('3m')}
                    type="button"
                >
                    3M
                </button>
                <button
                    className={`period-button ${timePeriod === '6m' ? 'active' : ''}`}
                    onClick={() => setTimePeriod('6m')}
                    type="button"
                >
                    6M
                </button>
            </div>

            <div className="chart-wrapper">
                <div ref={chartContainerRef} style={{ width: '100%', height: '250px' }} />
            </div>
        </div>
    );
};

export default StockHistoryChart;
