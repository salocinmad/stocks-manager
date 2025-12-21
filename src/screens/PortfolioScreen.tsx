import React, { useEffect, useState, useCallback } from 'react';
import { Header } from '../components/Header';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

interface Position {
  id: string;
  ticker: string;
  asset_type: string;
  quantity: number;
  average_buy_price: number;
  currency: string;
  currentPrice?: number;
  currentValue?: number;
  returnPct?: number;
  change?: number;
  changePercent?: number;
  name?: string;
  currentValueEUR?: number;
  costBasisEUR?: number;
}

interface Portfolio {
  id: string;
  name: string;
  positions: Position[];
  is_favorite?: boolean;
}

// Función para determinar los decimales máximos según el valor del precio
const getMaxDecimals = (value: number): number => {
  if (value === 0) return 2;
  const absValue = Math.abs(value);
  if (absValue < 0.01) return 6;
  if (absValue < 0.1) return 5;
  if (absValue < 1) return 4;
  if (absValue < 10) return 3;
  return 2;
};

// Formatear precio con decimales dinámicos (mínimo 2, sin ceros innecesarios)
const formatPrice = (value: number, currency: string): string => {
  const maxDecimals = getMaxDecimals(value);
  return value.toLocaleString('es-ES', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: maxDecimals
  });
};

// Formatear cambio con decimales dinámicos (mínimo 2, sin ceros innecesarios)
const formatChange = (change: number, changePercent: number): string => {
  const maxDecimals = getMaxDecimals(change);
  const changeStr = change.toLocaleString('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: maxDecimals
  });
  return `${changeStr} (${changePercent.toFixed(2)}%)`;
};

