import React, { useState, useEffect } from 'react';
import { positionsAPI } from '../services/api';
import {
    XAxis as RechartsXAxis,
    YAxis as RechartsYAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ComposedChart,
    Bar,
    Area,
    Line,
    LineChart
} from 'recharts';
import {
    ChartCanvas, Chart,
    XAxis as FinancialXAxis, YAxis as FinancialYAxis,
    PointAndFigureSeries,
    KagiSeries,
    RenkoSeries,
    pointAndFigure,
    kagi,
    renko,

    CrossHairCursor, CurrentCoordinate, EdgeIndicator,
    MouseCoordinateX, MouseCoordinateY,
    OHLCTooltip,
    discontinuousTimeScaleProviderBuilder,
    lastVisibleItemBasedZoomAnchor,
    withSize,
    withDeviceRatio,
} from 'react-financial-charts';
import { format } from "d3-format";
import { timeFormat } from "d3-time-format";
import ChartTypeToggle from './ChartTypeToggle';
import './StockHistoryChart.css';

const PointAndFigureChart = withSize(withDeviceRatio(({ data: initialData, width, ratio, theme }) => {
    const margin = { left: 70, right: 70, top: 20, bottom: 30 };
    const height = 250;

    const calculator = pointAndFigure();
    const calculatedData = calculator(initialData);

    const xScaleProvider = discontinuousTimeScaleProviderBuilder()
        .inputDateAccessor(d => d.date);
    const { data, xScale, xAccessor, displayXAccessor } = xScaleProvider(calculatedData);

            const xExtents = [
                xAccessor(data[Math.max(0, data.length - 100)]),
                xAccessor(data[data.length - 1]),
            ];

    const dateTimeFormat = timeFormat("%d %b");
    const timeDisplayFormat = timeFormat("%H:%M");

    const barColor = theme === 'dark' ? '#4CAF50' : '#26A69A'; // Green for bullish
    const reversalColor = theme === 'dark' ? '#F44336' : '#EF5350'; // Red for bearish

    return (
        <ChartCanvas
            height={height}
            ratio={ratio}
            width={width}
            margin={margin}
            data={data}
            xScale={xScale}
            xAccessor={xAccessor}
            displayXAccessor={displayXAccessor}
            xExtents={xExtents}
             zoomAnchor={lastVisibleItemBasedZoomAnchor}
        >
            <Chart id={1} yExtents={d => [d.high, d.low]}>
                <FinancialXAxis axisAt="bottom" orient="bottom" ticks={6} tickFormat={dateTimeFormat} />
                <FinancialYAxis axisAt="left" orient="left" ticks={5} />
                <PointAndFigureSeries
                    stroke={barColor}
                    fill={reversalColor}
                />
                <MouseCoordinateX
                    at="bottom"
                    orient="bottom"
                    displayFormat={timeDisplayFormat}
                />
                <MouseCoordinateY
                    at="left"
                    orient="left"
                    displayFormat={format(".2f")}
                />
                <OHLCTooltip origin={[-40, 0]} />
                <CrossHairCursor />
            </Chart>
        </ChartCanvas>
    );
}));

const KagiChart = withSize(withDeviceRatio(({ data: initialData, width, ratio, theme }) => {
    const margin = { left: 70, right: 70, top: 20, bottom: 30 };
    const height = 250;

    const calculator = kagi();
    const calculatedData = calculator(initialData);

    const xScaleProvider = discontinuousTimeScaleProviderBuilder()
        .inputDateAccessor(d => d.date);
    const { data, xScale, xAccessor, displayXAccessor } = xScaleProvider(calculatedData);

            const xExtents = [
                xAccessor(data[Math.max(0, data.length - 100)]),
                xAccessor(data[data.length - 1]),
            ];

    const dateTimeFormat = timeFormat("%d %b");
    const timeDisplayFormat = timeFormat("%H:%M");

    const strokeColor = theme === 'dark' ? '#60a5fa' : '#3b82f6';
    const reversalColor = theme === 'dark' ? '#ef4444' : '#dc2626';

    return (
        <ChartCanvas
            height={height}
            ratio={ratio}
            width={width}
            margin={margin}
            data={data}
            xScale={xScale}
            xAccessor={xAccessor}
            displayXAccessor={displayXAccessor}
            xExtents={xExtents}
        >
            <Chart id={1} yExtents={d => [d.high, d.low]}>
                <FinancialXAxis axisAt="bottom" orient="bottom" ticks={6} tickFormat={dateTimeFormat} />
                <FinancialYAxis axisAt="left" orient="left" ticks={5} />
                <KagiSeries
                    stroke={strokeColor}
                    reversalColor={reversalColor}
                />
                <MouseCoordinateX
                    at="bottom"
                    orient="bottom"
                    displayFormat={timeDisplayFormat}
                />
                <MouseCoordinateY
                    at="left"
                    orient="left"
                    displayFormat={format(".2f")}
                />
                <OHLCTooltip origin={[-40, 0]} />
                <CrossHairCursor />
            </Chart>
        </ChartCanvas>
    );
}));

