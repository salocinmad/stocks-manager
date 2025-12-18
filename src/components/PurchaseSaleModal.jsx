import React, { useState, useEffect } from 'react'

export default function PurchaseSaleModal({
  isOpen,
  theme,
  modalType,
  editingOperation,
  formData,
  setFormData,
  handleInputChange,
  handleSubmit,
  closeModal,
  searchQuery,
  setSearchQuery,
  searchResults,
  setSearchResults,
  loadingSearch,
  searchCompanies,
  formatPrice,
  currentPrice,
  loadingPrice,
  priceError,
  fetchCurrentPrice,
  getPositions,
  selectCompany,
  externalButtons,
  showSuggestions,
  setShowSuggestions
}) {


  if (!isOpen) return null

  return (
    <div className="modal">
      <div className="modal-content">
        <h2>{editingOperation ? `Editar ${modalType === 'purchase' ? 'Compra' : 'Venta'}` : `${modalType === 'purchase' ? 'Nueva Compra' : 'Nueva Venta'}`}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Buscar Empresa por Nombre:</label>
            <div className="search-container" style={{ position: 'relative' }}>
              <input
                type="text"
                className="input"
                placeholder="Busca por nombre (ej: Apple, Microsoft, AMD, NXT...)"
                value={searchQuery}
                onChange={(e) => {
                  const query = e.target.value
                  setSearchQuery(query)
                  if (query.length >= 2) {
                    searchCompanies(query)
                  } else {
                    setSearchResults([])
                  }
                }}

              />
              {loadingSearch && (
                <span style={{ position: 'absolute', right: '10px', top: '10px' }}>⏳</span>
              )}
              {showSuggestions && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: theme === 'dark' ? '#2d2d2d' : '#ffffff', border: `1px solid ${theme === 'dark' ? '#404040' : '#d0d0d0'}`, borderRadius: '4px', marginTop: '5px', maxHeight: '300px', overflowY: 'auto', zIndex: 1000, boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                  {loadingSearch && <div style={{ padding: '10px', textAlign: 'center' }}>Cargando...</div>}
                  {!loadingSearch && searchResults.length === 0 && searchQuery.length >= 2 && <div style={{ padding: '10px', textAlign: 'center' }}>No se encontraron resultados.</div>}
                  {!loadingSearch && searchResults.length > 0 && searchResults.map((company, index) => (
                    <div
                      key={index}
                      onClick={() => selectCompany(company)}
                      style={{ padding: '10px', cursor: 'pointer', borderBottom: `1px solid ${theme === 'dark' ? '#404040' : '#e0e0e0'}`, transition: 'background-color 0.2s' }}
                      onMouseEnter={(e) => { e.target.style.backgroundColor = theme === 'dark' ? '#404040' : '#f0f0f0' }}
                      onMouseLeave={(e) => { e.target.style.backgroundColor = 'transparent' }}
                    >
                      <div style={{ fontWeight: 'bold' }}>{company.description || company.symbol.split('.')[0] || company.symbol}</div>
                      <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>
                        <strong>{company.symbol.includes('.') ? company.symbol.replace('.', ':') : company.symbol}</strong>
                        {company.exchange && company.exchange !== company.symbol.split('.')[1] && ` · ${company.exchange}`}
                        {company.type && ` · ${company.type}`}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <p style={{ fontSize: '12px', color: '#888', marginTop: '5px' }}>O ingresa directamente el símbolo con exchange: AMD:FRA, NXT:BME, MSFT:NASDAQ, etc.</p>
          </div>

          <div className="form-row">
            <div className="form-group" style={{ flex: 2 }}>
              <label>Empresa:</label>
              <input type="text" name="company" value={formData.company} onChange={handleInputChange} className="input" placeholder="Nombre de la empresa" required />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Símbolo (Ticker):</label>
              <div style={{ display: 'flex', gap: '5px' }}>
                <input type="text" id="ticker-symbol" className="input" placeholder="AAPL, MSFT:NASDAQ, AMD:FRA..." style={{ flex: 1 }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const symbol = e.target.value; if (symbol) fetchCurrentPrice(symbol) } }} />
                <button type="button" className="button primary" onClick={() => { const symbol = document.getElementById('ticker-symbol')?.value; if (symbol) fetchCurrentPrice(symbol) }} disabled={loadingPrice} style={{ whiteSpace: 'nowrap' }} title="Consultar precio actual desde Finnhub">{loadingPrice ? '⏳' : '🔍'}</button>
              </div>
            </div>
          </div>

          {currentPrice && !editingOperation && (
            <div style={{ padding: '10px', marginBottom: '10px', backgroundColor: '#28a745', borderRadius: '4px', color: 'white' }}>
              <strong>Precio actual consultado:</strong> ${formatPrice(currentPrice.price)}
              {currentPrice.change !== null && (
                <span style={{ marginLeft: '10px' }}>
                  ({currentPrice.change >= 0 ? '+' : ''}{formatPrice(currentPrice.change)} ({currentPrice.changePercent >= 0 ? '+' : ''}{currentPrice.changePercent.toFixed(2)}%))
                </span>
              )}
            </div>
          )}

          {priceError && (
            <div style={{ padding: '10px', marginBottom: '10px', backgroundColor: '#dc3545', borderRadius: '4px', color: 'white' }}>
              <strong>Error:</strong> {priceError}
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label>Número de Títulos:</label>
              {modalType === 'sale' && formData.company && (() => {
                const positions = getPositions()
                const availableShares = positions[formData.company]?.shares || 0
                return (
                  <div style={{ marginBottom: '5px', fontSize: '12px', color: '#888' }}>
                    Acciones disponibles: <strong>{availableShares}</strong>
                    {availableShares > 0 && (
                      <span style={{ marginLeft: '10px', color: '#007bff' }}>(Puedes vender menos acciones)</span>
                    )}
                  </div>
                )
              })()}
              <input type="number" name="shares" value={formData.shares} onChange={handleInputChange} className="input" min="1" required />
            </div>
            <div className="form-group">
              <label>Precio por Acción:</label>
              <input type="number" name="price" value={formData.price} onChange={handleInputChange} className="input" step="0.00000001" min="0" required placeholder={currentPrice ? `Precio consultado: ${formatPrice(currentPrice.price)}` : ''} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Moneda:</label>
              <select name="currency" value={formData.currency} onChange={handleInputChange} className="input">
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
                <option value="CAD">CAD</option>
                <option value="JPY">JPY</option>
              </select>
            </div>
            {formData.currency !== 'EUR' && (
              <div className="form-group">
                <label>Tipo de Cambio (EUR/{formData.currency}):</label>
                <input type="number" name="exchangeRate" value={formData.exchangeRate} onChange={handleInputChange} className="input" step="0.000000000001" min="0" required />
              </div>
            )}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Comisiones:</label>
              <input type="number" name="commission" value={formData.commission} onChange={handleInputChange} className="input" step="0.00000001" min="0" />
            </div>
            <div className="form-group">
              <label>Fecha:</label>
              <input type="date" name="date" value={formData.date} onChange={handleInputChange} className="input" required />
            </div>
          </div>

          {externalButtons.length > 0 && (
            <div className="form-row">
              {externalButtons.sort((a, b) => a.displayOrder - b.displayOrder).map(button => (
                <div key={button.id} className="form-group" style={{ flex: 1 }}>
                  <label>{button.name}:</label>
                  <input type="text" name={`externalSymbol${button.displayOrder}`} value={formData[`externalSymbol${button.displayOrder}`] || ''} onChange={handleInputChange} className="input" placeholder="Símbolo" />
                </div>
              ))}
            </div>
          )}
          <div className="form-row">
            <div className="form-group">
              <label>Precio Objetivo (Opcional):</label>
              <input type="number" name="targetPrice" value={formData.targetPrice || ''} onChange={handleInputChange} className="input" step="0.00000001" min="0" placeholder="Precio al que esperas vender" />
              <p style={{ fontSize: '12px', color: '#888', marginTop: '5px' }}>Precio objetivo al que planeas vender la acción</p>
            </div>
            <div className="form-group">
              <label>Precio Stop Loss (Opcional):</label>
              <input type="number" name="stopLossPrice" value={formData.stopLossPrice || ''} onChange={handleInputChange} className="input" step="0.00000001" min="0" placeholder="Umbral de alerta" />
              <p style={{ fontSize: '12px', color: '#888', marginTop: '5px' }}>Avisar si el precio cruza este umbral (alza o baja)</p>
            </div>
          </div>

          <div style={{ marginTop: '20px' }}>
            <button type="submit" className={`button ${modalType === 'purchase' ? 'success' : 'danger'}`}>{editingOperation ? 'Guardar Cambios' : (modalType === 'purchase' ? 'Comprar' : 'Vender')}</button>
            <button type="button" className="button" onClick={closeModal}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  )
}

