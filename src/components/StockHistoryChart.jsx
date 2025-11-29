import React, { useState, useEffect } from 'react';
import { positionsAPI } from '../services/api';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ComposedChart,
    Bar,
    Area
} from 'recharts';
import ChartTypeToggle from './ChartTypeToggle';
import './StockHistoryChart.css';

const StockHistoryChart = ({ positionKey, userId, portfolioId, theme }) => {
    const [chartType, setChartType] = useState('line');
    const [historicalData, setHistoricalData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchHistoricalData();
    }, [positionKey, portfolioId]);

    const fetchHistoricalData = async () => {
        try {
            setLoading(true);
            setError(null);

            const result = await positionsAPI.getHistory(positionKey);

            if (result.success && result.data) {
                // Format data for charts
                const formattedData = result.data.map(item => {
                    const close = parseFloat(item.close) || 0;
                    // Sanitize: If open/high/low are 0 (missing data), fallback to close
                    // This prevents the Y-axis from scaling down to 0 and showing broken candles
                    const open = parseFloat(item.open) || close;
                    const high = parseFloat(item.high) || close;
                    const low = parseFloat(item.low) || close;

                    return {
                        date: item.date,
                        dateFormatted: formatDateForAxis(item.date),
                        open,
                        high,
                        low,
                        close
                    };
                });

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

    const formatDateForAxis = (dateString) => {
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${day}-${month}`;
    };

    const formatDateForTooltip = (dateString) => {
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}-${month}-${year}`;
    };

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length > 0) {
            const data = payload[0].payload;
            return (
                <div className="custom-tooltip" style={{
                    backgroundColor: theme === 'dark' ? '#2d2d2d' : '#f8fafc',
                    border: `1px solid ${theme === 'dark' ? '#404040' : '#cbd5e1'}`,
                    borderRadius: '4px',
                    padding: '10px',
                    color: theme === 'dark' ? '#ffffff' : '#1f2937',
                    fontSize: '12px'
                }}>
                    <p style={{ margin: '0 0 6px 0', fontWeight: 'bold' }}>
                        {formatDateForTooltip(data.date)}
                    </p>
                    <p style={{ margin: '3px 0', color: '#60a5fa' }}>
                        Cierre: €{data.close.toFixed(2)}
                    </p>
                    <p style={{ margin: '3px 0', color: '#10b981' }}>
                        Máximo: €{data.high.toFixed(2)}
                    </p>
                    <p style={{ margin: '3px 0', color: '#ef4444' }}>
                        Mínimo: €{data.low.toFixed(2)}
                    </p>
                </div>
            );
        }
        return null;
    };

    const CandlestickShape = (props) => {
        const { x, y, width, height, payload } = props;
        const { open, close, high, low } = payload;

        const isPositive = close >= open;
        const color = isPositive ? '#10b981' : '#ef4444';

        // Handle flat days (no movement or missing data)
        if (high === low) {
            return (
                <rect
                    x={x}
                    y={y - 1} // Center vertically
                    width={width}
                    height={2}
                    fill={color}
                    stroke="none"
                />
            );
        }

        // Calculate pixel coordinates based on the bar's height (which represents high - low range)
        const pixelRatio = height / (high - low);

        const yHigh = y;
        const yLow = y + height;
        const yOpen = y + (high - open) * pixelRatio;
        const yClose = y + (high - close) * pixelRatio;

        const candleTop = Math.min(yOpen, yClose);
        const candleHeight = Math.abs(yOpen - yClose);
        const wickX = x + width / 2;

        // Ensure minimal visibility for open === close
        const visualCandleHeight = candleHeight < 1 ? 1 : candleHeight;

        return (
            <g>
                {/* Wick (high-low line) */}
                <line
                    x1={wickX}
                    y1={yHigh}
                    x2={wickX}
                    y2={yLow}
                    stroke={color}
                    strokeWidth={1}
                />
                {/* Candle body */}
                <rect
                    x={x}
                    y={candleTop}
                    width={width}
                    height={visualCandleHeight}
                    fill={color}
                    stroke={color}
                    strokeWidth={1}
                />
            </g>
        );
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

            <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height={250}>
                    {chartType === 'line' && (
                        <LineChart data={historicalData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                            <CartesianGrid
                                stroke={theme === 'dark' ? '#1f2937' : '#e5e7eb'}
                                strokeDasharray="3 3"
                            />
                            <XAxis
                                dataKey="dateFormatted"
                                tick={{ fill: theme === 'dark' ? '#9ca3af' : '#475569', fontSize: 11 }}
                            />
                            <YAxis
                                tick={{ fill: theme === 'dark' ? '#9ca3af' : '#475569', fontSize: 11 }}
                                domain={['auto', 'auto']}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Line
                                type="linear"
                                dataKey="close"
                                stroke="#60a5fa"
                                dot={false}
                                strokeWidth={2}
                            />
                        </LineChart>
                    )}

                    {chartType === 'candlestick' && (
                        <ComposedChart data={historicalData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                            <CartesianGrid
                                stroke={theme === 'dark' ? '#1f2937' : '#e5e7eb'}
                                strokeDasharray="3 3"
                            />
                            <XAxis
                                dataKey="dateFormatted"
                                tick={{ fill: theme === 'dark' ? '#9ca3af' : '#475569', fontSize: 11 }}
                            />
                            <YAxis
                                tick={{ fill: theme === 'dark' ? '#9ca3af' : '#475569', fontSize: 11 }}
                                domain={['auto', 'auto']}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar
                                dataKey={item => [item.low, item.high]}
                                shape={<CandlestickShape />}
                                barSize={8}
                            />
                        </ComposedChart>
                    )}

                    {chartType === 'bar' && (
                            <ComposedChart data={historicalData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                                <CartesianGrid
                                    stroke={theme === 'dark' ? '#1f2937' : '#e5e7eb'}
                                    strokeDasharray="3 3"
                                />
                                <XAxis
                                    dataKey="dateFormatted"
                                    tick={{ fill: theme === 'dark' ? '#9ca3af' : '#475569', fontSize: 11 }}
                                />
                                <YAxis
                                    tick={{ fill: theme === 'dark' ? '#9ca3af' : '#475569', fontSize: 11 }}
                                    domain={['auto', 'auto']}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="close" fill="#82ca9d" />
                            </ComposedChart>
                        )}

                        {chartType === 'area' && (
                            <ComposedChart data={historicalData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                                <CartesianGrid
                                    stroke={theme === 'dark' ? '#1f2937' : '#e5e7eb'}
                                    strokeDasharray="3 3"
                                />
                                <XAxis
                                    dataKey="dateFormatted"
                                    tick={{ fill: theme === 'dark' ? '#9ca3af' : '#475569', fontSize: 11 }}
                                />
                                <YAxis
                                    tick={{ fill: theme === 'dark' ? '#9ca3af' : '#475569', fontSize: 11 }}
                                    domain={['auto', 'auto']}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                 <Area dataKey="close" stroke="#8884d8" fill="#8884d8" />
                            </ComposedChart>
                        )}
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default StockHistoryChart;