const RenkoChart = withSize(withDeviceRatio(({ data: initialData, width, ratio, theme }) => {
    const margin = { left: 70, right: 70, top: 20, bottom: 30 };
    const height = 250;

    const calculator = renko();
    const calculatedData = calculator(initialData);

    const xScaleProvider = discontinuousTimeScaleProviderBuilder()
        .inputDateAccessor(d => d.date);
    const { data, xScale, xAccessor, displayXAccessor } = xScaleProvider(calculatedData);

    const xExtents = [
        xAccessor(data[Math.max(0, data.length - 100)]),
        xAccessor(data[data.length - 1]),
    ];

    const dateTimeFormat = timeFormat("%d %b");
    const timeDisplayFormat = timeFormat("%H:%M");

    const strokeColor = theme === 'dark' ? '#4CAF50' : '#26A69A'; // Green for bullish
    const reversalColor = theme === 'dark' ? '#F44336' : '#EF5350'; // Red for bearish

    return (
        <ChartCanvas
            height={height}
            ratio={ratio}
            width={width}
            margin={margin}
            data={data}
            xScale={xScale}
            xAccessor={xAccessor}
            displayXAccessor={displayXAccessor}
            xExtents={xExtents}
        >
            <Chart id={1} yExtents={d => [d.high, d.low]}>
                <FinancialXAxis axisAt="bottom" orient="bottom" ticks={6} tickFormat={dateTimeFormat} />
                <FinancialYAxis axisAt="left" orient="left" ticks={5} />
                <RenkoSeries
                    stroke={strokeColor}
                    fill={reversalColor}
                />
                <MouseCoordinateX
                    at="bottom"
                    orient="bottom"
                    displayFormat={timeDisplayFormat}
                />
                <MouseCoordinateY
                    at="left"
                    orient="left"
                    displayFormat={format(".2f")}
                />
                <OHLCTooltip origin={[-40, 0]} />
                <CrossHairCursor />
            </Chart>
        </ChartCanvas>
    );
}));





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
                        date: new Date(item.date),
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
                            <RechartsXAxis
                                dataKey="dateFormatted"
                                tick={{ fill: theme === 'dark' ? '#9ca3af' : '#475569', fontSize: 11 }}
                            />
                            <RechartsYAxis
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
                            <RechartsXAxis
                                dataKey="dateFormatted"
                                tick={{ fill: theme === 'dark' ? '#9ca3af' : '#475569', fontSize: 11 }}
                            />
                            <RechartsYAxis
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
                                <RechartsXAxis
                                     dataKey="dateFormatted"
                                     tick={{ fill: theme === 'dark' ? '#9ca3af' : '#475569', fontSize: 11 }}
                                 />
                                 <RechartsYAxis
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
                                <RechartsXAxis
                                     dataKey="dateFormatted"
                                     tick={{ fill: theme === 'dark' ? '#9ca3af' : '#475569', fontSize: 11 }}
                                 />
                                 <RechartsYAxis
                                     tick={{ fill: theme === 'dark' ? '#9ca3af' : '#475569', fontSize: 11 }}
                                     domain={['auto', 'auto']}
                                 />
                                <Tooltip content={<CustomTooltip />} />
                                 <Area dataKey="close" stroke="#8884d8" fill="#8884d8" />
                            </ComposedChart>
                        )}

                        {chartType === 'puntosYFigura' && (
                            <PointAndFigureChart data={historicalData} theme={theme} />
                        )}

                        {chartType === 'kagi' && (
                            <KagiChart data={historicalData} theme={theme} />
                        )}

                        {chartType === 'renko' && (
                            <RenkoChart data={historicalData} theme={theme} />
                        )}



                        
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default StockHistoryChart;
