import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Header } from '../components/Header';
import { TradingViewChart } from '../components/TradingViewChart';

export const MarketAnalysis: React.FC = () => {
  const { user, api } = useAuth();
  const [topAsset, setTopAsset] = useState<string>("NASDAQ:AAPL");
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [loading, setLoading] = useState(true);

  // Carteras select
  const [portfolios, setPortfolios] = useState<any[]>([]);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>('');

  // Detección de tema
  useEffect(() => {
    const checkTheme = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setTheme(isDark ? 'dark' : 'light');
    };
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Helper para convertir tickers de Yahoo/Backend a formato TradingView
  const normalizeTicker = (ticker: string) => {
    if (!ticker) return "";
    // Madrid
    if (ticker.endsWith('.MC')) return `BME:${ticker.replace('.MC', '')}`;
    // Xetra (Alemania)
    if (ticker.endsWith('.DE')) return `XETR:${ticker.replace('.DE', '')}`;
    // Paris
    if (ticker.endsWith('.PA')) return `EURONEXT:${ticker.replace('.PA', '')}`;
    // Amsterdam
    if (ticker.endsWith('.AS')) return `EURONEXT:${ticker.replace('.AS', '')}`;
    // Lisboa
    if (ticker.endsWith('.LS')) return `EURONEXT:${ticker.replace('.LS', '')}`;
    // Crypto (ej. BTC-USD)
    if (ticker.includes('-')) return `BINANCE:${ticker.replace('-', '')}`;

    return ticker;
  };

  // 1. Cargar lista de carteras al inicio
  useEffect(() => {
    const fetchPortfolios = async () => {
      try {
        const { data } = await api.get('/portfolios');
        if (Array.isArray(data) && data.length > 0) {
          setPortfolios(data);
          const favorite = data.find((p: any) => p.is_favorite) || data[0];
          setSelectedPortfolioId(favorite.id);
        }
      } catch (err) {
        console.error("Error loading portfolios:", err);
      }
    };
    if (user) fetchPortfolios();
  }, [user, api]);

  // 2. Cargar datos de la cartera seleccionada
  useEffect(() => {
    const fetchPortfolioData = async () => {
      if (!selectedPortfolioId) return;
      try {
        setLoading(true);
        const { data: details } = await api.get(`/portfolios/${selectedPortfolioId}`);
        if (details && details.positions && details.positions.length > 0) {
          const positions = details.positions;

          // Construir Watchlist normalizada
          const tickers = positions.map((p: any) => normalizeTicker(p.ticker));
          setWatchlist(tickers);

          // Encontrar Top Asset (por valor total)
          const sortedByValue = [...positions].sort((a: any, b: any) =>
            (b.quantity * b.average_buy_price) - (a.quantity * a.average_buy_price)
          );
          if (sortedByValue.length > 0) {
            setTopAsset(normalizeTicker(sortedByValue[0].ticker));
          }
        } else {
          // Si no hay posiciones, resetear
          setWatchlist([]);
          setTopAsset("NASDAQ:AAPL");
        }
      } catch (e) {
        console.error("Error cargando datos de la cartera", e);
      } finally {
        setLoading(false);
      }
    };

    fetchPortfolioData();
  }, [selectedPortfolioId, api]);

  return (
    <main className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header estándar con estado de mercado integrado */}


      {/* Selector de Cartera Sub-Header */}
      <div className="px-6 py-4 md:px-10 bg-background-light dark:bg-background-dark border-b border-border-light/30 dark:border-border-dark/30 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm font-bold opacity-60 uppercase tracking-wider">Cartera de Análisis:</span>
          <select
            value={selectedPortfolioId}
            onChange={(e) => setSelectedPortfolioId(e.target.value)}
            className="bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-1.5 font-bold focus:outline-none focus:ring-2 focus:ring-primary transition-all text-sm min-w-[200px]"
            disabled={portfolios.length === 0}
          >
            {portfolios.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} {p.is_favorite ? '★' : ''}
              </option>
            ))}
          </select>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-primary">
            <div className="size-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs font-bold uppercase tracking-tighter">Sincronizando...</span>
          </div>
        )}
      </div>

      {/* Contenedor del Gráfico ocupando todo el espacio restante */}
      <div className="flex-1 w-full bg-white dark:bg-surface-dark relative">
        <TradingViewChart
          key={selectedPortfolioId} // Force refresh on portfolio change
          symbol={topAsset}
          theme={theme}
          watchlist={watchlist}
          autosize={true}
        />
      </div>
    </main>
  );
};
