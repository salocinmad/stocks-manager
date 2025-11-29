import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

/**
 * Componente reutilizable para mostrar gráfico de precios históricos
 * Usa el mismo estilo que las gráficas de Reports (linear, dominio dinámico)
 */
function HistoricalChart({ data, company, symbol, currency, theme }) {
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
            </ResponsiveContainer>
        </div>
    );
}

export default HistoricalChart;
