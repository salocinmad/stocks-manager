import { formatPrice } from '../utils/marketUtils.js';

export default function OperationsHistory({
    operations,
    showHistory,
    onEditOperation,
    getHistoricalProfitLoss,
    closedOperations,
    theme
}) {
    if (showHistory) {
        return (
            <div className="card">
                <h2>📜 Histórico de Operaciones Cerradas</h2>

                {/* Resumen de Ganancias/Pérdidas */}
                {closedOperations.length > 0 && (
                    <div className="stats" style={{ marginBottom: '20px' }}>
                        <div className="stat-item">
                            <div className={`stat-value ${getHistoricalProfitLoss() >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                €{(getHistoricalProfitLoss() || 0).toFixed(2)}
                            </div>
                            <div className="stat-label">
                                {getHistoricalProfitLoss() >= 0 ? 'Ganancias Totales' : 'Pérdidas Totales'}
                            </div>
                        </div>
                        <div className="stat-item">
                            <div className="stat-value">{closedOperations.filter(op => op.type === 'sale').length}</div>
                            <div className="stat-label">Ventas Realizadas</div>
                        </div>
                        <div className="stat-item">
                            <div className="stat-value">{closedOperations.filter(op => op.type === 'purchase').length}</div>
                            <div className="stat-label">Compras Realizadas</div>
                        </div>
                        <div className="stat-item">
                            <div className="stat-value">{new Set(closedOperations.map(op => op.company)).size}</div>
                            <div className="stat-label">Empresas Cerradas</div>
                        </div>
                    </div>
                )}

                {closedOperations.length === 0 ? (
                    <p>No hay operaciones cerradas en el historial</p>
                ) : (
                    <div>
                        {closedOperations
                            .sort((a, b) => new Date(b.date) - new Date(a.date))
                            .map((operation) => (
                                <div key={operation.id} style={{
                                    padding: '10px',
                                    margin: '5px 0',
                                    border: '1px solid #404040',
                                    borderRadius: '4px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <div>
                                        <strong>{operation.type === 'purchase' ? 'Compra' : 'Venta'} - {operation.company}</strong>
                                        <br />
                                        {operation.shares} acciones a {formatPrice(operation.price)} {operation.currency}
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div>€{(operation.totalCost || 0).toFixed(2)}</div>
                                        <div style={{ fontSize: '12px', color: '#888' }}>
                                            {new Date(operation.date).toLocaleDateString('es-ES')}
                                        </div>
                                        <button
                                            className="button"
                                            onClick={() => onEditOperation(operation.type, operation)}
                                            style={{ fontSize: '12px', padding: '5px 8px', marginTop: '5px' }}
                                            title={`Editar ${operation.type === 'purchase' ? 'compra' : 'venta'}`}
                                        >
                                            ✏️ Editar
                                        </button>
                                    </div>
                                </div>
                            ))}
                    </div>
                )}
            </div>
        );
    }

    // Operaciones recientes (cuando no se muestra el historial)
    return (
        <div className="card">
            <h2>Operaciones Recientes</h2>
            {operations.length === 0 ? (
                <p>No hay operaciones registradas</p>
            ) : (
                <div>
                    {operations.slice(-5).reverse().map((operation) => (
                        <div key={operation.id} style={{
                            padding: '10px',
                            margin: '5px 0',
                            border: '1px solid #404040',
                            borderRadius: '4px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <div>
                                <strong>{operation.type === 'purchase' ? 'Compra' : 'Venta'} - {operation.company}</strong>
                                <br />
                                {operation.shares} acciones a {formatPrice(operation.price)} {operation.currency}
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div>€{(operation.totalCost || 0).toFixed(2)}</div>
                                <div style={{ fontSize: '12px', color: '#888' }}>
                                    {new Date(operation.date).toLocaleDateString('es-ES')}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