export const PortfolioScreen: React.FC = () => {
  const { api } = useAuth();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [availablePortfolios, setAvailablePortfolios] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [portfolioToDelete, setPortfolioToDelete] = useState<any>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPortfolioName, setNewPortfolioName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Estados para editar/eliminar posiciones
  const [positionToDelete, setPositionToDelete] = useState<Position | null>(null);
  const [positionToEdit, setPositionToEdit] = useState<Position | null>(null);
  const [editQuantity, setEditQuantity] = useState('');
  const [editPrice, setEditPrice] = useState('');

  // Estados para alerta rápida
  const [positionToAlert, setPositionToAlert] = useState<Position | null>(null);
  const [alertTargetPrice, setAlertTargetPrice] = useState('');
  const [alertCondition, setAlertCondition] = useState<'above' | 'below'>('below');
  const [isCreatingAlert, setIsCreatingAlert] = useState(false);

  const loadPortfolioDetails = useCallback(async (id: string) => {
    try {
      console.log(`[Portfolio] Fetching details for ID: ${id}`);
      const { data: portfolioDetails } = await api.get(`/portfolios/${id}`);

      if (!portfolioDetails) {
        throw new Error('No se recibieron detalles del portafolio');
      }

      setPortfolio(portfolioDetails);

      // Cargar precios de mercado y tipos de cambio
      if (portfolioDetails.positions && Array.isArray(portfolioDetails.positions) && portfolioDetails.positions.length > 0) {
        // 1. Identificar monedas únicas distintas de EUR
        const currencies = new Set<string>();
        portfolioDetails.positions.forEach((p: Position) => {
          if (p.currency && p.currency !== 'EUR') {
            currencies.add(p.currency);
          }
        });

        // 2. Obtener tipos de cambio
        const exchangeRates: Record<string, number> = {};
        await Promise.all(Array.from(currencies).map(async (currency) => {
          try {
            const { data } = await api.get(`/market/exchange-rate?from=${currency}&to=EUR`);
            if (data && data.rate) {
              exchangeRates[currency] = data.rate;
            }
          } catch (e) {
            console.error(`Error fetching rate for ${currency}:`, e);
          }
        }));

        const positionsWithPrices = await Promise.all(
          portfolioDetails.positions.map(async (pos: Position) => {
            try {
              const { data: quote } = await api.get(`/market/quote?ticker=${pos.ticker}`);
              const currentPrice = quote?.c || 0;
              const change = quote?.d || 0;
              const changePercent = quote?.dp || 0;
              const qty = Number(pos.quantity) || 0;
              const avgPrice = Number(pos.average_buy_price) || 0;
              const name = quote?.name || pos.ticker;
              const currency = pos.currency || 'USD'; // Fallback a USD si no hay moneda

              const rate = currency === 'EUR' ? 1 : (exchangeRates[currency] || 1);

              const currentValue = qty * currentPrice;
              const costBasis = qty * avgPrice;

              // Valores en EUR para totales
              const currentValueEUR = currentValue * rate;
              const costBasisEUR = costBasis * rate;

              const returnPct = costBasis > 0 ? ((currentValue - costBasis) / costBasis) * 100 : 0;

              return {
                ...pos,
                quantity: qty,
                average_buy_price: avgPrice,
                currentPrice,
                currentValue,
                currentValueEUR,
                costBasisEUR, // Guardamos también el coste en EUR
                returnPct,
                change,
                changePercent,
                name
              };
            } catch (e) {
              console.error(`[Portfolio] Error fetching quote for ${pos.ticker}:`, e);
              return {
                ...pos,
                quantity: Number(pos.quantity),
                average_buy_price: Number(pos.average_buy_price),
                currentPrice: 0,
                currentValue: 0,
                currentValueEUR: 0,
                costBasisEUR: 0,
                returnPct: 0,
                change: 0,
                changePercent: 0
              };
            }
          })
        );
        setPositions(positionsWithPrices);
      } else {
        setPositions([]);
      }
    } catch (err: any) {
      console.error('[Portfolio] Error in loadPortfolioDetails:', err);
      setError('No se pudieron cargar los detalles de la cartera.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  const loadPortfolios = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      console.log('[Portfolio] Fetching list...');
      const { data: portfoliosList } = await api.get('/portfolios');

      if (!portfoliosList || !Array.isArray(portfoliosList) || portfoliosList.length === 0) {
        console.warn('[Portfolio] List is empty');
        setLoading(false);
        return;
      }

      const validPortfolios = portfoliosList.filter((p: any) => p && p.id);
      setAvailablePortfolios(validPortfolios);

      if (validPortfolios.length > 0) {
        // Buscar la favorita o usar la primera (la API ya las manda ordenadas por favorita primero)
        const favorite = validPortfolios.find((p: any) => p.is_favorite);
        const targetId = favorite ? favorite.id : validPortfolios[0].id;
        await loadPortfolioDetails(targetId);
      } else {
        setError('No tienes ninguna cartera activa.');
        setLoading(false);
      }
    } catch (err: any) {
      console.error('[Portfolio] Error in loadPortfolios:', err);
      setError('Error al conectar con el servidor.');
      setLoading(false);
    }
  }, [api, loadPortfolioDetails]);

  useEffect(() => {
    loadPortfolios();
  }, [loadPortfolios]);

  const handlePortfolioChange = (newId: string) => {
    if (newId) {
      setLoading(true);
      setShowDropdown(false);
      loadPortfolioDetails(newId);
    }
  };

  const toggleFavorite = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await api.patch(`/portfolios/${id}/favorite`);
      loadPortfolios(); // Recargar para actualizar estrellas
    } catch (err) {
      console.error('Error setting favorite:', err);
    }
  };

  const handleDelete = async () => {
    if (!portfolioToDelete) return;
    try {
      await api.delete(`/portfolios/${portfolioToDelete.id}`);
      setPortfolioToDelete(null);
      loadPortfolios();
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Error al eliminar la cartera';
      alert(msg);
    }
  };

  const handleCreatePortfolio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPortfolioName.trim()) return;

    setIsCreating(true);
    try {
      const { data } = await api.post('/portfolios', { name: newPortfolioName.trim() });
      if (data && data.id) {
        setNewPortfolioName('');
        setShowCreateModal(false);
        // Recargar y seleccionar la nueva
        await loadPortfolios();
        await loadPortfolioDetails(data.id);
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al crear la cartera');
    } finally {
      setIsCreating(false);
    }
  };

  // Eliminar posición
  const handleDeletePosition = async () => {
    if (!positionToDelete || !portfolio) return;

    try {
      await api.delete(`/portfolios/${portfolio.id}/positions/${positionToDelete.id}`);
      setPositionToDelete(null);
      // Recargar portfolio
      await loadPortfolioDetails(portfolio.id);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al eliminar la posición');
    }
  };

  // Editar posición
  const handleUpdatePosition = async () => {
    if (!positionToEdit || !portfolio) return;

    const quantity = parseFloat(editQuantity);
    const averagePrice = parseFloat(editPrice);

    if (isNaN(quantity) || isNaN(averagePrice) || quantity <= 0 || averagePrice <= 0) {
      alert('Por favor, introduce valores válidos');
      return;
    }

    try {
      await api.put(`/portfolios/${portfolio.id}/positions/${positionToEdit.id}`, {
        quantity,
        averagePrice
      });
      setPositionToEdit(null);
      setEditQuantity('');
      setEditPrice('');
      // Recargar portfolio
      await loadPortfolioDetails(portfolio.id);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al actualizar la posición');
    }
  };

  // Abrir modal de edición
  const openEditModal = (pos: Position) => {
    setPositionToEdit(pos);
    setEditQuantity(pos.quantity.toString());
    setEditPrice(pos.average_buy_price.toString());
  };

  // Abrir modal de alerta
  const openAlertModal = (pos: Position) => {
    setPositionToAlert(pos);
    setAlertTargetPrice(pos.currentPrice ? pos.currentPrice.toString() : '');
    // Default condition
    setAlertCondition('below');
  };

  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!positionToAlert || !alertTargetPrice) return;

    setIsCreatingAlert(true);
    try {
      await api.post('/alerts', {
        ticker: positionToAlert.ticker,
        condition: alertCondition,
        target_price: parseFloat(alertTargetPrice)
      });
      alert(`Alerta creada correctamente para ${positionToAlert.ticker}`);
      setPositionToAlert(null);
      setAlertTargetPrice('');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al crear la alerta');
    } finally {
      setIsCreatingAlert(false);
    }
  };

  if (loading) {
    return (
      <main className="flex-1 flex flex-col h-screen bg-background-light dark:bg-background-dark">
        <Header title="Mi Portafolio" />
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-text-secondary-light font-medium animate-pulse">Cargando tus activos...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col h-screen bg-background-light dark:bg-background-dark overflow-y-auto">
      <Header title="Mi Portafolio" />
      <div className="flex flex-col gap-8 px-6 py-10 md:px-10 max-w-[1600px] mx-auto w-full pb-32">

        {/* Header de la sección */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Análisis de Cartera</h1>
            <p className="text-text-secondary-light dark:text-text-secondary-dark text-lg font-medium opacity-80">Visualiza el rendimiento y distribución de tus activos.</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative group">
              <div
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center gap-3 bg-white dark:bg-surface-dark p-2.5 pl-5 rounded-2xl shadow-sm border border-border-light dark:border-border-dark cursor-pointer hover:border-primary/50 transition-all min-w-[280px]"
              >
                <div className="flex flex-col text-left">
                  <span className="text-[10px] font-black uppercase tracking-wider text-primary mb-0.5">Cartera Seleccionada</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold truncate max-w-[170px]">{portfolio?.name}</span>
                    {portfolio?.is_favorite && <span className="material-symbols-outlined text-[14px] text-yellow-500 font-variation-fill" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>}
                  </div>
                </div>
                <span className="material-symbols-outlined text-text-secondary-light ml-auto">expand_more</span>
              </div>

              {showDropdown && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setShowDropdown(false)}></div>
                  <div className="absolute right-0 top-full mt-2 w-full min-w-[300px] bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-3xl shadow-2xl z-30 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="py-2">
                      <div className="px-5 py-2 text-[10px] font-black text-text-secondary-light uppercase tracking-widest border-b border-border-light dark:border-border-dark mb-2 text-left">Mis Carteras</div>
                      {availablePortfolios.map(p => (
                        <div
                          key={p.id}
                          onClick={() => handlePortfolioChange(p.id)}
                          className={`flex items-center justify-between px-5 py-3.5 hover:bg-background-light dark:hover:bg-white/5 cursor-pointer transition-colors group/item ${portfolio?.id === p.id ? 'bg-primary/5 border-l-4 border-primary pl-4' : ''}`}
                        >
                          <span className={`text-sm font-bold truncate ${portfolio?.id === p.id ? 'text-primary' : ''}`}>
                            {p.name}
                          </span>
                          <div className="flex items-center gap-1 opacity-40 group-hover/item:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => toggleFavorite(e, p.id)}
                              className={`p-1.5 rounded-lg transition-all ${p.is_favorite ? 'text-yellow-500' : 'text-text-secondary-light hover:text-yellow-500 hover:bg-yellow-500/10'}`}
                            >
                              <span className="material-symbols-outlined text-lg font-variation-fill" style={{ fontVariationSettings: p.is_favorite ? "'FILL' 1" : "'FILL' 0" }}>star</span>
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setPortfolioToDelete(p); setShowDropdown(false); }}
                              className="p-1.5 text-text-secondary-light hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                            >
                              <span className="material-symbols-outlined text-lg">delete</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="size-14 flex items-center justify-center rounded-2xl bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-sm hover:border-primary hover:text-primary transition-all active:scale-95 group"
              title="Crear nueva cartera"
            >
              <span className="material-symbols-outlined text-3xl group-hover:rotate-90 transition-transform">add</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="p-5 rounded-3xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm flex items-center gap-3">
            <span className="material-symbols-outlined text-red-500">error</span>
            {error}
          </div>
        )}

        <div className="w-full rounded-[2.5rem] bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-xl shadow-black/5 overflow-hidden">
          <div className="p-8">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold flex items-center gap-3">
                <span className="material-symbols-outlined text-primary">pie_chart</span>
                Composición de Activos
              </h3>
              <Link
                to="/manual-entry"
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-black font-bold text-sm hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/20"
              >
                <span className="material-symbols-outlined text-lg">add_circle</span>
                Añadir Activo
              </Link>
            </div>

            {positions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="size-24 rounded-full bg-primary/10 flex items-center justify-center mb-8">
                  <span className="material-symbols-outlined text-5xl text-primary">account_balance_wallet</span>
                </div>
                <h4 className="text-2xl font-bold mb-4">Esta cartera está vacía</h4>
                <p className="text-text-secondary-light dark:text-text-secondary-dark mb-10 max-w-sm text-lg leading-relaxed">
                  No hay operaciones registradas en "{portfolio?.name || 'esta cartera'}".
                </p>
                <Link
                  to="/manual-entry"
                  className="flex items-center gap-3 px-8 py-4 rounded-full bg-primary text-black font-bold text-lg hover:scale-105 transition-all shadow-xl shadow-primary/20"
                >
                  <span className="material-symbols-outlined">add</span>
                  Registrar mi primera compra
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-8">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-separate border-spacing-0">
                    <thead>
                      <tr className="text-xs font-bold uppercase tracking-[0.1em] text-text-secondary-light">
                        <th className="px-6 py-5 border-b border-border-light dark:border-border-dark">Activo</th>
                        <th className="px-6 py-5 border-b border-border-light dark:border-border-dark text-right">Cantidad</th>
                        <th className="px-6 py-5 border-b border-border-light dark:border-border-dark text-right">Precio Medio</th>
                        <th className="px-6 py-5 border-b border-border-light dark:border-border-dark text-right">Coti. Actual</th>
                        <th className="px-6 py-5 border-b border-border-light dark:border-border-dark text-right">Valor Mercado</th>
                        <th className="px-6 py-5 border-b border-border-light dark:border-border-dark text-right">Rentabilidad</th>
                        <th className="px-6 py-5 border-b border-border-light dark:border-border-dark text-center w-24">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {positions.map((pos) => (
                        <tr key={pos.id} className="group hover:bg-background-light dark:hover:bg-surface-dark-elevated/40 transition-all">
                          <td className="px-6 py-6 border-b border-border-light/50 dark:border-border-dark/30">
                            <div className="flex flex-col">
                              <span className="font-bold text-base text-text-primary-light dark:text-white truncate max-w-[180px]" title={pos.name || pos.ticker}>{pos.name || pos.ticker}</span>
                              <span className="text-xs text-text-secondary-light uppercase font-medium">{pos.ticker}</span>
                            </div>
                          </td>
                          <td className="px-6 py-6 border-b border-border-light/50 dark:border-border-dark/30 text-right font-mono font-medium">
                            {pos.quantity.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 4 })}
                          </td>
                          <td className="px-6 py-6 border-b border-border-light/50 dark:border-border-dark/30 text-right">
                            {formatPrice(pos.average_buy_price, pos.currency)}
                          </td>
                          <td className="px-6 py-6 border-b border-border-light/50 dark:border-border-dark/30 text-right">
                            <div className="flex flex-col items-end">
                              <span className="font-bold text-base text-text-primary-light dark:text-white">
                                {pos.currentPrice ? formatPrice(pos.currentPrice, pos.currency) : '---'}
                              </span>
                              {(pos.change !== undefined && pos.changePercent !== undefined) && (
                                <div className={`flex items-center gap-1 text-xs font-bold leading-none mt-1 ${(pos.change >= 0) ? 'text-green-500' : 'text-red-500'}`}>
                                  <span className="material-symbols-outlined text-[20px] font-variation-fill" style={{ fontVariationSettings: "'FILL' 1" }}>{(pos.change >= 0) ? 'arrow_drop_up' : 'arrow_drop_down'}</span>
                                  <span>
                                    {formatChange(pos.change, pos.changePercent)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-6 border-b border-border-light/50 dark:border-border-dark/30 text-right font-bold text-base">
                            {pos.currentValue ? pos.currentValue.toLocaleString('es-ES', { style: 'currency', currency: pos.currency }) : '---'}
                          </td>
                          <td className="px-6 py-6 border-b border-border-light/50 dark:border-border-dark/30 text-right">
                            <div className={`flex flex-col items-end justify-center px-3 py-1.5 rounded-lg border w-fit ml-auto transition-all ${(pos.returnPct || 0) >= 0 ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
                              <span className="font-bold">{(pos.returnPct || 0) >= 0 ? '+' : ''}{pos.returnPct?.toFixed(2)}%</span>
                              <span className="text-xs opacity-90 font-medium">
                                {((pos.currentValue || 0) - (pos.quantity * pos.average_buy_price)).toLocaleString('es-ES', { style: 'currency', currency: pos.currency })}
                              </span>
                            </div>
                          </td>
                          {/* Columna de Acciones */}
                          <td className="px-6 py-6 border-b border-border-light/50 dark:border-border-dark/30">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => openAlertModal(pos)}
                                className="p-2 rounded-lg hover:bg-yellow-500/20 text-text-secondary-light hover:text-yellow-600 transition-all"
                                title="Crear Alerta de Precio"
                              >
                                <span className="material-symbols-outlined text-lg">notifications_active</span>
                              </button>
                              <button
                                onClick={() => openEditModal(pos)}
                                className="p-2 rounded-lg hover:bg-primary/20 text-text-secondary-light hover:text-primary transition-all"
                                title="Editar posición"
                              >
                                <span className="material-symbols-outlined text-lg">edit</span>
                              </button>
                              <button
                                onClick={() => setPositionToDelete(pos)}
                                className="p-2 rounded-lg hover:bg-red-500/20 text-text-secondary-light hover:text-red-500 transition-all"
                                title="Eliminar posición"
                              >
                                <span className="material-symbols-outlined text-lg">delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Resumen Final Superior */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                  <div className="bg-background-light/50 dark:bg-surface-dark-elevated/40 p-6 rounded-3xl border border-border-light dark:border-border-dark">
                    <p className="text-xs font-bold text-text-secondary-light uppercase mb-2">Valor Total</p>
                    <p className="text-3xl font-black text-text-primary-light dark:text-white">
                      {positions.reduce((sum, p) => sum + (p.currentValueEUR || 0), 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                    </p>
                  </div>
                  <div className="bg-background-light/50 dark:bg-surface-dark-elevated/40 p-6 rounded-3xl border border-border-light dark:border-border-dark">
                    <p className="text-xs font-bold text-text-secondary-light uppercase mb-2">Inversión Coste</p>
                    <p className="text-3xl font-black text-text-primary-light dark:text-white">
                      {positions.reduce((sum, p) => sum + (p.costBasisEUR || 0), 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                    </p>
                  </div>
                  <div className={`p-6 rounded-3xl border ${positions.reduce((sum, p) => sum + (p.currentValueEUR || 0) - (p.costBasisEUR || 0), 0) >= 0
                    ? 'bg-green-500/5 border-green-500/20'
                    : 'bg-red-500/5 border-red-500/20'
                    }`}>
                    <p className="text-xs font-bold text-text-secondary-light uppercase mb-2">Ganancia Total</p>
                    <div className="flex flex-col">
                      <p className={`text-3xl font-black ${positions.reduce((sum, p) => sum + (p.currentValueEUR || 0) - (p.costBasisEUR || 0), 0) >= 0
                        ? 'text-green-500'
                        : 'text-red-500'
                        }`}>
                        {positions.reduce((sum, p) => sum + (p.currentValueEUR || 0) - (p.costBasisEUR || 0), 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Modal de Confirmación de Borrado */}
      {portfolioToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-sm bg-black/40 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-surface-dark rounded-[2.5rem] border border-border-light dark:border-border-dark shadow-2xl p-8 animate-in zoom-in-95 duration-200">
            <div className="size-16 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-4xl">warning</span>
            </div>
            <h3 className="text-2xl font-bold mb-3 tracking-tight">¿Eliminar cartera?</h3>
            <p className="text-text-secondary-light dark:text-text-secondary-dark mb-8 leading-relaxed">
              Estás a punto de eliminar <strong>"{portfolioToDelete.name}"</strong>. Esta acción borrará permanentemente todos los activos y operaciones asociados a esta cartera.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setPortfolioToDelete(null)}
                className="px-6 py-4 rounded-2xl border border-border-light dark:border-border-dark font-bold hover:bg-background-light dark:hover:bg-white/5 transition-all active:scale-95"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                className="px-6 py-4 rounded-2xl bg-red-500 text-white font-bold hover:bg-red-600 transition-all active:scale-95 shadow-lg shadow-red-500/20"
              >
                Eliminar todo
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal de Creación de Cartera */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-sm bg-black/40 animate-in fade-in duration-200">
          <form
            onSubmit={handleCreatePortfolio}
            className="w-full max-w-md bg-white dark:bg-surface-dark rounded-[2.5rem] border border-border-light dark:border-border-dark shadow-2xl p-8 animate-in zoom-in-95 duration-200"
          >
            <div className="size-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-4xl">add_business</span>
            </div>
            <h3 className="text-2xl font-bold mb-2 tracking-tight">Nueva Cartera</h3>
            <p className="text-text-secondary-light dark:text-text-secondary-dark mb-8 text-sm leading-relaxed">
              Organiza tus activos en diferentes carteras para un mejor seguimiento.
            </p>

            <div className="flex flex-col gap-2 mb-8">
              <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary-light ml-4">Nombre de la Cartera</label>
              <input
                autoFocus
                type="text"
                placeholder="Ej: Inversión a Largo Plazo"
                className="w-full px-6 py-4 rounded-2xl bg-background-light dark:bg-surface-dark-elevated border border-border-light dark:border-border-dark outline-none focus:ring-2 focus:ring-primary font-bold transition-all"
                value={newPortfolioName}
                onChange={(e) => setNewPortfolioName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-6 py-4 rounded-2xl border border-border-light dark:border-border-dark font-bold hover:bg-background-light dark:hover:bg-white/5 transition-all active:scale-95"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isCreating || !newPortfolioName.trim()}
                className="px-6 py-4 rounded-2xl bg-primary text-black font-bold hover:opacity-90 transition-all active:scale-95 shadow-lg shadow-primary/20 disabled:opacity-50"
              >
                {isCreating ? 'Creando...' : 'Crear Cartera'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Confirmar Eliminar Posición */}
      {positionToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-surface-dark rounded-3xl p-8 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-red-500 text-2xl">delete</span>
              </div>
              <h3 className="text-xl font-bold">Eliminar Posición</h3>
            </div>
            <p className="text-text-secondary-light mb-6">
              ¿Estás seguro de eliminar <strong className="text-text-primary-light dark:text-white">{positionToDelete.ticker}</strong>?
              Esta acción eliminará la posición <strong>y todas sus transacciones</strong> de forma permanente.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setPositionToDelete(null)}
                className="px-6 py-4 rounded-2xl border border-border-light dark:border-border-dark font-bold hover:bg-background-light dark:hover:bg-white/5 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeletePosition}
                className="px-6 py-4 rounded-2xl bg-red-500 text-white font-bold hover:bg-red-600 transition-all shadow-lg"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Posición */}
      {positionToEdit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-surface-dark rounded-3xl p-8 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-2xl">edit</span>
              </div>
              <div>
                <h3 className="text-xl font-bold">Editar Posición</h3>
                <p className="text-sm text-text-secondary-light">{positionToEdit.ticker}</p>
              </div>
            </div>

            <div className="flex flex-col gap-4 mb-6">
              <div>
                <label className="block text-xs font-bold uppercase text-text-secondary-light mb-2">
                  Cantidad
                </label>
                <input
                  type="number"
                  step="any"
                  value={editQuantity}
                  onChange={(e) => setEditQuantity(e.target.value)}
                  className="w-full px-4 py-3 bg-background-light dark:bg-surface-dark-elevated rounded-xl border-none focus:ring-2 focus:ring-primary"
                  placeholder="Cantidad de acciones"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-text-secondary-light mb-2">
                  Precio Medio de Compra ({positionToEdit.currency})
                </label>
                <input
                  type="number"
                  step="any"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  className="w-full px-4 py-3 bg-background-light dark:bg-surface-dark-elevated rounded-xl border-none focus:ring-2 focus:ring-primary"
                  placeholder="Precio medio"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => {
                  setPositionToEdit(null);
                  setEditQuantity('');
                  setEditPrice('');
                }}
                className="px-6 py-4 rounded-2xl border border-border-light dark:border-border-dark font-bold hover:bg-background-light dark:hover:bg-white/5 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpdatePosition}
                className="px-6 py-4 rounded-2xl bg-primary text-black font-bold hover:opacity-90 transition-all shadow-lg shadow-primary/20"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Crear Alerta */}
      {positionToAlert && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-sm bg-black/40 animate-in fade-in duration-200">
          <form
            onSubmit={handleCreateAlert}
            className="w-full max-w-md bg-white dark:bg-surface-dark rounded-[2.5rem] border border-border-light dark:border-border-dark shadow-2xl p-8 animate-in zoom-in-95 duration-200"
          >
            <div className="size-16 rounded-2xl bg-yellow-500/10 text-yellow-500 flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-4xl font-variation-fill" style={{ fontVariationSettings: "'FILL' 1" }}>notifications</span>
            </div>
            <h3 className="text-2xl font-bold mb-2 tracking-tight">Crear Alerta</h3>
            <p className="text-text-secondary-light dark:text-text-secondary-dark mb-6 text-sm">
              Recibirás una notificación cuando <strong>{positionToAlert.ticker}</strong> cumpla la condición.
            </p>

            <div className="flex flex-col gap-4 mb-8">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary-light ml-4 mb-2 block">Condición</label>
                <select
                  value={alertCondition}
                  onChange={e => setAlertCondition(e.target.value as 'above' | 'below')}
                  className="w-full px-6 py-4 rounded-2xl bg-background-light dark:bg-surface-dark-elevated border border-border-light dark:border-border-dark outline-none focus:ring-2 focus:ring-primary font-bold transition-all appearance-none cursor-pointer"
                >
                  <option value="below">Precio menor que</option>
                  <option value="above">Precio mayor que</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary-light ml-4 mb-2 block">Precio Objetivo ({positionToAlert.currency})</label>
                <input
                  autoFocus
                  type="number"
                  step="any"
                  placeholder="0.00"
                  className="w-full px-6 py-4 rounded-2xl bg-background-light dark:bg-surface-dark-elevated border border-border-light dark:border-border-dark outline-none focus:ring-2 focus:ring-primary font-bold transition-all"
                  value={alertTargetPrice}
                  onChange={(e) => setAlertTargetPrice(e.target.value)}
                />
                <p className="text-xs text-text-secondary-light mt-2 ml-4">
                  Precio actual: <strong>{positionToAlert.currentPrice ? formatPrice(positionToAlert.currentPrice, positionToAlert.currency) : '---'}</strong>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setPositionToAlert(null)}
                className="px-6 py-4 rounded-2xl border border-border-light dark:border-border-dark font-bold hover:bg-background-light dark:hover:bg-white/5 transition-all active:scale-95"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isCreatingAlert || !alertTargetPrice}
                className="px-6 py-4 rounded-2xl bg-yellow-400 text-black font-bold hover:opacity-90 transition-all active:scale-95 shadow-lg shadow-yellow-400/20 disabled:opacity-50"
              >
                {isCreatingAlert ? 'Creando...' : 'Crear Alerta'}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
};
