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
            <div className="position-card-header" onClick={onExpand}>
                <div className="position-card-title">
                    <span className="position-card-company">{company}</span>
                    {symbol && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span className="position-card-symbol">({symbol})</span>
                            {/* Botón Yahoo por defecto */}
                            <a
                                href={`https://es.finance.yahoo.com/quote/${symbol.replace(/:/g, '.')}/`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                style={{ display: 'flex', alignItems: 'center' }}
                                title="Yahoo Finance"
                            >
                                <img
                                    src="/yahoo.svg"
                                    alt="Yahoo Finance"
                                    style={{ width: '16px', height: '16px', borderRadius: '3px' }}
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
                                        style={{ display: 'flex', alignItems: 'center' }}
                                    >
                                        {button.imageUrl ? (
                                            <img
                                                src={button.imageUrl} alt={button.name}
                                                style={{ width: '16px', height: '16px', borderRadius: '3px', objectFit: 'cover' }}
                                            />
                                        ) : (
                                            <span style={{ fontSize: '14px' }}>{button.emoji || '🔗'}</span>
                                        )}
                                    </a>
                                )
                            })}
                        </div>
                    )}
                </div>
                <button className="position-card-expand-btn">
                    {isExpanded ? '▲' : '▼'}
                </button>
            </div>

            {/* Cuerpo de la tarjeta */}
            <div className="position-card-body">
                {/* Acciones */}
                <div className="position-card-row">
                    <span className="position-card-label">Acciones:</span>
                    <span className="position-card-value">{position.shares}</span>
                </div>

                {/* Precio Actual con cambio diario */}
                <div className="position-card-row">
                    <span className="position-card-label">Precio Actual:</span>
                    <div className="position-card-price-container">
                        <span className="position-card-value">
                            {currentPriceData
                                ? `${currentPriceData.currency === 'USD' ? '$' : '€'}${formatPrice(currentPriceData.price)}`
                                : '-'
                            }
                            <span className={`position-card-indicator ${isPriceUp ? 'up' : 'down'}`}>
                                {isPriceUp ? '👍' : '👎'}
                            </span>
                        </span>
                        {currentPriceData && (
                            <span className={`position-card-change ${isPriceUp ? 'positive' : 'negative'}`}>
                                {isPriceUp ? '+' : ''}{formatPriceChange(priceChange)} ({isPriceUp ? '+' : ''}{priceChangePercent.toFixed(2)}%)
                            </span>
                        )}
                    </div>
                </div>

                {/* Ganancia/Pérdida */}
                <div className="position-card-row">
                    <span className="position-card-label">Ganancia/Pérdida:</span>
                    <div className="position-card-profit-container">
                        <span className={`position-card-value ${isProfit ? 'positive' : 'negative'}`}>
                            {profitLossInEUR !== null
                                ? `${isProfit ? '+' : ''}€${profitLossInEUR.toFixed(2)}`
                                : '-'
                            }
                        </span>
                        {profitLossPercent !== null && (
                            <span className={`position-card-change ${isProfit ? 'positive' : 'negative'}`}>
                                ({isProfit ? '+' : ''}{profitLossPercent.toFixed(2)}%)
                            </span>
                        )}
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
