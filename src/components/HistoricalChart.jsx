import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, ReferenceLine, Rectangle } from 'recharts';

/**
 * Componente reutilizable para mostrar gráfico de precios históricos
 * Usa el mismo estilo que las gráficas de Reports (linear, dominio dinámico)
 */
function HistoricalChart({ data, company, symbol, currency, theme, chartType = 'line' }) {
    if (!data || data.length === 0) {
        return (
            <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
                No hay datos históricos disponibles para esta acción
            </div>
        );
    }

    // Calcular dominio dinámico del YAxis (mismo que Reports)
    const values = data.map(d => d.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = maxValue - minValue;

    // Padding: 5% arriba, 2% abajo
    const paddingTop = range * 0.05;
    const paddingBottom = range * 0.02;
    const yMin = minValue - paddingBottom;
    const yMax = maxValue + paddingTop;

    const currencySymbol = currency === 'EUR' ? '€' : '$';

    // Formatear fecha para el eje X
    const formatDate = (dateString) => {
        const options = { day: '2-digit', month: '2-digit' };
        return new Date(dateString).toLocaleDateString('es-ES', options);
    };

    // Componente de vela personalizado
    const CustomCandlestick = (props) => {
        const { x, y, width, open, close, high, low } = props;
        const isRising = close > open;
        const fillColor = isRising ? '#10b981' : '#ef4444'; // Verde para subida, Rojo para bajada

        return (
            <g>
                {/* Sombra (wick) */}
                <line
                    x1={x + width / 2}
                    y1={high}
                    x2={x + width / 2}
                    y2={Math.max(open, close)}
                    stroke={fillColor}
                    strokeWidth={1}
                />
                <line
                    x1={x + width / 2}
                    y1={low}
                    x2={x + width / 2}
                    y2={Math.min(open, close)}
                    stroke={fillColor}
                    strokeWidth={1}
                />
                {/* Cuerpo de la vela */}
                <Rectangle
                    x={x}
                    y={Math.min(open, close)}
                    width={width}
                    height={Math.abs(open - close)}
                    fill={fillColor}
                    stroke={fillColor}
                />
            </g>
        );
    };

    // Componente de barra OHLC personalizado
    const CustomOHLCBar = (props) => {
        const { x, y, width, open, close, high, low } = props;
        const isRising = close > open;
        const strokeColor = isRising ? '#10b981' : '#ef4444'; // Verde para subida, Rojo para bajada

        return (
            <g>
                {/* Línea vertical (High-Low) */}
                <line
                    x1={x + width / 2}
                    y1={high}
                    x2={x + width / 2}
                    y2={low}
                    stroke={strokeColor}
                    strokeWidth={1}
                />
                {/* Marca de apertura (Open) */}
                <line
                    x1={x + width / 2}
                    y1={open}
                    x2={x + width / 2 - width / 4}
                    y2={open}
                    stroke={strokeColor}
                    strokeWidth={1}
                />
                {/* Marca de cierre (Close) */}
                <line
                    x1={x + width / 2}
                    y1={close}
                    x2={x + width / 2 + width / 4}
                    y2={close}
                    stroke={strokeColor}
                    strokeWidth={1}
                />
            </g>
        );
    };

    const CustomCandlestickTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            const dataPoint = payload[0].payload;
            return (
                <div style={{
                    backgroundColor: theme === 'dark' ? '#2d2d2d' : '#f8fafc',
                    border: `1px solid ${theme === 'dark' ? '#404040' : '#cbd5e1'}`,
                    borderRadius: '4px',
                    padding: '10px',
                    color: theme === 'dark' ? '#ffffff' : '#1f2937',
                    fontSize: '12px'
                }}>
                    <p><strong>Fecha:</strong> {formatDate(label)}</p>
                    <p><strong>Apertura:</strong> {currencySymbol}{Number(dataPoint.open).toFixed(4)}</p>
                    <p><strong>Máximo:</strong> {currencySymbol}{Number(dataPoint.high).toFixed(4)}</p>
                    <p><strong>Mínimo:</strong> {currencySymbol}{Number(dataPoint.low).toFixed(4)}</p>
                    <p><strong>Cierre:</strong> {currencySymbol}{Number(dataPoint.close).toFixed(4)}</p>
                </div>
            );
        }
        return null;
    };

    return (
        <div style={{
            padding: '20px',
            backgroundColor: theme === 'dark' ? '#1a1a1a' : '#f8f8f8',
            borderTop: `1px solid ${theme === 'dark' ? '#333' : '#ddd'}`
        }}>
            <h4 style={{
                margin: '0 0 15px 0',
                fontSize: '14px',
                color: theme === 'dark' ? '#fff' : '#333'
            }}>
                📈 {company} ({symbol}) - Últimos 30 días
            </h4>
            <ResponsiveContainer width="100%" height={250}>
                {chartType === 'line' ? (
                    <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid stroke={theme === 'dark' ? '#1f2937' : '#e5e7eb'} strokeDasharray="3 3" />
                        <XAxis
                            dataKey="date"
                            tick={{ fill: theme === 'dark' ? '#9ca3af' : '#475569', fontSize: 12 }}
                            tickFormatter={formatDate}
                        />
                        <YAxis
                            domain={[yMin, yMax]}
                            tick={{ fill: theme === 'dark' ? '#9ca3af' : '#475569', fontSize: 12 }}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: theme === 'dark' ? '#2d2d2d' : '#f8fafc',
                                border: `1px solid ${theme === 'dark' ? '#404040' : '#cbd5e1'}`,
                                borderRadius: '4px',
                                color: theme === 'dark' ? '#ffffff' : '#1f2937',
                                fontSize: '12px'
                            }}
                            itemStyle={{ color: theme === 'dark' ? '#ffffff' : '#1f2937' }}
                            labelStyle={{ color: theme === 'dark' ? '#ffffff' : '#1f2937' }}
                            formatter={(value) => [`${currencySymbol}${Number(value).toFixed(4)}`, 'Precio']}
                        />
                        <Line
                            type="linear"
                            dataKey="value"
                            stroke="#60a5fa"
                            dot={false}
                            strokeWidth={2}
                        />
                    </LineChart>
                ) : chartType === 'candlestick' ? (
                    <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid stroke={theme === 'dark' ? '#1f2937' : '#e5e7eb'} strokeDasharray="3 3" />
                        <XAxis
                            dataKey="date"
                            tick={{ fill: theme === 'dark' ? '#9ca3af' : '#475569', fontSize: 12 }}
                            tickFormatter={formatDate}
                        />
                        <YAxis
                            domain={[yMin, yMax]}
                            tick={{ fill: theme === 'dark' ? '#9ca3af' : '#475569', fontSize: 12 }}
                        />
                        <Tooltip content={<CustomCandlestickTooltip currencySymbol={currencySymbol} theme={theme} />} />
                        <Bar
                            dataKey="close" // dataKey es necesario para que el tooltip funcione, aunque no se use para renderizar la barra directamente
                            shape={<CustomCandlestick />}
                        />
                    </BarChart>
                ) : (
                    <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid stroke={theme === 'dark' ? '#1f2937' : '#e5e7eb'} strokeDasharray="3 3" />
                        <XAxis
                            dataKey="date"
                            tick={{ fill: theme === 'dark' ? '#9ca3af' : '#475569', fontSize: 12 }}
                            tickFormatter={formatDate}
                        />
                        <YAxis
                            domain={[yMin, yMax]}
                            tick={{ fill: theme === 'dark' ? '#9ca3af' : '#475569', fontSize: 12 }}
                        />
                        <Tooltip content={<CustomCandlestickTooltip currencySymbol={currencySymbol} theme={theme} />} />
                        <Bar
                            dataKey="close" // dataKey es necesario para que el tooltip funcione, aunque no se use para renderizar la barra directamente
                            shape={<CustomOHLCBar />}
                        />
                    </BarChart>
                )}
            </ResponsiveContainer>
        </div>
    );
}

export default HistoricalChart;
