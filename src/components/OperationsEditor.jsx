import { useState } from 'react';

export default function OperationsEditor({
    isOpen,
    onClose,
    authenticatedFetch
}) {
    const [usersPortfolios, setUsersPortfolios] = useState([]);
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [selectedPortfolioId, setSelectedPortfolioId] = useState(null);
    const [operations, setOperations] = useState([]);
    const [editingOperations, setEditingOperations] = useState({});
    const [symbolValidations, setSymbolValidations] = useState({});
    const [validatingSymbols, setValidatingSymbols] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const loadUsersPortfolios = async () => {
        try {
            const response = await authenticatedFetch('/api/admin/users-portfolios');
            if (!response.ok) throw new Error('Error al cargar usuarios y portfolios');
            const data = await response.json();
            setUsersPortfolios(data);
        } catch (err) {
            setError(err.message);
        }
    };

    const loadOperations = async (portfolioId) => {
        try {
            setLoading(true);
            const response = await authenticatedFetch(`/api/admin/operations/${portfolioId}`);
            if (!response.ok) throw new Error('Error al cargar operaciones');
            const data = await response.json();
            setOperations(data);
            setEditingOperations({});
            setSymbolValidations({});
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const validateSymbol = async (operationId, symbol) => {
        if (!symbol || symbol.trim() === '') {
            setSymbolValidations(prev => ({
                ...prev,
                [operationId]: { valid: false, error: 'Símbolo vacío' }
            }));
            return;
        }

        setValidatingSymbols(prev => ({ ...prev, [operationId]: true }));

        try {
            const response = await authenticatedFetch('/api/admin/validate-symbol', {
                method: 'POST',
                body: JSON.stringify({ symbol })
            });
            const data = await response.json();

            setSymbolValidations(prev => ({
                ...prev,
                [operationId]: data
            }));
        } catch (err) {
            setSymbolValidations(prev => ({
                ...prev,
                [operationId]: { valid: false, error: 'Error al validar' }
            }));
        } finally {
            setValidatingSymbols(prev => ({ ...prev, [operationId]: false }));
        }
    };

    const handleOperationFieldChange = (operationId, field, value) => {
        setEditingOperations(prev => ({
            ...prev,
            [operationId]: {
                ...prev[operationId],
                [field]: value
            }
        }));

        if (field === 'symbol') {
            validateSymbol(operationId, value);
        }
    };

    const saveOperation = async (operationId) => {
        const editedData = editingOperations[operationId];
        if (!editedData) return;

        if (editedData.symbol !== undefined) {
            const validation = symbolValidations[operationId];
            if (!validation || !validation.valid) {
                setError('El símbolo no es válido. Por favor, corrígelo antes de guardar.');
                return;
            }
        }

        try {
            setLoading(true);
            const response = await authenticatedFetch(`/api/admin/operations/${operationId}`, {
                method: 'PUT',
                body: JSON.stringify(editedData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error al actualizar operación');
            }

            setError('');

            if (selectedPortfolioId) {
                await loadOperations(selectedPortfolioId);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const getEditedValue = (operation, field) => {
        const edited = editingOperations[operation.id];
        return edited && edited[field] !== undefined ? edited[field] : operation[field];
    };

    const calculateTotal = (operation) => {
        const shares = getEditedValue(operation, 'shares');
        const price = getEditedValue(operation, 'price');
        const exchangeRate = getEditedValue(operation, 'exchangeRate') || 1;
        const commission = getEditedValue(operation, 'commission') || 0;
        return (shares * price * exchangeRate) + commission;
    };

    const handleOpen = () => {
        loadUsersPortfolios();
    };

    if (!isOpen) return null;

    return (
        <div className="modal" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '95%', maxHeight: '90vh', overflow: 'auto' }}>
                <h2>✏️ Editor de Operaciones</h2>

                {error && (
                    <div style={{ padding: '10px', marginBottom: '15px', backgroundColor: '#dc3545', borderRadius: '4px', color: 'white' }}>
                        {error}
                    </div>
                )}

                {/* Selectores de Usuario y Portfolio */}
                <div className="form-row" style={{ marginBottom: '20px' }}>
                    <div className="form-group" style={{ flex: 1 }}>
                        <label>Usuario</label>
                        <select
                            className="input"
                            value={selectedUserId || ''}
                            onChange={(e) => {
                                const userId = e.target.value ? parseInt(e.target.value) : null;
                                setSelectedUserId(userId);
                                setSelectedPortfolioId(null);
                                setOperations([]);
                            }}
                        >
                            <option value="">Selecciona un usuario...</option>
                            {usersPortfolios.map(user => (
                                <option key={user.userId} value={user.userId}>
                                    {user.username}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group" style={{ flex: 1 }}>
                        <label>Portfolio</label>
                        <select
                            className="input"
                            value={selectedPortfolioId || ''}
                            disabled={!selectedUserId}
                            onChange={(e) => {
                                const portfolioId = e.target.value ? parseInt(e.target.value) : null;
                                setSelectedPortfolioId(portfolioId);
                                if (portfolioId) {
                                    loadOperations(portfolioId);
                                } else {
                                    setOperations([]);
                                }
                            }}
                        >
                            <option value="">Selecciona un portfolio...</option>
                            {selectedUserId && usersPortfolios.find(u => u.userId === selectedUserId)?.portfolios.map(portfolio => (
                                <option key={portfolio.id} value={portfolio.id}>
                                    {portfolio.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Tabla de Operaciones */}
                {operations.length > 0 && (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="operations-table" style={{ width: '100%', fontSize: '13px' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#333' }}>
                                    <th style={{ padding: '8px' }}>Fecha</th>
                                    <th style={{ padding: '8px' }}>Tipo</th>
                                    <th style={{ padding: '8px' }}>Compañía</th>
                                    <th style={{ padding: '8px', width: '150px' }}>Símbolo</th>
                                    <th style={{ padding: '8px' }}>Acciones</th>
                                    <th style={{ padding: '8px' }}>Precio</th>
                                    <th style={{ padding: '8px' }}>Tasa Cambio</th>
                                    <th style={{ padding: '8px' }}>Comisión</th>
                                    <th style={{ padding: '8px' }}>Total</th>
                                    <th style={{ padding: '8px' }}>Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                {operations.map(op => {
                                    const validation = symbolValidations[op.id];
                                    const isValidating = validatingSymbols[op.id];
                                    const hasEdits = editingOperations[op.id] && Object.keys(editingOperations[op.id]).length > 0;

                                    return (
                                        <tr key={op.id} style={{ borderBottom: '1px solid #444' }}>
                                            <td style={{ padding: '4px' }}>
                                                <input
                                                    type="date"
                                                    className="input"
                                                    style={{ fontSize: '12px', padding: '4px' }}
                                                    value={getEditedValue(op, 'date')?.split('T')[0] || ''}
                                                    onChange={(e) => handleOperationFieldChange(op.id, 'date', e.target.value)}
                                                />
                                            </td>
                                            <td style={{ padding: '4px' }}>
                                                <span style={{
                                                    padding: '4px 8px',
                                                    borderRadius: '4px',
                                                    backgroundColor: op.type === 'purchase' ? '#22c55e' : '#ef4444',
                                                    color: 'white',
                                                    fontSize: '11px',
                                                    fontWeight: 'bold'
                                                }}>
                                                    {op.type === 'purchase' ? '📈 COMPRA' : '📉 VENTA'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '4px' }}>
                                                <input
                                                    type="text"
                                                    className="input"
                                                    style={{ fontSize: '12px', padding: '4px', width: '100%' }}
                                                    value={getEditedValue(op, 'company')}
                                                    onChange={(e) => handleOperationFieldChange(op.id, 'company', e.target.value)}
                                                />
                                            </td>
                                            <td style={{ padding: '4px' }}>
                                                <div>
                                                    <input
                                                        type="text"
                                                        className="input"
                                                        style={{ fontSize: '12px', padding: '4px', width: '100%', marginBottom: '4px' }}
                                                        value={getEditedValue(op, 'symbol')}
                                                        onChange={(e) => handleOperationFieldChange(op.id, 'symbol', e.target.value)}
                                                    />
                                                    {isValidating && (
                                                        <div style={{ fontSize: '11px', color: '#888' }}>⏳ Validando...</div>
                                                    )}
                                                    {!isValidating && validation && validation.valid && (
                                                        <div style={{ fontSize: '11px', color: '#22c55e' }}>
                                                            ✅ {validation.price.toFixed(2)} {validation.currency} ({validation.source})
                                                        </div>
                                                    )}
                                                    {!isValidating && validation && !validation.valid && (
                                                        <div style={{ fontSize: '11px', color: '#ef4444' }}>
                                                            ❌ {validation.error}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td style={{ padding: '4px' }}>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    className="input"
                                                    style={{ fontSize: '12px', padding: '4px', width: '80px' }}
                                                    value={getEditedValue(op, 'shares')}
                                                    onChange={(e) => handleOperationFieldChange(op.id, 'shares', parseFloat(e.target.value))}
                                                />
                                            </td>
                                            <td style={{ padding: '4px' }}>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    className="input"
                                                    style={{ fontSize: '12px', padding: '4px', width: '80px' }}
                                                    value={getEditedValue(op, 'price')}
                                                    onChange={(e) => handleOperationFieldChange(op.id, 'price', parseFloat(e.target.value))}
                                                />
                                            </td>
                                            <td style={{ padding: '4px' }}>
                                                <input
                                                    type="number"
                                                    step="0.000000000001"
                                                    className="input"
                                                    style={{ fontSize: '12px', padding: '4px', width: '90px' }}
                                                    value={getEditedValue(op, 'exchangeRate')}
                                                    onChange={(e) => handleOperationFieldChange(op.id, 'exchangeRate', parseFloat(e.target.value))}
                                                />
                                            </td>
                                            <td style={{ padding: '4px' }}>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    className="input"
                                                    style={{ fontSize: '12px', padding: '4px', width: '70px' }}
                                                    value={getEditedValue(op, 'commission')}
                                                    onChange={(e) => handleOperationFieldChange(op.id, 'commission', parseFloat(e.target.value))}
                                                />
                                            </td>
                                            <td style={{ padding: '4px', fontWeight: 'bold' }}>
                                                {calculateTotal(op).toFixed(2)}€
                                            </td>
                                            <td style={{ padding: '4px' }}>
                                                <button
                                                    className="button primary"
                                                    style={{ fontSize: '11px', padding: '4px 12px' }}
                                                    disabled={!hasEdits || (validation && !validation.valid && editingOperations[op.id]?.symbol !== undefined)}
                                                    onClick={() => saveOperation(op.id)}
                                                >
                                                    💾 Guardar
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {operations.length === 0 && selectedPortfolioId && (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
                        No hay operaciones en este portfolio
                    </div>
                )}

                {!selectedPortfolioId && (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
                        Selecciona un usuario y portfolio para ver las operaciones
                    </div>
                )}

                <div className="modal-actions" style={{ marginTop: '20px' }}>
                    <button
                        className="button"
                        onClick={() => {
                            onClose();
                            setSelectedUserId(null);
                            setSelectedPortfolioId(null);
                            setOperations([]);
                            setEditingOperations({});
                            setSymbolValidations({});
                            setError('');
                        }}
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}
