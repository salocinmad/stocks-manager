import React, { useState, useEffect, useRef } from 'react';
import { positionsAPI, pricesAPI } from '../services/api';
import { createChart, CrosshairMode, LineStyle } from 'lightweight-charts';
import ChartTypeToggle from './ChartTypeToggle';
import './StockHistoryChart.css';

const StockHistoryChart = ({ positionKey, userId, portfolioId, theme }) => {
    const [chartType, setChartType] = useState('line');
    const [historicalData, setHistoricalData] = useState([]);
    const [operations, setOperations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [timePeriod, setTimePeriod] = useState('1m'); // 7d, 1m, 3m, 6m, 1y

    // Advanced features state
    const [showSMA, setShowSMA] = useState(false);
    const [showMarkers, setShowMarkers] = useState(true);
    const [compareSP500, setCompareSP500] = useState(false);
    const [showVolume, setShowVolume] = useState(false);
    const [sp500Data, setSp500Data] = useState([]);

    const chartContainerRef = useRef(null);
    const chartRef = useRef(null);
    const mainSeriesRef = useRef(null);
    const smaSeriesRef = useRef(null);
    const sp500SeriesRef = useRef(null);

    // Obtener datos cuando cambie positionKey, portfolioId o timePeriod
    useEffect(() => {
        fetchHistoricalData();
    }, [positionKey, portfolioId, timePeriod]);

    // Obtener datos del SP500 si está habilitado
    useEffect(() => {
        if (compareSP500) {
            fetchSP500Data();
        }
    }, [compareSP500, timePeriod]);

    // Crear/actualizar gráfico cuando cambie theme, chartType, data o features
    useEffect(() => {
        if (historicalData.length > 0 && chartContainerRef.current) {
            createOrUpdateChart();
        }
        return () => {
            // Cleanup chart on unmount
            if (chartRef.current) {
                chartRef.current.remove();
                chartRef.current = null;
                mainSeriesRef.current = null;
                smaSeriesRef.current = null;
                sp500SeriesRef.current = null;
            }
        };
    }, [historicalData, chartType, theme, showSMA, showMarkers, compareSP500, showVolume, sp500Data, operations]);

    const fetchHistoricalData = async () => {
        try {
            setLoading(true);
            setError(null);

            // Map time period to days
            const daysMap = {
                '7d': 7,
                '1m': 30,
                '3m': 90,
                '6m': 180,
                '1y': 365
            };
            const days = daysMap[timePeriod] || 30;

            const result = await positionsAPI.getHistory(positionKey, days);

            if (result.success && result.data) {
                // Formatear datos para Lightweight Charts
                const formattedData = result.data.map(item => {
                    const date = new Date(item.date);
                    const time = Math.floor(date.getTime() / 1000);

                    const close = parseFloat(item.close) || 0;
                    const open = parseFloat(item.open) || close;
                    const high = parseFloat(item.high) || close;
                    const low = parseFloat(item.low) || close;
                    const volume = parseFloat(item.volume) || 0;

                    return {
                        time,
                        open,
                        high,
                        low,
                        close,
                        volume,
                        value: close // Para gráficos de línea y área
                    };
                });

                // Ordenar por tiempo ascendente
                formattedData.sort((a, b) => a.time - b.time);
                setHistoricalData(formattedData);

                // Configurar operaciones para marcadores
                if (result.operations) {
                    setOperations(result.operations);
                }
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

    const fetchSP500Data = async () => {
        try {
            // Map time period to days
            const daysMap = {
                '7d': 7,
                '1m': 30,
                '3m': 90,
                '6m': 180,
                '1y': 365
            };
            const days = daysMap[timePeriod] || 30;

            const result = await pricesAPI.getMarketHistory('^GSPC', days);
            if (result.success && result.data) {
                const formatted = result.data.map(item => ({
                    time: Math.floor(new Date(item.date).getTime() / 1000),
                    value: parseFloat(item.close)
                })).sort((a, b) => a.time - b.time);
                setSp500Data(formatted);
            }
        } catch (err) {
            console.error('Error fetching SP500 data:', err);
        }
    };

    // Calculate Simple Moving Average (SMA)
    const calculateSMA = (data, period) => {
        const smaData = [];
        for (let i = period - 1; i < data.length; i++) {
            const val = data[i].value || data[i].close;
            let sum = 0;
            for (let j = 0; j < period; j++) {
                sum += (data[i - j].value || data[i - j].close);
            }
            smaData.push({
                time: data[i].time,
                value: sum / period,
            });
        }
        return smaData;
    };

    const createOrUpdateChart = () => {
        if (!chartContainerRef.current) return;

        // Eliminar gráfico existente si lo hay
        if (chartRef.current) {
            chartRef.current.remove();
            chartRef.current = null;
        }

        // Create new chart
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
                mode: CrosshairMode.Normal,
            },
            timeScale: {
                borderColor: theme === 'dark' ? '#404040' : '#cbd5e1',
                timeVisible: true,
            },
            rightPriceScale: {
                borderColor: theme === 'dark' ? '#404040' : '#cbd5e1',
                // If comparing, use percentage mode
                mode: compareSP500 ? 2 : 1, // 2 = Percentage, 1 = Normal
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

        // 1. Add Main Series
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
                series = chart.addHistogramSeries({ color: '#82ca9d' });
                series.setData(historicalData.map(d => ({ time: d.time, value: d.close, color: '#82ca9d' })));
                break;
            case 'area':
                series = chart.addAreaSeries({
                    topColor: 'rgba(136, 132, 216, 0.4)',
                    bottomColor: 'rgba(136, 132, 216, 0.0)',
                    lineColor: '#8884d8',
                    lineWidth: 2,
                });
                series.setData(historicalData.map(d => ({ time: d.time, value: d.close })));
                break;
            case 'line':
            default:
                series = chart.addLineSeries({ color: '#60a5fa', lineWidth: 2 });
                series.setData(historicalData.map(d => ({ time: d.time, value: d.close })));
                break;
        }
        mainSeriesRef.current = series;

        // 2. Add Markers (Operations)
        if (showMarkers && operations.length > 0) {
            const markers = [];
            operations.forEach(op => {
                const opTime = Math.floor(new Date(op.date).getTime() / 1000);
                // Find closest data point time
                const closest = historicalData.reduce((prev, curr) =>
                    Math.abs(curr.time - opTime) < Math.abs(prev.time - opTime) ? curr : prev
                );

                if (closest) {
                    markers.push({
                        time: closest.time,
                        position: op.type === 'purchase' ? 'belowBar' : 'aboveBar',
                        color: op.type === 'purchase' ? '#10b981' : '#ef4444',
                        shape: op.type === 'purchase' ? 'arrowUp' : 'arrowDown',
                        text: op.type === 'purchase' ? 'Compra' : 'Venta',
                        size: 1,
                    });
                }
            });
            series.setMarkers(markers);
        }

        // 3. Add SMA Indicator
        if (showSMA) {
            const smaData = calculateSMA(historicalData, 20);
            const smaSeries = chart.addLineSeries({
                color: '#f59e0b',
                lineWidth: 1,
                lineStyle: LineStyle.Solid,
                title: 'SMA 20',
            });
            smaSeries.setData(smaData);
            smaSeriesRef.current = smaSeries;
        }

        // 4. Add S&P 500 Comparison
        if (compareSP500 && sp500Data.length > 0) {
            const spSeries = chart.addLineSeries({
                color: '#a855f7',
                lineWidth: 2,
                lineStyle: LineStyle.Solid,
                title: 'S&P 500',
            });
            spSeries.setData(sp500Data);
            sp500SeriesRef.current = spSeries;
        }

        // 5. Add Volume Histogram
        if (showVolume) {
            const volumeData = historicalData.map((d, index) => {
                const prevClose = index > 0 ? historicalData[index - 1].close : d.open;
                const color = d.close >= prevClose ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.5)';
                return {
                    time: d.time,
                    value: d.volume || 0,
                    color: color
                };
            }).filter(d => d.value > 0);

            if (volumeData.length > 0) {
                const volumeSeries = chart.addHistogramSeries({
                    priceFormat: {
                        type: 'volume',
                    },
                    priceScaleId: 'volume',
                });
                volumeSeries.setData(volumeData);

                chart.priceScale('volume').applyOptions({
                    scaleMargins: {
                        top: 0.8,
                        bottom: 0,
                    },
                });
            }
        }

        chart.timeScale().fitContent();

        const handleResize = () => {
            if (chartContainerRef.current && chartRef.current) {
                chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
            }
        };
        window.addEventListener('resize', handleResize);
        chartRef.current.resizeHandler = () => window.removeEventListener('resize', handleResize);
    };

    if (loading && historicalData.length === 0) {
        return <div className="stock-history-container"><p style={{ textAlign: 'center', padding: '20px', color: '#888' }}>⏳ Cargando...</p></div>;
    }

    if (error) {
        return <div className="stock-history-container"><p style={{ textAlign: 'center', padding: '20px', color: '#ef4444' }}>⚠️ {error}</p></div>;
    }

    if (historicalData.length === 0) {
        return <div className="stock-history-container"><p style={{ textAlign: 'center', padding: '20px', color: '#888' }}>No hay datos</p></div>;
    }

    return (
        <div className="stock-history-container">
            <div className="chart-controls-row">
                <ChartTypeToggle chartType={chartType} onChartTypeChange={setChartType} />

                <div className="advanced-controls">
                    <button
                        className={`control-button ${showSMA ? 'active' : ''}`}
                        onClick={() => setShowSMA(!showSMA)}
                        title="Media Móvil Simple (20 periodos)"
                    >
                        📈 SMA 20
                    </button>
                    <button
                        className={`control-button ${showMarkers ? 'active' : ''}`}
                        onClick={() => setShowMarkers(!showMarkers)}
                        title="Mostrar mis operaciones"
                    >
                        📍 Operaciones
                    </button>
                    <button
                        className={`control-button ${compareSP500 ? 'active' : ''}`}
                        onClick={() => setCompareSP500(!compareSP500)}
                        title="Comparar con S&P 500"
                    >
                        🆚 SP500
                    </button>
                    <button
                        className={`control-button ${showVolume ? 'active' : ''}`}
                        onClick={() => setShowVolume(!showVolume)}
                        title="Mostrar volumen de negociación"
                    >
                        📊 Volumen
                    </button>
                </div>
            </div>

            <div className="time-period-selector">
                {['7d', '1m', '3m', '6m', '1y'].map(period => (
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

export default StockHistoryChart;
