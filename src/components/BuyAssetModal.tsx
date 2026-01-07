import React, { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

interface SymbolResult {
    symbol: string;
    name: string;
    exchange: string;
    type: string;
    currency?: string;
}

interface Portfolio {
    id: string;
    name: string;
    is_favorite?: boolean;
}

interface BuyAssetModalProps {
    isOpen: boolean;
    onClose: () => void;
    portfolios: Portfolio[];
    defaultPortfolioId?: string;
    onSuccess: () => void;
}

const CURRENCIES = ['EUR', 'USD', 'GBP', 'GBX', 'CHF', 'JPY', 'CAD', 'AUD'];

export const BuyAssetModal: React.FC<BuyAssetModalProps> = ({
    isOpen,
    onClose,
    portfolios,
    defaultPortfolioId,
    onSuccess
}) => {
    const { api } = useAuth();

    // Portfolio selection
    const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>('');

    // Form state
    const [formData, setFormData] = useState({
        symbol: '',
        symbolName: '',
        quantity: '',
        price: '',
        commission: '0',
        currency: 'EUR',
        exchangeRate: '1'
    });

    // Search state
    const [searchResults, setSearchResults] = useState<SymbolResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);

    // UI state
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Reset form when modal opens
    useEffect(() => {
        if (isOpen) {
            setFormData({
                symbol: '',
                symbolName: '',
                quantity: '',
                price: '',
                commission: '0',
                currency: 'EUR',
                exchangeRate: '1'
            });
            setSearchResults([]);
            setError('');
            // Set default portfolio
            if (defaultPortfolioId) {
                setSelectedPortfolioId(defaultPortfolioId);
            } else if (portfolios.length > 0) {
                setSelectedPortfolioId(portfolios[0].id);
            }
        }
    }, [isOpen, defaultPortfolioId, portfolios]);

    // Fetch exchange rate when currency changes
    const fetchExchangeRate = useCallback(async () => {
        if (formData.currency === 'EUR') {
            setFormData(prev => ({ ...prev, exchangeRate: '1' }));
            return;
        }
        try {
            const { data } = await api.get(`/market/exchange-rate?from=${formData.currency}&to=EUR`);
            if (data?.rate) {
                setFormData(prev => ({ ...prev, exchangeRate: String(data.rate) }));
            }
        } catch (e) {
            console.error('Error fetching exchange rate:', e);
        }
    }, [api, formData.currency]);

    useEffect(() => {
        fetchExchangeRate();
    }, [formData.currency, fetchExchangeRate]);

    // Symbol search
    const searchSymbols = useCallback(async (query: string) => {
        if (query.length < 2) {
            setSearchResults([]);
            return;
        }
        setIsSearching(true);
        try {
            const { data } = await api.get(`/market/search?q=${encodeURIComponent(query)}`);
            setSearchResults(data || []);
            setShowDropdown(true);
        } catch (e) {
            console.error('Symbol search error:', e);
        } finally {
            setIsSearching(false);
        }
    }, [api]);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (formData.symbol && !formData.symbolName) {
                searchSymbols(formData.symbol);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [formData.symbol, formData.symbolName, searchSymbols]);

    // Handle symbol selection
    const handleSelectSymbol = async (result: SymbolResult) => {
        const currency = result.currency || 'USD';
        setFormData(prev => ({
            ...prev,
            symbol: result.symbol,
            symbolName: result.name,
            currency
        }));
        setShowDropdown(false);
        setSearchResults([]);

        // Fetch current price
        setLoading(true);
        try {
            const { data: quote } = await api.get(`/market/quote?ticker=${result.symbol}`);
            if (quote?.c) {
                setFormData(prev => ({ ...prev, price: String(quote.c) }));
            }
        } catch (e) {
            console.error('Error fetching quote:', e);
        } finally {
            setLoading(false);
        }
    };

    // Submit
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!selectedPortfolioId) {
            setError('Selecciona una cartera.');
            return;
        }

        if (!formData.symbol || !formData.quantity || !formData.price) {
            setError('Completa todos los campos requeridos.');
            return;
        }

        setLoading(true);
        try {
            await api.post(`/portfolios/${selectedPortfolioId}/positions`, {
                ticker: formData.symbol,
                amount: parseFloat(formData.quantity.toString().replace(',', '.')),
                price: parseFloat(formData.price.toString().replace(',', '.')),
                currency: formData.currency,
                type: 'BUY',
                commission: parseFloat(formData.commission.toString().replace(',', '.')),
                exchangeRateToEur: formData.currency === 'EUR' ? 1 : parseFloat(formData.exchangeRate.toString().replace(',', '.'))
            });

            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Error al registrar la compra.');
        } finally {
            setLoading(false);
        }
    };

    // Get selected portfolio name
    const selectedPortfolio = portfolios.find(p => p.id === selectedPortfolioId);

    // Calculations
    const subtotal = Number(formData.quantity) * Number(formData.price);
    const commission = Number(formData.commission) || 0;
    const totalInCurrency = subtotal + commission;
    const totalInEur = totalInCurrency * Number(formData.exchangeRate);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <form onSubmit={handleSubmit} className="bg-white dark:bg-surface-dark rounded-3xl p-8 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="material-symbols-outlined text-primary text-2xl">add_circle</span>
                    </div>
                    <div>
                        <h3 className="text-xl font-bold">Comprar Activo</h3>
                        <p className="text-sm text-text-secondary-light">{selectedPortfolio?.name || 'Selecciona cartera'}</p>
                    </div>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm">
                        {error}
                    </div>
                )}

                <div className="space-y-4 mb-6">
                    {/* Portfolio Selector */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary-light mb-2">
                            Cartera destino
                        </label>
                        <select
                            value={selectedPortfolioId}
                            onChange={(e) => setSelectedPortfolioId(e.target.value)}
                            className="w-full px-4 py-3 bg-background-light dark:bg-surface-dark-elevated rounded-xl border-none focus:ring-2 focus:ring-primary"
                            required
                        >
                            {portfolios.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.name} {p.is_favorite ? '★' : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Symbol Search */}
                    <div className="relative">
                        <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary-light mb-2">
                            Símbolo del Activo
                        </label>
                        <input
                            type="text"
                            value={formData.symbol}
                            onChange={(e) => {
                                const val = e.target.value.toUpperCase();
                                setFormData(prev => ({ ...prev, symbol: val, symbolName: '' }));
                            }}
                            onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                            className="w-full px-4 py-3 bg-background-light dark:bg-surface-dark-elevated rounded-xl border-none focus:ring-2 focus:ring-primary"
                            placeholder="Busca por nombre o símbolo (ej: AAPL)"
                            autoComplete="off"
                        />
                        {isSearching && (
                            <div className="absolute right-3 top-10">
                                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            </div>
                        )}

                        {/* Dropdown */}
                        {showDropdown && searchResults.length > 0 && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)} />
                                <div className="absolute z-20 w-full mt-1 bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl shadow-xl max-h-60 overflow-y-auto">
                                    {searchResults.map((result, i) => (
                                        <button
                                            key={`${result.symbol}-${i}`}
                                            type="button"
                                            onClick={() => handleSelectSymbol(result)}
                                            className="w-full px-4 py-3 text-left hover:bg-background-light dark:hover:bg-white/5 flex justify-between items-center border-b border-border-light dark:border-border-dark last:border-b-0"
                                        >
                                            <div className="flex flex-col">
                                                <span className="font-bold text-base">{result.name}</span>
                                                <span className="text-xs text-text-secondary-light">{result.exchange}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs px-2 py-1 bg-background-light dark:bg-surface-dark-elevated rounded text-text-secondary-light">
                                                    {result.currency || 'USD'}
                                                </span>
                                                <span className="text-xs px-2 py-1 bg-primary/20 text-primary font-bold rounded">
                                                    {result.symbol}
                                                </span>
                                                <span className="text-xs text-text-secondary-light">
                                                    {result.type || 'EQUITY'}
                                                </span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}

                        {formData.symbolName && (
                            <p className="text-xs text-primary mt-1">{formData.symbolName}</p>
                        )}
                    </div>

                    {/* Quantity & Price Row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary-light mb-2">
                                Cantidad
                            </label>
                            <input
                                type="number"
                                step="any"
                                min="0"
                                value={formData.quantity}
                                onChange={(e) => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
                                className="w-full px-4 py-3 bg-background-light dark:bg-surface-dark-elevated rounded-xl border-none focus:ring-2 focus:ring-primary"
                                placeholder="0"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary-light mb-2">
                                Precio ({formData.currency})
                            </label>
                            <input
                                type="number"
                                step="any"
                                min="0"
                                value={formData.price}
                                onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                                className="w-full px-4 py-3 bg-background-light dark:bg-surface-dark-elevated rounded-xl border-none focus:ring-2 focus:ring-primary"
                                placeholder="0.00"
                                required
                            />
                        </div>
                    </div>

                    {/* Commission & Currency Row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary-light mb-2">
                                Comisión ({formData.currency})
                            </label>
                            <input
                                type="number"
                                step="any"
                                min="0"
                                value={formData.commission}
                                onChange={(e) => setFormData(prev => ({ ...prev, commission: e.target.value }))}
                                className="w-full px-4 py-3 bg-background-light dark:bg-surface-dark-elevated rounded-xl border-none focus:ring-2 focus:ring-primary"
                                placeholder="0"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary-light mb-2">
                                Moneda
                            </label>
                            <select
                                value={formData.currency}
                                onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                                className="w-full px-4 py-3 bg-background-light dark:bg-surface-dark-elevated rounded-xl border-none focus:ring-2 focus:ring-primary"
                            >
                                {CURRENCIES.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Exchange Rate (only for non-EUR) */}
                    {formData.currency !== 'EUR' && (
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary-light mb-2">
                                Tipo de cambio ({formData.currency} → EUR)
                            </label>
                            <input
                                type="number"
                                step="any"
                                min="0"
                                value={formData.exchangeRate}
                                onChange={(e) => setFormData(prev => ({ ...prev, exchangeRate: e.target.value }))}
                                className="w-full px-4 py-3 bg-background-light dark:bg-surface-dark-elevated rounded-xl border-none focus:ring-2 focus:ring-primary"
                                placeholder="1.00"
                            />
                            <p className="text-xs text-text-secondary-light mt-1">
                                1 {formData.currency} = {formData.exchangeRate} EUR
                            </p>
                        </div>
                    )}

                    {/* Summary */}
                    {formData.quantity && formData.price && (
                        <div className="p-4 bg-primary/10 border border-primary/20 rounded-xl">
                            <div className="flex justify-between text-sm">
                                <span>Subtotal:</span>
                                <span>{subtotal.toLocaleString('es-ES', { style: 'currency', currency: formData.currency })}</span>
                            </div>
                            {commission > 0 && (
                                <div className="flex justify-between text-sm mt-1">
                                    <span>+ Comisión:</span>
                                    <span>{commission.toLocaleString('es-ES', { style: 'currency', currency: formData.currency })}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-sm mt-1 font-bold">
                                <span>Total:</span>
                                <span className="text-primary">
                                    {totalInCurrency.toLocaleString('es-ES', { style: 'currency', currency: formData.currency })}
                                </span>
                            </div>
                            {formData.currency !== 'EUR' && (
                                <div className="flex justify-between text-sm mt-1">
                                    <span>Total en EUR:</span>
                                    <span className="font-bold">
                                        {totalInEur.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-4 rounded-2xl border border-border-light dark:border-border-dark font-bold hover:bg-background-light dark:hover:bg-white/5 transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={loading || !formData.symbol || !formData.quantity || !formData.price || !selectedPortfolioId}
                        className="px-6 py-4 rounded-2xl bg-primary text-black font-bold hover:opacity-90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
                    >
                        {loading ? 'Registrando...' : 'Confirmar Compra'}
                    </button>
                </div>
            </form>
        </div>
    );
};
