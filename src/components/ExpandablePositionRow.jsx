import React, { useState, useMemo } from 'react';
import { authenticatedFetch } from '../services/auth.js';
import HistoricalChart from './HistoricalChart.jsx';

/**
 * Componente de fila expandible para tabla de posiciones activas
 * Encapsula toda la lógica de expansión, carga de datos históricos y renderizado
 * Mantiene la funcionalidad de drag & drop
 */
function ExpandablePositionRow({
    positionKey,
    company,
    symbol,
    position,
    currency,
    currentPriceData,
    avgCostPerShare,
    profitLossInEUR,
    profitLossPercent,
    currentValueInEUR,
    theme,
    portfolioId,
    formatPrice,
    formatCurrency,
    onNoteClick,
    notesCache,
    onDragStart,
    onDragEnd,
    onDragOver,
    onDrop,
    draggedPosition,
    allPositionKeys
}) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [historicalData, setHistoricalData] = useState(null);
    const [loadingData, setLoadingData] = useState(false);
    const [error, setError] = useState(null);
    const [chartType, setChartType] = useState('line'); // Nuevo estado para el tipo de gráfico

    const calculatedChange = useMemo(() => {
        if (!historicalData || historicalData.length < 2) return null;
        const lastDay = historicalData[historicalData.length - 1];
        const dayBefore = historicalData[historicalData.length - 2];
        const change = lastDay.close - dayBefore.close;
        const changePercent = (change / dayBefore.close) * 100;
        return { change, changePercent };
    }, [historicalData]);

    const toggleExpand = async () => {
        if (!isExpanded) {
            // Abrir: cargar datos si no están cargados
            if (!historicalData && !loadingData) {
                setLoadingData(true);
                setError(null);
                try {
                    const response = await authenticatedFetch(
                        `/api/prices/historical-position?positionKey=${encodeURIComponent(positionKey)}&portfolioId=${portfolioId}&days=30`
                    );

                    if (!response.ok) {
                        throw new Error('Error al obtener datos históricos');
                    }

                    const data = await response.json();
                    setHistoricalData(data);
                } catch (err) {
                    console.error('Error loading historical data:', err);
                    setError(err.message);
                } finally {
                    setLoadingData(false);
                }
            }
        }
        setIsExpanded(!isExpanded);
    };

    return (
        <>
            {/* Fila principal con toda la info de la posición */}
            <tr
                draggable="true"
                onDragStart={(e) => onDragStart(e, positionKey)}
                onDragEnd={onDragEnd}
                onDragOver={onDragOver}
                onDrop={(e) => onDrop(e, positionKey, allPositionKeys)}
                className={`position-row ${draggedPosition === positionKey ? 'dragging' : ''}`}
            >
                <td>
                    <div
                        onClick={toggleExpand}
                        style={{
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            userSelect: 'none'
                        }}
                        title="Haz clic para ver el gráfico de 30 días"
                    >
                        <span style={{
                            fontSize: '12px',
                            color: theme === 'dark' ? '#60a5fa' : '#3b82f6',
                            transition: 'transform 0.2s'
                        }}>
                            {isExpanded ? '▼' : '▶'}
                        </span>
                        <div>
                            <div>{company}</div>
                            {symbol && (
                                <div style={{ fontSize: '11px', color: '#888' }}>{symbol}</div>
                            )}
                        </div>
                    </div>
                </td>
                <td>{position.shares}</td>
                <td>€{(position.totalCost || 0).toFixed(2)}</td>
                <td>{formatCurrency(avgCostPerShare, position.currency)}</td>
                <td>
                    {currentPriceData ? (
                        <div>
                            <div style={{ fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <span>{currency === 'EUR' ? '€' : '$'}{formatPrice(currentPriceData.price)}</span>
                                {(() => {
                                    const src = currentPriceData.source;
                                    const url = src === 'finnhub' ? 'https://finnhub.io/static/img/webp/finnhub-logo.webp' : (src === 'yahoo' ? 'https://raw.githubusercontent.com/edent/SuperTinyIcons/1ee09df265d2f3764c28b1404dd0d7264c37472d/images/svg/yahoo.svg' : null);
                                    const title = src ? `${src.toUpperCase()}${currentPriceData.updatedAt ? ` • ${new Date(currentPriceData.updatedAt).toLocaleString('es-ES', { hour12: false })}` : ''}` : '';
                                    if (url) {
                                        return (
                                            <img src={url} alt={src} title={title} referrerPolicy="no-referrer" loading="eager" style={{ width: '16px', height: '16px', verticalAlign: 'middle' }} />
                                        );
                                    }
                                    return null;
                                })()}
                            </div>
                            {currentPriceData.change !== null && (
                                <div style={{
                                    fontSize: '12px',
                                    color: currentPriceData.change >= 0 ? '#10b981' : '#ef4444',
                                    whiteSpace: 'nowrap'
                                }}>
                                    {currentPriceData.change >= 0 ? '+' : ''}{formatPrice(currentPriceData.change)} ({currentPriceData.changePercent >= 0 ? '+' : ''}{currentPriceData.changePercent.toFixed(2)}%)
                                </div>
                            )}
                        </div>
                    ) : <span style={{ color: '#888', fontSize: '12px' }}>Sin datos</span>}
                </td>
                <td>{currentValueInEUR !== null ? `€${currentValueInEUR.toFixed(2)}` : '-'}</td>
                <td className={profitLossInEUR >= 0 ? 'gain' : 'loss'}>
                    {profitLossInEUR !== null ? `€${profitLossInEUR.toFixed(2)}` : '-'}
                </td>
                <td className={profitLossPercent >= 0 ? 'gain' : 'loss'}>
                    {profitLossPercent !== null ? `${profitLossPercent.toFixed(2)}%` : '-'}
                </td>
                <td>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button
                            className="button"
                            onClick={() => onNoteClick(positionKey)}
                            style={{ fontSize: '12px', padding: '5px 8px' }}
                            title="Nota"
                        >
                            📝 Nota
                        </button>
                    </div>
                </td>
            </tr>

            {/* Fila expandida con gráfico */}
            {isExpanded && (
                <tr className="expanded-chart-row">
                    <td colSpan="9">
                        {loadingData ? (
                            <div style={{
                                padding: '30px',
                                textAlign: 'center',
                                backgroundColor: theme === 'dark' ? '#1a1a1a' : '#f8f8f8'
                            }}>
                                <div className="loading-spinner"></div>
                                <p style={{ marginTop: '10px', color: '#888' }}>Cargando datos históricos...</p>
                            </div>
                        ) : error ? (
                            <div style={{
                                padding: '20px',
                                textAlign: 'center',
                                backgroundColor: theme === 'dark' ? '#1a1a1a' : '#f8f8f8',
                                color: '#ef4444'
                            }}>
                                ⚠️ {error}
                            </div>
                        ) : historicalData && historicalData.length > 0 ? (
                            <>
                                <div style={{ textAlign: 'right', padding: '0 20px 10px 0' }}>
                                    <button
                                        onClick={() => setChartType('line')}
                                        style={{
                                            marginRight: '5px',
                                            padding: '5px 10px',
                                            backgroundColor: chartType === 'line' ? '#60a5fa' : (theme === 'dark' ? '#333' : '#eee'),
                                            color: chartType === 'line' ? '#fff' : (theme === 'dark' ? '#fff' : '#333'),
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Línea
                                    </button>
                                    <button
                                        onClick={() => setChartType('candlestick')}
                                        style={{
                                            padding: '5px 10px',
                                            backgroundColor: chartType === 'candlestick' ? '#60a5fa' : (theme === 'dark' ? '#333' : '#eee'),
                                            color: chartType === 'candlestick' ? '#fff' : (theme === 'dark' ? '#fff' : '#333'),
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Velas
                                    </button>
                                </div>
                                <HistoricalChart
                                    data={historicalData}
                                    company={company}
                                    symbol={symbol}
                                    currency={currency}
                                    theme={theme}
                                    chartType={chartType} // Pasar el tipo de gráfico seleccionado
                                />
                            </>
                        ) : (
                            <div style={{
                                padding: '20px',
                                textAlign: 'center',
                                backgroundColor: theme === 'dark' ? '#1a1a1a' : '#f8f8f8',
                                color: '#888'
                            }}>
                                No hay datos históricos disponibles para esta acción
                            </div>
                        )}
                    </td>
                </tr>
            )}
        </>
    );
}

export default ExpandablePositionRow;
