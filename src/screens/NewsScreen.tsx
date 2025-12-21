import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Header } from '../components/Header';

interface NewsItem {
  category: string;
  datetime: number;
  headline: string;
  id: number;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
}

export const NewsScreen: React.FC = () => {
  const { t } = useTranslation();
  const { api, user } = useAuth();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    const fetchPortfolioNews = async () => {
      try {
        setLoading(true);
        // 1. Get User Portfolio Tickers
        const { data: portfolios } = await api.get('/portfolios');
        if (portfolios.length === 0) {
          setLoading(false);
          return;
        }

        // Get details of first portfolio to get tickers
        // In a real app we might want to aggregate all unique tickers from all portfolios
        const { data: detail } = await api.get(`/portfolios/${portfolios[0].id}`);
        const tickers = detail.positions?.map((p: any) => p.ticker) || [];

        // If no tickers, maybe show general news (e.g., SPY, AAPL as default)
        const targetTickers = tickers.length > 0 ? tickers : ['AAPL', 'MSFT', 'AMZN'];

        // 2. Fetch News for each ticker
        const promises = targetTickers.map((ticker: string) =>
          api.get<NewsItem[]>(`/market/news?ticker=${ticker}`)
            .then(res => res.data.map(item => ({ ...item, related: ticker }))) // Tag with ticker
            .catch(() => [])
        );

        const results = await Promise.all(promises);
        const allNews = results.flat().sort((a, b) => b.datetime - a.datetime);

        setNews(allNews);
      } catch (e) {
        console.error("Error loading news", e);
      } finally {
        setLoading(false);
      }
    };

    if (user) fetchPortfolioNews();
  }, [api, user]);

  const filteredNews = news.filter(item =>
    item.headline.toLowerCase().includes(filter.toLowerCase()) ||
    item.summary.toLowerCase().includes(filter.toLowerCase()) ||
    item.related.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <main className="flex-1 flex flex-col h-full bg-background-light dark:bg-background-dark overflow-hidden">
      <Header title={t('menu.news')} />

      <div className="flex-1 overflow-y-auto p-6 md:p-10 max-w-[1600px] mx-auto w-full flex flex-col gap-6">
        {/* Search / Filter */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white dark:bg-surface-dark p-6 rounded-[2rem] border border-border-light dark:border-border-dark shadow-sm">
          <div>
            <h3 className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark">Tus Noticias Financieras</h3>
            <p className="text-sm text-text-secondary-light">Basado en tu portafolio y movimientos de mercado.</p>
          </div>
          <input
            type="text"
            placeholder="Filtrar noticias..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="w-full md:w-64 px-4 py-2 rounded-full bg-background-light dark:bg-background-dark border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* News Grid */}
        {loading ? (
          <div className="text-center py-20 text-gray-500">{t('common.loading')}</div>
        ) : filteredNews.length === 0 ? (
          <div className="text-center py-20 text-gray-500">No se encontraron noticias recientes.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredNews.map((item) => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col bg-white dark:bg-surface-dark rounded-[2rem] overflow-hidden border border-border-light dark:border-border-dark shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group"
              >
                {/* Imagen o placeholder con gradiente y ticker */}
                {item.image ? (
                  <div
                    className="h-48 w-full bg-gray-200 dark:bg-gray-800 bg-cover bg-center relative"
                    style={{ backgroundImage: `url(${item.image})` }}
                  >
                    {/* Overlay con el ticker */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                      <span className="text-white font-bold text-lg">{item.related}</span>
                    </div>
                  </div>
                ) : (
                  <div className="h-48 w-full bg-gradient-to-br from-primary/20 via-surface-dark to-accent-blue/20 flex flex-col items-center justify-center relative">
                    <span className="text-5xl font-black text-primary/50">{item.related}</span>
                    <span className="text-xs text-text-secondary-light mt-2">Noticias Financieras</span>
                  </div>
                )}
                <div className="p-6 flex flex-col flex-1 gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold tracking-widest uppercase text-primary bg-primary/10 px-2 py-1 rounded-lg">{item.source}</span>
                    <span className="text-xs text-text-secondary-light">{new Date(item.datetime * 1000).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                  <h4 className="text-lg font-bold leading-tight text-text-primary-light dark:text-text-primary-dark group-hover:text-primary transition-colors line-clamp-2">{item.headline}</h4>
                  <div className="mt-auto pt-4 flex items-center gap-2 text-xs font-semibold text-text-primary-light dark:text-text-primary-dark">
                    <span className="material-symbols-outlined text-sm">trending_up</span>
                    <span>{item.related}</span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </main>
  );
};
