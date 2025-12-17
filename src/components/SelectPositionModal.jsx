import { formatCurrency, formatPrice, formatPriceChange } from '../utils/marketUtils.js';

export default function SelectPositionModal({
    isOpen,
    onClose,
    onSelectPosition,
    positions,
    currentPrices,
    operations,
    theme
}) {
    if (!isOpen) return null;

    const positionEntries = Object.entries(positions);

    return (
        <div className="modal">
            <div className="modal-content">
                <h2>📊 Seleccionar Posición para Vender</h2>
                <p style={{ marginBottom: '20px', fontSize: '14px', color: '#888' }}>
                    Selecciona una posición activa para vender acciones. Puedes vender una cantidad parcial.
                </p>
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    {positionEntries.length === 0 ? (
                        <p>No hay posiciones activas disponibles</p>
                    ) : (
                        <div>
                            {positionEntries.map(([positionKey, position]) => {
                                const company = position.company || positionKey.split('|||')[0];
                                const symbol = position.symbol || '';

                                const companyOperations = operations.filter(op => {
                                    const opKey = op.symbol ? `${op.company}|||${op.symbol}` : op.company;
                                    return opKey === positionKey;
                                });

                                const avgCostPerShare = position.shares > 0 ? position.totalOriginalCost / position.shares : 0;
                                const currentPriceData = currentPrices[positionKey];

                                return (
                                    <div
                                        key={positionKey}
                                        onClick={() => onSelectPosition(positionKey, position.shares)}
                                        style={{
                                            padding: '15px',
                                            margin: '10px 0',
                                            border: `2px solid ${theme === 'dark' ? '#404040' : '#d0d0d0'}`,
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            backgroundColor: theme === 'dark' ? '#2d2d2d' : '#ffffff'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.borderColor = '#007bff';
                                            e.currentTarget.style.backgroundColor = theme === 'dark' ? '#404040' : '#f0f0f0';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.borderColor = theme === 'dark' ? '#404040' : '#d0d0d0';
                                            e.currentTarget.style.backgroundColor = theme === 'dark' ? '#2d2d2d' : '#ffffff';
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '5px' }}>
                                                    {company}
                                                </div>
                                                {symbol && (
                                                    <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>
                                                        {symbol}
                                                    </div>
                                                )}
                                                <div style={{ display: 'flex', gap: '15px', fontSize: '14px' }}>
                                                    <div>
                                                        <strong>Acciones disponibles:</strong> {position.shares}
                                                    </div>
                                                    <div>
                                                        <strong>Coste promedio:</strong> {formatCurrency(avgCostPerShare, position.currency)}
                                                    </div>
                                                    <div>
                                                        <strong>Coste total:</strong> €{position.totalCost.toFixed(2)}
                                                    </div>
                                                </div>
                                                {currentPriceData && (() => {
                                                    const purchases = companyOperations.filter(op => op.type === 'purchase');
                                                    let positionCurrency = 'EUR';
                                                    if (purchases.length > 0) {
                                                        const latestPurchase = purchases.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
                                                        positionCurrency = latestPurchase?.currency || 'EUR';
                                                    }
                                                    return (
                                                        <div style={{ marginTop: '8px', fontSize: '13px', color: '#888' }}>
                                                            Precio actual: <strong style={{ color: currentPriceData.change >= 0 ? '#10b981' : '#ef4444' }}>
                                                                {positionCurrency === 'EUR' ? '€' : '$'}{formatPrice(currentPriceData.price)}
                                                            </strong>
                                                            {' '}({currentPriceData.change >= 0 ? '+' : ''}{currentPriceData.changePercent.toFixed(2)}%)
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                            <div style={{ marginLeft: '15px', fontSize: '24px' }}>
                                                →
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
                <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                        type="button"
                        className="button"
                        onClick={onClose}
                    >
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    );
}
