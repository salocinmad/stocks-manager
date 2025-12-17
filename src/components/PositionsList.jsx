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
          currentPriceData, currentValueInEUR, profitLossInEUR, profitLossPercent
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
              <th>Empresa</th>
              <th>Acciones</th>
              <th>Coste Total (EUR)</th>
              <th>Coste Promedio</th>
              <th>Precio Actual</th>
              <th>Valor Actual (EUR)</th>
              <th>Ganancia pérdida</th>
              <th>Precio Objetivo</th>
              <th>Info</th>
              <th>Editar</th>
            </tr>
          </thead>
          <tbody>
            {positionsData.map(({
              positionKey, position, company, symbol, currency, companyOperations,
              avgCostPerShare, currentPriceData, currentValueInEUR, profitLossInEUR,
              profitLossPercent, weightedExchangeRatePurchase, firstTargetPrice
            }) => {
              return (
                <React.Fragment key={positionKey}>
                  <tr
                    draggable="true"
                    onDragStart={(e) => handleDragStart(e, positionKey)}
                    onDragEnd={handleDragEnd}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, positionKey, Object.keys(activePositions))}
                    className={`position-row ${draggedPosition === positionKey ? 'dragging' : ''}`}
                  >
                    <td>
                      <div
                        onClick={(e) => {
                          e.stopPropagation()
                          setExpandedPositions(prev => ({
                            ...prev,
                            [positionKey]: !prev[positionKey]
                          }))
                        }}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', userSelect: 'none' }}
                      >
                        <span style={{
                          display: 'inline-block', width: '0', height: '0', borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '6px solid currentColor',
                          transform: expandedPositions[positionKey] ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s ease', opacity: 0.7
                        }}></span>
                        <span style={{ fontWeight: 'bold' }}>{company}</span>
                      </div>
                      {symbol && (
                        <div style={{ fontSize: '11px', color: '#888' }}>{symbol}</div>
                      )}
                    </td>
                    <td>{position.shares}</td>
                    <td>€{position.totalCost.toFixed(2)}</td>
                    <td>{formatCurrency(avgCostPerShare, position.currency)}</td>
                    <td>
                      {currentPriceData ? (
                        <div>
                          <div style={{ fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <span>{currency === 'EUR' ? '€' : '$'}{formatPrice(currentPriceData.price)}</span>
                            {(() => {
                              const src = currentPriceData.source
                              const url = src === 'finnhub' ? 'https://finnhub.io/static/img/webp/finnhub-logo.webp' : (src === 'yahoo' ? 'https://raw.githubusercontent.com/edent/SuperTinyIcons/1ee09df265d2f3764c28b1404dd0d7264c37472d/images/svg/yahoo.svg' : null)
                              const title = src ? `${src.toUpperCase()}${currentPriceData.updatedAt ? ` • ${new Date(currentPriceData.updatedAt).toLocaleString('es-ES', { hour12: false })}` : ''}` : ''
                              if (url) {
                                return (
                                  <img src={url} alt={src} title={title} referrerPolicy="no-referrer" loading="lazy" style={{ width: '16px', height: '16px', verticalAlign: 'middle' }} />
                                )
                              }
                              return null
                            })()}
                          </div>
                          {currentPriceData.change !== null && (
                            <div style={{
                              fontSize: '12px',
                              color: currentPriceData.change >= 0 ? '#10b981' : '#ef4444',
                              whiteSpace: 'nowrap'
                            }}>
                              {currentPriceData.change >= 0 ? '+' : ''}{formatPriceChange(currentPriceData.change)} ({currentPriceData.changePercent >= 0 ? '+' : ''}{currentPriceData.changePercent.toFixed(2)}%)
                            </div>
                          )}
                        </div>
                      ) : <span style={{ color: '#888', fontSize: '12px' }}>Sin datos</span>}
                    </td>
                    <td>
                      {currentValueInEUR !== null ? (
                        `€${currentValueInEUR.toFixed(2)}`
                      ) : (
                        <span style={{ color: '#888' }}>-</span>
                      )}
                    </td>
                    <td>
                      {profitLossInEUR !== null ? (
                        <div style={{ color: profitLossInEUR >= 0 ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
                          {profitLossInEUR >= 0 ? '+' : ''}€{profitLossInEUR.toFixed(2)}
                          {profitLossPercent !== null && (
                            <div style={{ fontSize: '11px' }}>({profitLossPercent >= 0 ? '+' : ''}{profitLossPercent.toFixed(2)}%)</div>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: '#888' }}>-</span>
                      )}
                    </td>
                    <td>
                      {firstTargetPrice !== null && firstTargetPrice !== undefined
                        ? (
                          <div style={{ fontWeight: 'bold', color: '#3b82f6' }}>
                            {currency === 'EUR' ? '€' : '$'}{formatPrice(firstTargetPrice)}
                          </div>
                        )
                        : <span style={{ color: '#888' }}>-</span>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                        {externalButtons.sort((a, b) => a.displayOrder - b.displayOrder).map((button, idx) => {
                          const externalSymbolField = `externalSymbol${idx + 1}`
                          const op = companyOperations.find(o => o[externalSymbolField])
                          const externalSymbol = op?.[externalSymbolField] || symbol
                          if (!externalSymbol) return null
                          const finalUrl = button.baseUrl.replace('{symbol}', encodeURIComponent(externalSymbol))
                          return (
                            <a
                              key={button.id}
                              href={finalUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={`${button.name}: ${externalSymbol}`}
                              style={{ display: 'block' }}
                            >
                              {button.imageUrl ? (
                                <img
                                  src={button.imageUrl} alt={button.name}
                                  style={{ width: '20px', height: '20px', borderRadius: '4px', objectFit: 'cover' }}
                                />
                              ) : (
                                <span style={{ fontSize: '18px' }}>{button.emoji || '🔗'}</span>
                              )}
                            </a>
                          )
                        })}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        {getEditableOperations(companyOperations, position.shares).map((operation) => (
                          <button
                            key={operation.id}
                            className="button"
                            onClick={() => openModal(operation.type, operation)}
                            style={{ fontSize: '12px', padding: '5px 8px' }}
                            title={`Editar ${operation.type === 'purchase' ? 'compra' : 'venta'}`}
                          >
                            ✏️ {operation.type === 'purchase' ? 'C' : 'V'}
                          </button>
                        ))}
                        <button
                          className="button"
                          onClick={async () => {
                            const pk = positionKey
                            setNotePositionKey(pk)
                            setShowNoteModal(true)
                            setNoteLoading(true)
                            try {
                              const r = await notesAPI.get(pk)
                              const content = r?.content || ''
                              setNoteContent(content)
                              setNoteOriginalContent(content)
                              setNoteEditMode(!content || content.trim() === '')
                              setNotesCache(prev => ({ ...prev, [pk]: !!content }))
                            } catch (e) {
                              setNoteContent('')
                              setNoteOriginalContent('')
                              setNoteEditMode(true)
                            } finally {
                              setNoteLoading(false)
                            }
                          }}
                          style={{ fontSize: '12px', padding: '5px 8px' }}
                          title="Nota"
                        >
                          📝 Nota
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedPositions[positionKey] && (
                    <tr className="expanded-chart-row">
                      <td colSpan="10" style={{ padding: 0, backgroundColor: theme === 'dark' ? '#1a1a1a' : '#f9fafb' }}>
                        <StockHistoryChart positionKey={positionKey} userId={userId} portfolioId={currentPortfolioId} theme={theme} />
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
