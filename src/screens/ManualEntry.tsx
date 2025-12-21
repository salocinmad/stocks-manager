import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '../components/Header';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface SymbolResult {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
}

interface Portfolio {
  id: string;
  name: string;
}

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD'];

export const ManualEntry: React.FC = () => {
  const navigate = useNavigate();
  const { api } = useAuth();

  const [type, setType] = useState<'buy' | 'sell'>('buy');
  const [formData, setFormData] = useState({
    symbol: '',
    symbolName: '',
    quantity: '',
    price: '',
    commission: '0',
    date: new Date().toISOString().split('T')[0],
    currency: 'EUR',
    exchangeRate: '1'
  });

  const [searchResults, setSearchResults] = useState<SymbolResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Gestión de Portfolios
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>('');
  const [loadingPortfolios, setLoadingPortfolios] = useState(true);
  const [showCreatePortfolio, setShowCreatePortfolio] = useState(false);
  const [newPortfolioName, setNewPortfolioName] = useState('');

  // 1. Cargar portfolios robustamente
  const loadPortfolios = useCallback(async () => {
    setLoadingPortfolios(true);
    try {
      console.log('Loading portfolios...');
      const { data } = await api.get('/portfolios');
      console.log('Portfolios loaded:', data);

      if (Array.isArray(data)) {
        setPortfolios(data);
        // Seleccionar el primero por defecto si no hay nada seleccionado
        if (data.length > 0 && !selectedPortfolioId) {
          setSelectedPortfolioId(data[0].id);
        } else if (data.length === 0) {
          setError('No tienes ningún portfolio. Por favor crea uno.');
        }
      }
    } catch (e) {
      console.error('Error loading portfolios:', e);
      setError('Error al conectar con el servidor para cargar portfolios.');
    } finally {
      setLoadingPortfolios(false);
    }
  }, [api, selectedPortfolioId]);

  useEffect(() => {
    loadPortfolios();
  }, [loadPortfolios]);

  // Crear nuevo portfolio
  const handleCreatePortfolio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPortfolioName.trim()) return;

    try {
      const { data } = await api.post('/portfolios', { name: newPortfolioName });
      if (data && data.id) {
        setPortfolios(prev => [...prev, data]);
        setSelectedPortfolioId(data.id); // Seleccionar el nuevo
        setShowCreatePortfolio(false);
        setNewPortfolioName('');
        setError('');
      }
    } catch (err: any) {
      console.error('Error creating portfolio:', err);
      setError(err.response?.data?.error || 'Error al crear portfolio');
    }
  };

  // Búsqueda de símbolos
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
      console.error('Search error:', e);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [api]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (formData.symbol && !formData.symbolName) {
        searchSymbols(formData.symbol);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [formData.symbol, formData.symbolName, searchSymbols]);

  // Tipo de cambio
  useEffect(() => {
    const fetchExchangeRate = async () => {
      if (formData.currency === 'EUR') {
        setFormData(prev => ({ ...prev, exchangeRate: '1' }));
        return;
      }
      try {
        const { data } = await api.get(`/market/exchange-rate?from=${formData.currency}&to=EUR`);
        if (data.rate) {
          setFormData(prev => ({ ...prev, exchangeRate: data.rate.toFixed(6) }));
        }
      } catch (e) {
        console.error('Exchange rate error:', e);
      }
    };
    fetchExchangeRate();
  }, [formData.currency, api]);

  const handleSelectSymbol = async (result: SymbolResult) => {
    // 1. Establecer datos básicos
    setFormData(prev => ({
      ...prev,
      symbol: result.symbol,
      symbolName: result.name
    }));
    setShowDropdown(false);
    setSearchResults([]);

    // 2. Obtener cotización y moneda automáticamente
    try {
      setLoading(true);
      const { data } = await api.get(`/market/quote?ticker=${encodeURIComponent(result.symbol)}`);

      if (data && data.c) {
        setFormData(prev => ({
          ...prev,
          price: data.c.toString(),
          currency: data.currency || prev.currency
        }));
      }
    } catch (e) {
      console.error('Error fetching quote on selection:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedPortfolioId) {
      setError('Debes seleccionar un portfolio para registrar la operación.');
      return;
    }

    if (!formData.symbol || !formData.quantity || !formData.price) {
      setError('Por favor, completa todos los campos requeridos.');
      return;
    }

    setLoading(true);

    try {
      console.log(`Submitting operation to portfolio ${selectedPortfolioId}`);
      await api.post(`/portfolios/${selectedPortfolioId}/positions`, {
        ticker: formData.symbol,
        amount: parseFloat(formData.quantity),
        price: parseFloat(formData.price),
        commission: parseFloat(formData.commission) || 0,
        type: type === 'buy' ? 'BUY' : 'SELL',
        currency: formData.currency,
        exchangeRateToEur: parseFloat(formData.exchangeRate)
      });

      navigate('/portfolio');
    } catch (err: any) {
      console.error('Submit error:', err);
      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError('Error al registrar la operación. Inténtalo de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  const commission = Number(formData.commission) || 0;
  const subtotal = Number(formData.quantity) * Number(formData.price);
  const totalInOriginalCurrency = subtotal + commission;
  const totalInEur = totalInOriginalCurrency * Number(formData.exchangeRate);

  return (
    <main className="flex-1 flex flex-col h-full bg-background-light dark:bg-background-dark overflow-y-auto">
      <Header title="Registro de Operación" />
      <div className="max-w-[1200px] mx-auto w-full px-6 py-10 flex flex-col gap-8 pb-32">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Introduce los detalles</h1>
            <p className="text-text-secondary-light dark:text-text-secondary-dark text-lg">Añade manualmente tus compras y ventas de activos.</p>
          </div>

          {/* Selector de Portfolio */}
          <div className="bg-white dark:bg-surface-dark p-4 rounded-xl shadow-sm border border-border-light dark:border-border-dark flex flex-col gap-2 min-w-[300px]">
            <label className="text-xs font-bold uppercase tracking-wider text-text-secondary-light">Seleccionar Cartera</label>
            {loadingPortfolios ? (
              <div className="text-sm">Cargando portafolios...</div>
            ) : portfolios.length === 0 ? (
              <button
                onClick={() => setShowCreatePortfolio(true)}
                className="px-4 py-2 bg-primary text-black rounded-lg text-sm font-bold w-full"
              >
                + Crear Primera Cartera
              </button>
            ) : (
              <div className="flex gap-2">
                <select
                  value={selectedPortfolioId}
                  onChange={(e) => setSelectedPortfolioId(e.target.value)}
                  className="flex-1 bg-background-light dark:bg-surface-dark-elevated px-3 py-2 rounded-lg border-none focus:ring-2 focus:ring-primary text-sm"
                >
                  {portfolios.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => setShowCreatePortfolio(!showCreatePortfolio)}
                  className="px-3 py-2 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 text-sm font-bold"
                  title="Crear nueva cartera"
                >
                  +
                </button>
              </div>
            )}

            {/* Crear Portfolio Dropdown */}
            {showCreatePortfolio && (
              <div className="mt-2 pt-2 border-t border-border-light dark:border-border-dark flex flex-col gap-2">
                <input
                  type="text"
                  placeholder="Nombre nueva cartera"
                  value={newPortfolioName}
                  onChange={(e) => setNewPortfolioName(e.target.value)}
                  className="w-full px-3 py-2 bg-background-light dark:bg-surface-dark-elevated rounded-lg text-sm"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleCreatePortfolio}
                    className="flex-1 bg-primary text-black text-xs font-bold py-2 rounded-lg"
                  >
                    Crear
                  </button>
                  <button
                    onClick={() => setShowCreatePortfolio(false)}
                    className="bg-transparent text-xs text-text-secondary-light py-2 px-2"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 xl:grid-cols-12 gap-10">
          <div className="xl:col-span-8 flex flex-col gap-8">
            {/* Tipo de operación */}
            <div className="bg-white dark:bg-surface-dark p-1.5 rounded-full inline-flex self-start border border-border-light dark:border-border-dark shadow-sm">
              <button
                type="button"
                onClick={() => setType('buy')}
                className={`px-8 py-3 rounded-full text-sm font-bold transition-all flex items-center gap-2 ${type === 'buy' ? 'bg-primary text-black' : 'text-text-secondary-light dark:text-text-secondary-dark'
                  }`}
              >
                <span className="material-symbols-outlined">add_circle</span> Compra
              </button>
              <button
                type="button"
                onClick={() => setType('sell')}
                className={`px-8 py-3 rounded-full text-sm font-bold transition-all flex items-center gap-2 ${type === 'sell' ? 'bg-[#ff4d4d] text-white' : 'text-text-secondary-light dark:text-text-secondary-dark'
                  }`}
              >
                <span className="material-symbols-outlined">remove_circle</span> Venta
              </button>
            </div>

            <div className="bg-white dark:bg-surface-dark rounded-3xl p-8 border border-border-light dark:border-border-dark shadow-sm flex flex-col gap-6">
              {/* Símbolo con autocompletado */}
              <div className="relative">
                <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary-light mb-2 ml-1">
                  Símbolo del Activo
                </label>
                <div className="relative">
                  <input
                    required
                    value={formData.symbol}
                    onChange={e => {
                      const val = e.target.value.toUpperCase();
                      setFormData({ ...formData, symbol: val, symbolName: '' });
                    }}
                    onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                    className="w-full px-5 py-4 bg-background-light dark:bg-surface-dark-elevated border-none rounded-2xl focus:ring-2 focus:ring-primary text-text-primary-light dark:text-white"
                    placeholder="Busca por nombre o símbolo (ej: Apple, AAPL, ITX.MC)"
                    type="text"
                    autoComplete="off"
                  />
                  {isSearching && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>

                {formData.symbolName && (
                  <p className="mt-2 text-sm text-primary ml-1 font-medium">
                    {formData.symbolName}
                  </p>
                )}

                {showDropdown && searchResults.length > 0 && (
                  <div className="absolute z-50 w-full mt-2 bg-white dark:bg-surface-dark rounded-2xl border border-border-light dark:border-border-dark shadow-xl max-h-72 overflow-y-auto">
                    {searchResults.map((result, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectSymbol(result)}
                        className="w-full px-5 py-4 text-left hover:bg-primary/10 transition-colors flex items-center justify-between gap-4 border-b border-border-light dark:border-border-dark last:border-0"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-text-primary-light dark:text-white truncate">{result.name}</p>
                          <p className="text-sm text-text-secondary-light">{result.exchange}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm bg-primary/20 text-primary px-2 py-1 rounded-lg">
                            {result.symbol}
                          </span>
                          <span className="text-xs text-text-secondary-light uppercase">
                            {result.type}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary-light mb-2 ml-1">Cantidad</label>
                  <input
                    required
                    value={formData.quantity}
                    onChange={e => setFormData({ ...formData, quantity: e.target.value })}
                    className="w-full px-5 py-4 bg-background-light dark:bg-surface-dark-elevated border-none rounded-2xl focus:ring-2 focus:ring-primary text-text-primary-light dark:text-white"
                    placeholder="0"
                    type="number"
                    step="any"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary-light mb-2 ml-1">
                    Precio por unidad ({formData.currency})
                  </label>
                  <input
                    required
                    value={formData.price}
                    onChange={e => setFormData({ ...formData, price: e.target.value })}
                    className="w-full px-5 py-4 bg-background-light dark:bg-surface-dark-elevated border-none rounded-2xl focus:ring-2 focus:ring-primary text-text-primary-light dark:text-white"
                    placeholder="0.00"
                    type="number"
                    step="any"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary-light mb-2 ml-1">
                    Comisión ({formData.currency})
                  </label>
                  <input
                    value={formData.commission}
                    onChange={e => setFormData({ ...formData, commission: e.target.value })}
                    className="w-full px-5 py-4 bg-background-light dark:bg-surface-dark-elevated border-none rounded-2xl focus:ring-2 focus:ring-primary text-text-primary-light dark:text-white"
                    placeholder="0.00"
                    type="number"
                    step="any"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary-light mb-2 ml-1">Moneda de compra</label>
                  <select
                    value={formData.currency}
                    onChange={e => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full px-5 py-4 bg-background-light dark:bg-surface-dark-elevated border-none rounded-2xl focus:ring-2 focus:ring-primary text-text-primary-light dark:text-white"
                  >
                    {CURRENCIES.map(curr => (
                      <option key={curr} value={curr}>{curr}</option>
                    ))}
                  </select>
                </div>
                {formData.currency !== 'EUR' && (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary-light mb-2 ml-1">
                      Tipo de cambio ({formData.currency}EUR)
                    </label>
                    <input
                      required
                      value={formData.exchangeRate}
                      onChange={e => setFormData({ ...formData, exchangeRate: e.target.value })}
                      className="w-full px-5 py-4 bg-background-light dark:bg-surface-dark-elevated border-none rounded-2xl focus:ring-2 focus:ring-primary text-text-primary-light dark:text-white"
                      placeholder="1.00"
                      type="number"
                      step="0.000001"
                      min="0"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary-light mb-2 ml-1">Fecha</label>
                  <input
                    required
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-5 py-4 bg-background-light dark:bg-surface-dark-elevated border-none rounded-2xl focus:ring-2 focus:ring-primary text-text-primary-light dark:text-white"
                    type="date"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="xl:col-span-4 flex flex-col gap-6">
            <div className="bg-[#1c1c16] dark:bg-surface-dark-elevated text-white rounded-3xl p-8 shadow-2xl flex flex-col gap-8 sticky top-6">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">receipt_long</span>
                Resumen
              </h3>
              <div className="flex flex-col gap-4">
                <div className="flex justify-between text-sm opacity-60"><span>Tipo:</span><span className={type === 'buy' ? 'text-green-400' : 'text-red-400'}>{type === 'buy' ? 'Compra' : 'Venta'}</span></div>
                <div className="flex justify-between text-sm opacity-60"><span>Activo:</span><span>{formData.symbol || '---'}</span></div>
                <div className="flex justify-between text-sm opacity-60"><span>Cartera:</span><span>{portfolios.find(p => p.id === selectedPortfolioId)?.name || '...'}</span></div>
                <div className="pt-4 border-t border-white/10 flex justify-between items-end">
                  <span className="text-sm font-bold uppercase">Total EUR</span>
                  <span className="text-2xl font-bold text-primary">{totalInEur.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</span>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading || !selectedPortfolioId}
                className="w-full py-4 rounded-full bg-primary text-black font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Guardando...' : 'Confirmar Registro'}
              </button>
            </div>
          </div>
        </form>
      </div >
    </main >
  );
};
