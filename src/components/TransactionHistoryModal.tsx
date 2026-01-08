import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

interface Transaction {
    id: string;
    ticker: string;
    company_name?: string;
    type: 'BUY' | 'SELL' | 'DIVIDEND' | 'DEPOSIT' | 'WITHDRAWAL';
    amount: number;
    price_per_unit: number;
    fees: number;
    currency: string;
    exchange_rate_to_eur: number;
    date: string;
}

interface TransactionHistoryModalProps {
    portfolioId: string;
    onClose: () => void;
}

export const TransactionHistoryModal: React.FC<TransactionHistoryModalProps> = ({ portfolioId, onClose }) => {
    const { t } = useTranslation();
    const { api } = useAuth();
    const { addToast: showToast } = useToast();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValues, setEditValues] = useState<Partial<Transaction>>({});

    // Ref para preservar el scroll
    const tableContainerRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchTransactions(true);
    }, [portfolioId]);

    const fetchTransactions = async (isInitialLoad = false) => {
        try {
            if (isInitialLoad) setLoading(true);

            // Guardar posición del scroll antes de actualizar si no es carga inicial
            const currentScroll = tableContainerRef.current?.scrollTop;

            const { data } = await api.get(`/portfolios/${portfolioId}/transactions/all`);
            if (Array.isArray(data)) {
                setTransactions(data);

                // Restaurar scroll si no es carga inicial
                if (!isInitialLoad && tableContainerRef.current && currentScroll !== undefined) {
                    // Usamos requestAnimationFrame para asegurar que el DOM se ha actualizado
                    requestAnimationFrame(() => {
                        if (tableContainerRef.current) {
                            tableContainerRef.current.scrollTop = currentScroll;
                        }
                    });
                }
            }
        } catch (error) {
            console.error('Error fetching transactions:', error);
            showToast('Error al cargar historial', 'error');
        } finally {
            if (isInitialLoad) setLoading(false);
        }
    };

    const handleEdit = (tx: Transaction) => {
        setEditingId(tx.id);
        setEditValues({
            date: tx.date.split('T')[0], // YYYY-MM-DD
            amount: tx.amount,
            price_per_unit: tx.price_per_unit,
            fees: tx.fees,
            currency: tx.currency,
            exchange_rate_to_eur: tx.exchange_rate_to_eur
        });
    };

    const handleCancel = () => {
        setEditingId(null);
        setEditValues({});
    };

    const handleSave = async (id: string) => {
        try {
            const originalTx = transactions.find(t => t.id === id);
            let dateToSend = editValues.date;

            // Preserve original time if available
            if (originalTx?.date && editValues.date) {
                const originalTime = originalTx.date.includes('T')
                    ? originalTx.date.split('T')[1]
                    : '00:00:00.000Z';
                dateToSend = `${editValues.date}T${originalTime}`;
            }

            await api.put(`/portfolios/${portfolioId}/transactions/${id}`, {
                date: dateToSend,
                amount: Number(editValues.amount),
                price: Number(editValues.price_per_unit),
                fees: Number(editValues.fees),
                currency: editValues.currency,
                exchangeRate: Number(editValues.exchange_rate_to_eur)
            });

            showToast('Transacción actualizada y posiciones recalculadas', 'success');
            setEditingId(null);
            fetchTransactions(false); // Background refresh (keeps scroll)
        } catch (error) {
            console.error('Update error:', error);
            showToast('Error al actualizar transacción', 'error');
        }
    };

    if (loading) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <div className="bg-white dark:bg-[#1E1E2D] p-8 rounded-xl shadow-2xl flex flex-col items-center">
                    <div className="size-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-sm font-medium dark:text-white">Cargando historial...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-[#1E1E2D] w-full max-w-7xl h-[90vh] rounded-2xl shadow-2xl border border-white/10 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border-light dark:border-white/10 bg-surface-light dark:bg-[#1E1E2D]">
                    <div>
                        <h2 className="text-xl font-bold dark:text-white flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">history</span>
                            Historial de Transacciones
                        </h2>
                        <p className="text-sm text-text-secondary-light dark:text-gray-400 mt-1">
                            Edita operaciones pasadas para corregir tu portafolio actual.
                            <span className="text-orange-400 ml-1 font-bold">⚠️ Los cambios recalcularán automáticamente tus posiciones.</span>
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors">
                        <span className="material-symbols-outlined dark:text-white">close</span>
                    </button>
                </div>

                {/* Table Container */}
                <div
                    ref={tableContainerRef}
                    className="flex-1 overflow-auto p-0"
                >
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-bg-light dark:bg-black/20 sticky top-0 z-10 backdrop-blur-md">
                            <tr>
                                <th className="p-4 text-xs font-bold text-text-secondary-light dark:text-gray-400 uppercase tracking-wider">Fecha</th>
                                <th className="p-4 text-xs font-bold text-text-secondary-light dark:text-gray-400 uppercase tracking-wider">Ticker</th>
                                <th className="p-4 text-xs font-bold text-text-secondary-light dark:text-gray-400 uppercase tracking-wider">Empresa</th>
                                <th className="p-4 text-xs font-bold text-text-secondary-light dark:text-gray-400 uppercase tracking-wider">Tipo</th>
                                <th className="p-4 text-xs font-bold text-text-secondary-light dark:text-gray-400 uppercase tracking-wider text-right">Cantidad</th>
                                <th className="p-4 text-xs font-bold text-text-secondary-light dark:text-gray-400 uppercase tracking-wider text-right">Precio</th>
                                <th className="p-4 text-xs font-bold text-text-secondary-light dark:text-gray-400 uppercase tracking-wider text-right">Comisión</th>
                                <th className="p-4 text-xs font-bold text-text-secondary-light dark:text-gray-400 uppercase tracking-wider text-center">Divisa</th>
                                <th className="p-4 text-xs font-bold text-text-secondary-light dark:text-gray-400 uppercase tracking-wider text-right">FX (a EUR)</th>
                                <th className="p-4 text-xs font-bold text-text-secondary-light dark:text-gray-400 uppercase tracking-wider text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-light dark:divide-white/5">
                            {transactions.map((tx) => {
                                const isEditing = editingId === tx.id;
                                const isBuy = tx.type === 'BUY' || tx.type === 'DEPOSIT';

                                return (
                                    <tr key={tx.id} className={`group hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${isEditing ? 'bg-primary/5 dark:bg-primary/10' : ''}`}>
                                        {/* FECHA */}
                                        <td className="p-4 text-sm dark:text-white font-medium">
                                            {isEditing ? (
                                                <input
                                                    type="date"
                                                    value={editValues.date}
                                                    onChange={e => setEditValues({ ...editValues, date: e.target.value })}
                                                    className="bg-white dark:bg-black/30 border border-border-light dark:border-white/10 rounded px-2 py-1 text-xs w-32 focus:border-primary outline-none"
                                                />
                                            ) : (
                                                new Date(tx.date).toLocaleDateString()
                                            )}
                                        </td>

                                        {/* TICKER */}
                                        <td className="p-4 text-sm font-bold dark:text-white">
                                            <span className="px-2 py-1 rounded bg-black/10 dark:bg-white/10 text-xs">{tx.ticker}</span>
                                        </td>

                                        {/* EMPRESA */}
                                        <td className="p-4 text-sm dark:text-white font-medium max-w-[150px] truncate" title={tx.company_name || tx.ticker}>
                                            {tx.company_name || '-'}
                                        </td>

                                        {/* TIPO */}
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${tx.type === 'BUY' ? 'bg-green-500/20 text-green-500' :
                                                tx.type === 'SELL' ? 'bg-red-500/20 text-red-500' :
                                                    'bg-blue-500/20 text-blue-500'
                                                }`}>
                                                {(() => {
                                                    switch (tx.type) {
                                                        case 'BUY': return 'COMPRA';
                                                        case 'SELL': return 'VENTA';
                                                        case 'DIVIDEND': return 'DIVIDENDO';
                                                        case 'DEPOSIT': return 'DEPÓSITO';
                                                        case 'WITHDRAWAL': return 'RETIRO';
                                                        default: return tx.type;
                                                    }
                                                })()}
                                            </span>
                                        </td>

                                        {/* CANTIDAD */}
                                        <td className="p-4 text-sm dark:text-white text-right font-medium">
                                            {isEditing ? (
                                                <input
                                                    type="number"
                                                    value={editValues.amount}
                                                    onChange={e => setEditValues({ ...editValues, amount: Number(e.target.value) })}
                                                    className="bg-white dark:bg-black/30 border border-border-light dark:border-white/10 rounded px-2 py-1 text-xs w-24 text-right focus:border-primary outline-none"
                                                />
                                            ) : (
                                                tx.amount
                                            )}
                                        </td>

                                        {/* PRECIO */}
                                        <td className="p-4 text-sm dark:text-white text-right">
                                            {isEditing ? (
                                                <input
                                                    type="number"
                                                    value={editValues.price_per_unit}
                                                    onChange={e => setEditValues({ ...editValues, price_per_unit: Number(e.target.value) })}
                                                    className="bg-white dark:bg-black/30 border border-border-light dark:border-white/10 rounded px-2 py-1 text-xs w-24 text-right focus:border-primary outline-none"
                                                />
                                            ) : (
                                                tx.price_per_unit.toFixed(2)
                                            )}
                                        </td>

                                        {/* COMISIÓN */}
                                        <td className="p-4 text-sm text-text-secondary-light dark:text-gray-400 text-right">
                                            {isEditing ? (
                                                <input
                                                    type="number"
                                                    value={editValues.fees}
                                                    onChange={e => setEditValues({ ...editValues, fees: Number(e.target.value) })}
                                                    className="bg-white dark:bg-black/30 border border-border-light dark:border-white/10 rounded px-2 py-1 text-xs w-20 text-right focus:border-primary outline-none"
                                                />
                                            ) : (
                                                tx.fees > 0 ? tx.fees.toFixed(2) : '-'
                                            )}
                                        </td>

                                        {/* DIVISA */}
                                        <td className="p-4 text-center">
                                            {isEditing ? (
                                                <select
                                                    value={editValues.currency}
                                                    onChange={e => setEditValues({ ...editValues, currency: e.target.value })}
                                                    className="bg-white dark:bg-black/30 border border-border-light dark:border-white/10 rounded px-1 py-1 text-xs focus:border-primary outline-none text-center"
                                                >
                                                    <option value="EUR">EUR</option>
                                                    <option value="USD">USD</option>
                                                    <option value="GBP">GBP</option>
                                                    <option value="GBX">GBX</option>
                                                    <option value="JPY">JPY</option>
                                                    <option value="CHF">CHF</option>
                                                </select>
                                            ) : (
                                                <span className="text-xs text-text-secondary-light dark:text-gray-500 font-bold">{tx.currency}</span>
                                            )}
                                        </td>

                                        {/* FX RATE */}
                                        <td className="p-4 text-sm text-right text-text-secondary-light dark:text-gray-400">
                                            {isEditing ? (
                                                <input
                                                    type="number"
                                                    value={editValues.exchange_rate_to_eur}
                                                    onChange={e => setEditValues({ ...editValues, exchange_rate_to_eur: Number(e.target.value) })}
                                                    className="bg-white dark:bg-black/30 border border-border-light dark:border-white/10 rounded px-2 py-1 text-xs w-20 text-right focus:border-primary outline-none"
                                                    step="0.0001"
                                                />
                                            ) : (
                                                tx.exchange_rate_to_eur !== 1 ? tx.exchange_rate_to_eur.toFixed(4) : '-'
                                            )}
                                        </td>

                                        {/* ACTIONS */}
                                        <td className="p-4 text-center">
                                            {isEditing ? (
                                                <div className="flex items-center justify-center gap-2">
                                                    <button onClick={() => handleSave(tx.id)} className="size-8 rounded-lg bg-green-500/20 text-green-500 hover:bg-green-500 hover:text-white transition-all flex items-center justify-center shadow-lg">
                                                        <span className="material-symbols-outlined text-lg">check</span>
                                                    </button>
                                                    <button onClick={handleCancel} className="size-8 rounded-lg bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center">
                                                        <span className="material-symbols-outlined text-lg">close</span>
                                                    </button>
                                                </div>
                                            ) : (
                                                <button onClick={() => handleEdit(tx)} className="size-8 rounded-lg text-text-secondary-light dark:text-gray-500 hover:bg-primary/10 hover:text-primary transition-all flex items-center justify-center">
                                                    <span className="material-symbols-outlined text-lg">edit</span>
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {transactions.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 opacity-50">
                            <span className="material-symbols-outlined text-4xl mb-2">inbox</span>
                            <p>No hay transacciones registradas</p>
                        </div>
                    )}
                </div>

                {/* Footer info equivalent */}
                <div className="p-4 bg-surface-light dark:bg-[#1E1E2D] border-t border-border-light dark:border-white/10 text-xs text-center text-text-secondary-light dark:text-gray-500">
                    Mostrando {transactions.length} operaciones ordenadas cronológicamente.
                </div>
            </div>
        </div>
    );
};
