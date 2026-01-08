
import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '../components/Header';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';

interface WatchlistItem {
  id: string;
  ticker: string;
  name: string;
  price?: number;
  change?: number;
  currency?: string;
  exchange?: string;
}

export const WatchlistsScreen: React.FC = () => {
  const { api } = useAuth();
  const { t } = useTranslation(); // t is declared but not used in the original code, keeping it
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Fetch watchlist and enrich with quotes
  const fetchWatchlist = useCallback(async () => {
    try {
      setLoading(true);
      const { data: items } = await api.get('/watchlist');

      // Fetch quotes in parallel
      const itemsWithQuotes = await Promise.all(
        (items || []).map(async (item: any) => {
          try {
            const { data: quote } = await api.get(`/market/quote?ticker=${item.ticker}`);
            return {
              ...item,
              price: quote?.c || 0,
              change: quote?.dp || 0,
              currency: quote?.currency || 'USD'
            };
          } catch {
            return { ...item, price: 0, change: 0 };
          }
        })
      );

      setWatchlist(itemsWithQuotes);
    } catch (e) {
      console.error('Error fetching watchlist', e);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchWatchlist();
  }, [fetchWatchlist]);

  // Search logic
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchTerm.length > 1) {
        setIsSearching(true);
        try {
          const { data } = await api.get(`/market/search?q=${searchTerm}`);
          setSearchResults(data || []);
        } catch (e) {
          console.error(e);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, api]);

  const addToWatchlist = async (asset: any) => {
    try {
      // Optimistic Update
      const optimisticItem = {
        id: 'temp-' + Date.now(),
        ticker: asset.symbol,
        name: asset.description || asset.symbol, // Yahoo search returns description
        price: 0,
        change: 0,
        currency: 'USD' // default
      };
      setWatchlist(prev => [optimisticItem, ...prev]);

      await api.post('/watchlist', {
        ticker: asset.symbol,
        name: asset.description || asset.symbol
      });
      setSearchTerm('');
      setSearchResults([]);
      fetchWatchlist(); // Refresh to get real ID and Quote
    } catch (e) {
      console.error(e);
      fetchWatchlist(); // Revert on error
    }
  };

  const removeFromWatchlist = async (ticker: string) => {
    try {
      // Optimistic update
      setWatchlist(prev => prev.filter(item => item.ticker !== ticker));
      await api.delete(`/watchlist/${ticker}`);
    } catch (e) {
      console.error(e);
      fetchWatchlist();
    }
  };

  const formatCurrency = (val: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency }).format(val);
  };

  return (
    <main className="flex-1 flex flex-col h-screen bg-background-light dark:bg-background-dark overflow-y-auto">


      <div className="flex flex-col gap-8 px-6 pb-12 md:px-12 max-w-[1600px] mx-auto w-full">

        {/* Search Header Area */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="relative w-full max-w-xl group z-50">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <span className="material-symbols-outlined text-text-secondary-light group-focus-within:text-primary transition-colors">search</span>
            </div>
            <input
              type="text"
              placeholder="Buscar empresa, índice o cripto (ej: AAPL, BTC-USD)..."
              className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-sm focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            {/* Search Results Dropdown */}
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-3 bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-2xl shadow-2xl overflow-hidden max-h-[400px] overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                {searchResults.map((res, idx) => {
                  const isAdded = watchlist.some(item => item.ticker === res.symbol);
                  return (
                    <button
                      key={idx}
                      onClick={() => !isAdded && addToWatchlist(res)}
                      disabled={isAdded}
                      className={`w-full flex items-center justify-between p-4 border-b border-border-light dark:border-border-dark last:border-none group/item transition-colors ${isAdded ? 'opacity-50 cursor-default bg-gray-50 dark:bg-white/5' : 'hover:bg-gray-50 dark:hover:bg-white/5'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`size-10 rounded-full flex items-center justify-center text-xs font-bold ${isAdded ? 'bg-green-500/10 text-green-500' : 'bg-primary/10 text-primary'}`}>
                          {isAdded ? <span className="material-symbols-outlined text-lg">check</span> : res.symbol.slice(0, 1)}
                        </div>
                        <div className="flex flex-col items-start">
                          <span className="font-bold text-sm tracking-tight group-hover/item:text-primary transition-colors">{res.symbol}</span>
                          <span className="text-xs text-text-secondary-light">{res.description || res.name}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {res.currency && (
                          <span className="text-[10px] font-bold text-text-secondary-light border border-border-light dark:border-border-dark px-1.5 py-0.5 rounded-md">
                            {res.currency}
                          </span>
                        )}
                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md ${isAdded ? 'bg-green-500/10 text-green-500' : 'bg-gray-100 dark:bg-white/10 text-text-secondary-light'}`}>
                          {isAdded ? 'Siguiendo' : res.exchange}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <button
            onClick={fetchWatchlist}
            className="p-3 bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-all shadow-sm active:scale-95"
            title="Actualizar precios"
          >
            <span className={`material-symbols-outlined ${loading ? 'animate-spin' : ''}`}>sync</span>
          </button>
        </div>

        {/* Watchlist Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {watchlist.map((item) => (
            <div key={item.id} className="relative flex flex-col p-6 rounded-[2rem] bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-sm hover:shadow-xl hover:border-primary/50 transition-all group animate-in fade-in zoom-in-95 duration-300">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-white/5 dark:to-white/10 flex items-center justify-center text-xs font-bold shadow-inner">
                    {item.ticker.slice(0, 2)}
                  </div>
                  <div>
                    <h3 className="text-xl font-black tracking-tight leading-none">{item.ticker}</h3>
                    <p className="text-xs text-text-secondary-light font-medium line-clamp-1 mt-1" title={item.name}>{item.name}</p>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); removeFromWatchlist(item.ticker); }}
                  className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-500/10 text-red-500 rounded-xl transition-all scale-90 group-hover:scale-100"
                  title="Dejar de seguir"
                >
                  <span className="material-symbols-outlined text-xl">bookmark_remove</span>
                </button>
              </div>

              <div className="mt-auto">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold tracking-tight text-text-primary-light dark:text-white">
                    {item.price ? formatCurrency(item.price, item.currency) : '...'}
                  </span>
                </div>

                <div className="flex items-center gap-2 mt-3">
                  <div className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider ${item.change && item.change >= 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                    <span className="material-symbols-outlined text-[14px]">{item.change && item.change >= 0 ? 'trending_up' : 'trending_down'}</span>
                    {item.change ? `${item.change >= 0 ? '+' : ''}${item.change.toFixed(2)}%` : '0.00%'}
                  </div>
                  <span className="text-[10px] font-bold text-text-secondary-light uppercase tracking-widest ml-auto">24H Change</span>
                </div>
              </div>

              {/* Decorative background gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-primary/5 opacity-0 group-hover:opacity-100 rounded-[2rem] transition-opacity pointer-events-none"></div>
            </div>
          ))}

          {/* Empty State */}
          {!loading && watchlist.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-20 text-center opacity-60">
              <div className="size-24 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-4xl text-text-secondary-light">bookmarks</span>
              </div>
              <h3 className="text-xl font-bold mb-2">Tu lista está vacía</h3>
              <p className="text-sm text-text-secondary-light max-w-xs mx-auto">Busca empresas o activos arriba para añadirlos a tu seguimiento.</p>
            </div>
          )}
        </div>

      </div>
    </main>
  );
};
