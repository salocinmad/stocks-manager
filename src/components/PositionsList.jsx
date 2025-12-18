import React, { useState } from 'react'
import StockHistoryChart from './StockHistoryChart.jsx'
import PositionCard from './PositionCard.jsx'
import { notesAPI } from '../services/api.js'
import { formatPriceChange } from '../utils/formatters';

export default function PositionsList({
  activePositions,
  currentPrices,
  operations,
  theme,
  formatPrice,
  formatCurrency,
  openModal,
  currentEURUSD,
  currentPortfolioId,
  userId,
  externalButtons,
  handleDragStart,
  handleDragEnd,
  handleDragOver,
  handleDrop,
  draggedPosition,
  setNotePositionKey,
  setShowNoteModal,
  setNoteLoading,
  setNoteContent,
  setNoteOriginalContent,
  setNoteEditMode,
  setNotesCache
}) {
  const [expandedPositions, setExpandedPositions] = useState({})

  // Función para obtener solo las operaciones editables de una posición
  // Solo muestra operaciones que contribuyen al saldo actual (después del último cierre)
  const getEditableOperations = (companyOperations, currentShares) => {
    // Si no hay acciones actuales, no hay operaciones editables
    if (!currentShares || currentShares === 0) return []

    // Ordenar operaciones cronológicamente (por fecha, luego por ID)
    const sorted = [...companyOperations].sort((a, b) => {
      const dateCompare = new Date(a.date) - new Date(b.date)
      if (dateCompare !== 0) return dateCompare
      return (a.id || 0) - (b.id || 0)
    })

    // Encontrar el último punto donde el número de acciones llegó a 0
    let lastZeroIndex = -1
    let runningShares = 0

    sorted.forEach((op, index) => {
      const shares = parseInt(op.shares) || 0
      if (op.type === 'purchase') {
        runningShares += shares
      } else if (op.type === 'sale') {
        runningShares -= shares
      }

      // Si llegamos a 0 acciones, marcamos este índice
      if (runningShares === 0) {
        lastZeroIndex = index
      }
    })

    // Solo devolver operaciones después del último cierre (índice + 1)
    return sorted.slice(lastZeroIndex + 1)
  }

  // Preparar datos de todas las posiciones
  const positionsData = Object.entries(activePositions).map(([positionKey, position]) => {
    const [company, symbol = ''] = positionKey.split('|||')
    const currency = position.currency || 'EUR'
    const companyOperations = operations.filter(op => {
      const opKey = op.symbol ? `${op.company}|||${op.symbol}` : op.company
      return opKey === positionKey
    })

    const purchases = companyOperations.filter(op => op.type === 'purchase')
    const weightedExchangeRatePurchase = (() => {
      let totalShares = 0
      let totalExchangeRateWeighted = 0
      purchases.forEach(purchase => {
        totalShares += purchase.shares
        totalExchangeRateWeighted += purchase.shares * (purchase.exchangeRate || 1)
      })
      return totalShares > 0 ? (totalExchangeRateWeighted / totalShares) : (purchases[0]?.exchangeRate || 1)
    })()

    const avgCostPerShare = position.shares > 0
      ? (position.totalOriginalCost / position.shares)
      : 0

    const currentPriceData = currentPrices[positionKey]
    let currentValueInBaseCurrency = null
    let currentValueInEUR = null
    let profitLossInEUR = null
    let profitLossPercent = null

    if (currentPriceData) {
      currentValueInBaseCurrency = position.shares * currentPriceData.price
      if (currency === 'EUR') {
        currentValueInEUR = currentValueInBaseCurrency
      } else if (currency === 'USD') {
        const eurPerUsd = currentEURUSD || 0.92
        currentValueInEUR = currentValueInBaseCurrency * eurPerUsd
      } else {
        currentValueInEUR = currentValueInBaseCurrency * weightedExchangeRatePurchase
      }
      profitLossInEUR = currentValueInEUR - position.totalCost
      profitLossPercent = position.totalCost > 0
        ? (profitLossInEUR / position.totalCost) * 100
        : 0
    }

    const firstTargetPrice = purchases.length > 0 ? purchases.sort((a, b) => new Date(b.date) - new Date(a.date))[0].targetPrice : null

    return {
      positionKey,
      position,
      company,
      symbol,
      currency,
      companyOperations,
      avgCostPerShare,
      currentPriceData,
      currentValueInEUR,
      profitLossInEUR,
      profitLossPercent,
      weightedExchangeRatePurchase,
      firstTargetPrice
    }
  })

  return (
    <>
      {/* ============ VISTA MÓVIL (Tarjetas) ============ */}
      <div className="positions-cards-container mobile-view-only">
        {positionsData.map(({
          positionKey, position, company, symbol, avgCostPerShare,
          currentPriceData, currentValueInEUR, profitLossInEUR, profitLossPercent,
          companyOperations
        }) => (
          <PositionCard
            key={positionKey}
            positionKey={positionKey}
            position={position}
            currentPriceData={currentPriceData}
            profitLossInEUR={profitLossInEUR}
            profitLossPercent={profitLossPercent}
            currentValueInEUR={currentValueInEUR}
            avgCostPerShare={avgCostPerShare}
            theme={theme}
            formatPrice={formatPrice}
            formatCurrency={formatCurrency}
            isExpanded={expandedPositions[positionKey]}
            externalButtons={externalButtons}
            companyOperations={companyOperations}
            onExpand={() => setExpandedPositions(prev => ({
              ...prev,
              [positionKey]: !prev[positionKey]
            }))}

          >
            {/* Gráfico expandido */}
            <StockHistoryChart
              positionKey={positionKey}
              userId={userId}
              portfolioId={currentPortfolioId}
              theme={theme}
            />
          </PositionCard>
        ))}
      </div>

      {/* ============ VISTA DESKTOP (Tabla) ============ */}
      <div className="desktop-view-only">
        <table className="table">
          <thead>
            <tr>
              <th style={{ paddingLeft: '40px' }}>Activo</th>
              <th>Acciones</th>
              <th>Coste Total</th>
              <th>Coste Prom.</th>
              <th>Precio Mercado</th>
              <th>Valor Posición</th>
              <th>Rentabilidad</th>
              <th>Objetivo</th>
              <th>Enlaces</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {positionsData.map(({
              positionKey, position, company, symbol, currency, companyOperations,
              avgCostPerShare, currentPriceData, currentValueInEUR, profitLossInEUR,
              profitLossPercent, weightedExchangeRatePurchase, firstTargetPrice
            }) => {
              const isProfit = profitLossInEUR >= 0;
              return (
                <React.Fragment key={positionKey}>
                  <tr
                    draggable="true"
                    onDragStart={(e) => handleDragStart(e, positionKey)}
                    onDragEnd={handleDragEnd}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, positionKey, Object.keys(activePositions))}
                    className={`position-row premium-row ${draggedPosition === positionKey ? 'dragging' : ''}`}
                  >
                    <td style={{ minWidth: '200px' }}>
                      <div
                        onClick={(e) => {
                          e.stopPropagation()
                          setExpandedPositions(prev => ({
                            ...prev,
                            [positionKey]: !prev[positionKey]
                          }))
                        }}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}
                      >
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '18px', height: '18px',
                          transform: expandedPositions[positionKey] ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease'
                        }}>
                          ▼
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: '600', fontSize: '15px' }}>{company}</span>
                          {symbol && <span className="symbol-tag" style={{ alignSelf: 'flex-start', marginTop: '4px' }}>{symbol}</span>}
                        </div>
                      </div>
                    </td>
                    <td style={{ fontWeight: '500' }}>{position.shares}</td>
                    <td style={{ opacity: 0.9 }}>€{position.totalCost.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style={{ fontSize: '13px', color: '#888' }}>{formatCurrency(avgCostPerShare, position.currency)}</td>
                    <td>
                      {currentPriceData ? (
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <div style={{ fontWeight: '700', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>{currency === 'EUR' ? '€' : '$'}{formatPrice(currentPriceData.price)}</span>
                            {(() => {
                              const src = currentPriceData.source
                              const url = src === 'finnhub' ? 'https://finnhub.io/static/img/webp/finnhub-logo.webp' : (src === 'yahoo' ? 'https://raw.githubusercontent.com/edent/SuperTinyIcons/1ee09df265d2f3764c28b1404dd0d7264c37472d/images/svg/yahoo.svg' : null)
                              if (url) return <img src={url} alt={src} style={{ width: '14px', height: '14px', opacity: 0.6 }} />
                              return null
                            })()}
                          </div>
                          {currentPriceData.change !== null && (
                            <div style={{
                              fontSize: '11px',
                              fontWeight: '600',
                              color: currentPriceData.change >= 0 ? '#10b981' : '#ef4444',
                            }}>
                              {currentPriceData.change >= 0 ? '▲' : '▼'} {Math.abs(currentPriceData.changePercent).toFixed(2)}%
                            </div>
                          )}
                        </div>
                      ) : <span style={{ color: '#888', fontSize: '12px' }}>-</span>}
                    </td>
                    <td style={{ fontWeight: '600' }}>
                      {currentValueInEUR !== null ? (
                        `€${currentValueInEUR.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      ) : '-'}
                    </td>
                    <td>
                      {profitLossInEUR !== null ? (
                        <div className={`badge ${isProfit ? 'badge-success' : 'badge-danger'}`}>
                          {isProfit ? '+' : ''}{profitLossPercent.toFixed(2)}%
                          <span style={{ marginLeft: '6px', fontSize: '11px', fontWeight: '400', opacity: 0.8 }}>
                            ({isProfit ? '+' : ''}€{Math.abs(profitLossInEUR).toFixed(2)})
                          </span>
                        </div>
                      ) : '-'}
                    </td>
                    <td>
                      {firstTargetPrice !== null && firstTargetPrice !== undefined ? (
                        <div style={{ fontWeight: '600', color: '#3b82f6', fontSize: '13px' }}>
                          {currency === 'EUR' ? '€' : '$'}{formatPrice(firstTargetPrice)}
                        </div>
                      ) : <span style={{ color: '#888' }}>-</span>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {/* Yahoo Finance */}
                        {symbol && (
                          <a href={`https://es.finance.yahoo.com/quote/${symbol.replace(/:/g, '.')}/`} target="_blank" rel="noopener noreferrer" title="Yahoo Finance">
                            <img src="/yahoo.svg" alt="Yahoo" style={{ width: '18px', height: '18px', borderRadius: '4px', filter: theme === 'dark' ? 'none' : 'grayscale(0.2)' }} />
                          </a>
                        )}
                        {/* Custom Buttons */}
                        {externalButtons.sort((a, b) => a.displayOrder - b.displayOrder).map((button, idx) => {
                          const externalSymbolField = `externalSymbol${idx + 1}`
                          const op = companyOperations.find(o => o[externalSymbolField])
                          const externalSymbol = op?.[externalSymbolField]
                          if (!externalSymbol) return null
                          return (
                            <a key={button.id} href={button.baseUrl.replace('{symbol}', encodeURIComponent(externalSymbol))} target="_blank" rel="noopener noreferrer" title={button.name}>
                              {button.imageUrl ? (
                                <img src={button.imageUrl} alt={button.name} style={{ width: '18px', height: '18px', borderRadius: '4px', objectFit: 'cover' }} />
                              ) : <span style={{ fontSize: '16px' }}>{button.emoji || '🔗'}</span>}
                            </a>
                          )
                        })}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {getEditableOperations(companyOperations, position.shares).slice(0, 1).map((operation) => (
                          <button key={operation.id} className="action-btn-minimal" onClick={() => openModal(operation.type, operation)}>
                            ✏️ {operation.type === 'purchase' ? 'C' : 'V'}
                          </button>
                        ))}
                        <button
                          className="action-btn-minimal"
                          onClick={async () => {
                            const pk = positionKey; setNotePositionKey(pk); setShowNoteModal(true); setNoteLoading(true);
                            try {
                              const r = await notesAPI.get(pk); const content = r?.content || '';
                              setNoteContent(content); setNoteOriginalContent(content); setNoteEditMode(!content || content.trim() === '');
                              setNotesCache(prev => ({ ...prev, [pk]: !!content }));
                            } catch (e) {
                              setNoteContent(''); setNoteOriginalContent(''); setNoteEditMode(true);
                            } finally { setNoteLoading(false); }
                          }}
                        >
                          📝 Nota
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedPositions[positionKey] && (
                    <tr className="expanded-chart-row">
                      <td colSpan="10" style={{ padding: '10px', backgroundColor: theme === 'dark' ? '#111' : '#f8fafc' }}>
                        <div style={{ border: '1px solid #333', borderRadius: '8px', overflow: 'hidden' }}>
                          <StockHistoryChart positionKey={positionKey} userId={userId} portfolioId={currentPortfolioId} theme={theme} />
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
