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

  // Cargar datos de la cartera para la watchlist y topAsset
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Obtener portafolios para buscar el favorito
        const { data: portfolios } = await api.get('/portfolios');
        if (Array.isArray(portfolios) && portfolios.length > 0) {
          const favorite = portfolios.find((p: any) => p.is_favorite) || portfolios[0];

          // Detalle del portafolio
          const { data: details } = await api.get(`/portfolios/${favorite.id}`);
          if (details && details.positions && details.positions.length > 0) {
            const positions = details.positions;

            // Construir Watchlist normalizada
            const tickers = positions.map((p: any) => normalizeTicker(p.ticker));
            setWatchlist(tickers);

            // Encontrar Top Asset
            const sortedByValue = [...positions].sort((a: any, b: any) =>
              (b.quantity * b.average_buy_price) - (a.quantity * a.average_buy_price)
            );
            if (sortedByValue.length > 0) {
              setTopAsset(normalizeTicker(sortedByValue[0].ticker));
            }
          }
        }
      } catch (e) {
        console.error("Error cargando datos de mercado", e);
      } finally {
        setLoading(false);
      }
    };

    if (user) fetchData();
  }, [user, api]);

  return (
    <main className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header estándar con estado de mercado integrado */}
      <Header title="Mercado Global" />

      {/* Contenedor del Gráfico ocupando todo el espacio restante */}
      <div className="flex-1 w-full bg-white dark:bg-surface-dark border-t border-border-light dark:border-border-dark relative">
        <TradingViewChart
          symbol={topAsset}
          theme={theme}
          watchlist={watchlist}
          autosize={true}
        />
      </div>
    </main>
  );
};
