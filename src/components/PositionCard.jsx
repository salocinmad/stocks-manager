import React, { useState, useEffect, useRef } from 'react';
import { formatPriceChange } from '../utils/formatters';
import './PositionCard.css';

/**
 * Componente de tarjeta para mostrar una posición en vista móvil.
 * Muestra: Empresa, Acciones, Precio Actual (con cambio), Ganancia/Pérdida
 * Expandible para mostrar gráficos y datos adicionales.
 */
const PositionCard = ({
    positionKey,
    position,
    currentPriceData,
    profitLossInEUR,
    profitLossPercent,
    currentValueInEUR,
    avgCostPerShare,
    theme,
    formatPrice,
    formatCurrency,
    onExpand,
    isExpanded,
    externalButtons = [],
    companyOperations = [],
    children
}) => {
    const [company, symbol = ''] = positionKey.split('|||');
    const prevPriceRef = useRef(currentPriceData?.price);
    const [flashClass, setFlashClass] = useState('');

    useEffect(() => {
        if (currentPriceData?.price !== undefined && prevPriceRef.current !== undefined) {
            if (currentPriceData.price > prevPriceRef.current) {
                setFlashClass('price-up-flash');
            } else if (currentPriceData.price < prevPriceRef.current) {
                setFlashClass('price-down-flash');
            }
            if (currentPriceData.price !== prevPriceRef.current) {
                const timer = setTimeout(() => setFlashClass(''), 1500);
                prevPriceRef.current = currentPriceData.price;
                return () => clearTimeout(timer);
            }
        }
        prevPriceRef.current = currentPriceData?.price;
    }, [currentPriceData?.price]);

    // Determinar si el precio subió o bajó
    const priceChange = currentPriceData?.change || 0;
    const priceChangePercent = currentPriceData?.changePercent || 0;
    const isPriceUp = priceChange >= 0;

    // Determinar si hay ganancia o pérdida
    const isProfit = profitLossInEUR !== null && profitLossInEUR >= 0;

    return (
        <div className={`position-card ${theme} ${flashClass}`}>
            {/* Cabecera de la tarjeta */}
            <div className="position-card-header" onClick={onExpand} style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="position-card-title">
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                        <span className="position-card-company" style={{
                            fontSize: '15px',
                            fontWeight: '700',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                        }}>
                            {company}
                        </span>
                        {symbol && <span className="symbol-tag" style={{ width: 'fit-content', marginTop: '2px' }}>{symbol}</span>}
                    </div>
                    {symbol && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                            {/* Botón Yahoo por defecto */}
                            <a
                                href={`https://es.finance.yahoo.com/quote/${symbol.replace(/:/g, '.')}/`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                style={{ display: 'flex', alignItems: 'center', opacity: 0.9 }}
                                title="Yahoo Finance"
                            >
                                <img
                                    src="/yahoo.svg"
                                    alt="Yahoo Finance"
                                    style={{ width: '20px', height: '20px', borderRadius: '4px' }}
                                />
                            </a>

                            {/* Botones personalizados */}
                            {externalButtons.sort((a, b) => a.displayOrder - b.displayOrder).map((button, idx) => {
                                const externalSymbolField = `externalSymbol${idx + 1}`
                                const op = companyOperations.find(o => o[externalSymbolField])
                                const externalSymbol = op?.[externalSymbolField]
                                if (!externalSymbol) return null
                                const finalUrl = button.baseUrl.replace('{symbol}', encodeURIComponent(externalSymbol))
                                return (
                                    <a
                                        key={button.id}
                                        href={finalUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        title={`${button.name}: ${externalSymbol}`}
                                        style={{ display: 'flex', alignItems: 'center', opacity: 0.9 }}
                                    >
                                        {button.imageUrl ? (
                                            <img
                                                src={button.imageUrl} alt={button.name}
                                                style={{ width: '20px', height: '20px', borderRadius: '4px', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)' }}
                                            />
                                        ) : (
                                            <span style={{ fontSize: '18px' }}>{button.emoji || '🔗'}</span>
                                        )}
                                    </a>
                                )
                            })}
                        </div>
                    )}
                </div>
                <div style={{ color: '#666', fontSize: '18px', transition: 'transform 0.3s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                    ▼
                </div>
            </div>

            {/* Cuerpo de la tarjeta */}
            <div className="position-card-body">
                {/* Primera fila: Acciones y Precio Actual */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span className="position-card-label">Acciones</span>
                        <span style={{ fontWeight: '600', fontSize: '16px' }}>{position.shares}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <span className="position-card-label">Precio Mercado</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontWeight: '700', fontSize: '18px' }}>
                                {currentPriceData
                                    ? `${currentPriceData.currency === 'USD' ? '$' : '€'}${formatPrice(currentPriceData.price)}`
                                    : '-'
                                }
                            </span>
                            {currentPriceData && (() => {
                                const src = (currentPriceData.source || '').toLowerCase()
                                const isFinnhub = src.includes('finnhub')
                                const isYahoo = src.includes('yahoo')
                                return (
                                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                        {isFinnhub && (
                                            <img
                                                src="https://finnhub.io/static/img/webp/finnhub-logo.webp"
                                                alt="Finnhub"
                                                title="Precio Real Time (Finnhub)"
                                                style={{ width: '12px', height: '12px', opacity: 0.8 }}
                                            />
                                        )}
                                        {isYahoo && (
                                            <img
                                                src="https://raw.githubusercontent.com/edent/SuperTinyIcons/1ee09df265d2f3764c28b1404dd0d7264c37472d/images/svg/yahoo.svg"
                                                alt="Yahoo"
                                                title="Precio Yahoo Finance"
                                                style={{ width: '12px', height: '12px', opacity: 0.8 }}
                                            />
                                        )}
                                    </div>
                                )
                            })()}
                        </div>
                        {currentPriceData && (
                            <span style={{
                                fontSize: '11px',
                                fontWeight: '600',
                                color: currentPriceData.change >= 0 ? '#10b981' : '#ef4444'
                            }}>
                                {currentPriceData.change >= 0 ? '▲' : '▼'} {Math.abs(currentPriceData.changePercent).toFixed(2)}%
                            </span>
                        )}
                    </div>
                </div>

                {/* Segunda fila: Valor y Rentabilidad */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span className="position-card-label">Valor Posición</span>
                        <span style={{ fontWeight: '600' }}>
                            {currentValueInEUR !== null ? `€${currentValueInEUR.toFixed(2)}` : '-'}
                        </span>
                    </div>
                    <div>
                        {profitLossInEUR !== null ? (
                            <div className={`badge ${isProfit ? 'badge-success' : 'badge-danger'}`} style={{ padding: '6px 12px' }}>
                                {isProfit ? '+' : ''}{profitLossPercent.toFixed(2)}%
                                <span style={{ marginLeft: '6px', fontSize: '11px', opacity: 0.8, fontWeight: '400' }}>
                                    (€{Math.abs(profitLossInEUR).toFixed(2)})
                                </span>
                            </div>
                        ) : '-'}
                    </div>
                </div>
            </div>

            {/* Contenido expandido */}
            {isExpanded && (
                <div className="position-card-expanded">
                    {/* Datos adicionales */}
                    <div className="position-card-extra">
                        <div className="position-card-row">
                            <span className="position-card-label">Valor Actual:</span>
                            <span className="position-card-value">
                                {currentValueInEUR !== null ? `€${currentValueInEUR.toFixed(2)}` : '-'}
                            </span>
                        </div>
                        <div className="position-card-row">
                            <span className="position-card-label">Coste Promedio:</span>
                            <span className="position-card-value">
                                €{avgCostPerShare.toFixed(2)}
                            </span>
                        </div>
                    </div>
                    {/* Gráficos y contenido adicional */}
                    {children}
                </div>
            )}
        </div>
    );
};

export default PositionCard;
