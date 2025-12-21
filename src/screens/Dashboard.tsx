import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Header } from '../components/Header';
import { TradingViewChart } from '../components/TradingViewChart';

// Interfaces
interface Position {
  ticker: string;
  quantity: number;
  average_buy_price: number;
  currency: string;
  asset_type: string;
}

interface Portfolio {
  id: string;
  name: string;
  positions: Position[];
}

export const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const { user, api } = useAuth();

  const [portfolios, setPortfolios] = useState<any[]>([]);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>('');

  const [totalValue, setTotalValue] = useState<number>(0);
  const [todaysGain, setTodaysGain] = useState<number>(0);
  const [gainPercent, setGainPercent] = useState<number>(0);
  const [totalGain, setTotalGain] = useState<number>(0);
  const [totalGainPercent, setTotalGainPercent] = useState<number>(0);
  const [sectorAllocation, setSectorAllocation] = useState<any[]>([]);
  const [topAsset, setTopAsset] = useState<string>("NASDAQ:AAPL"); // Default fallback
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  // AI State
  const [insight, setInsight] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Detect logic theme changes
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

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // 2. Get Portfolios
        const { data: portfoliosList } = await api.get('/portfolios');
        let activeId = selectedPortfolioId;

        if (Array.isArray(portfoliosList)) {
          setPortfolios(portfoliosList);

          // Set default if none selected
          if (!activeId && portfoliosList.length > 0) {
            const favorite = portfoliosList.find((p: any) => p.is_favorite) || portfoliosList[0];
            activeId = favorite.id;
            setSelectedPortfolioId(activeId);
          }
        }

        // 3. Get Summary (Filtered)
        if (activeId) {
          const { data: summary } = await api.get(`/portfolios/summary?portfolioId=${activeId}`);

          if (summary && !summary.error) {
            setTotalValue(summary.totalValueEur || 0);
            setTodaysGain(summary.dailyChangeEur || 0);
            setGainPercent(summary.dailyChangePercent || 0);
            setTotalGain(summary.totalGainEur || 0);
            setTotalGainPercent(summary.totalGainPercent || 0);
          }

          // 4. Get Details for Sector Chart & Top Asset
          const { data: details } = await api.get(`/portfolios/${activeId}`);

          if (details && details.positions && details.positions.length > 0) {
            const positions = details.positions;

            // Build Watchlist
            const tickers = positions.map((p: any) => p.ticker);
            setWatchlist(tickers);

            // Find Top Asset (Highest Value)
            const sortedByValue = [...positions].sort((a: any, b: any) =>
              (b.quantity * b.average_buy_price) - (a.quantity * a.average_buy_price)
            );

            if (sortedByValue.length > 0) {
              setTopAsset(sortedByValue[0].ticker);
            }

            // Fetch sector distribution
            try {
              const { data: sectorData } = await api.post('/market/sector-distribution', { tickers });

              if (sectorData && !sectorData.error) {
                const sectorValues: Record<string, number> = {};

                for (const pos of positions) {
                  const info = sectorData[pos.ticker];
                  const sector = info?.sector || 'Desconocido';
                  const value = pos.quantity * pos.average_buy_price;
                  sectorValues[sector] = (sectorValues[sector] || 0) + value;
                }

                const sectorColors: Record<string, string> = {
                  'Technology': '#60a5fa',
                  'Healthcare': '#34d399',
                  'Financial Services': '#fbbf24',
                  'Consumer Cyclical': '#f472b6',
                  'Consumer Defensive': '#fb923c',
                  'Industrials': '#a78bfa',
                  'Energy': '#ef4444',
                  'Basic Materials': '#c084fc',
                  'Communication Services': '#22d3ee',
                  'Real Estate': '#14b8a6',
                  'Utilities': '#6366f1',
                  'Desconocido': '#6b7280'
                };

                const sectorArray = Object.entries(sectorValues).map(([name, value]) => ({
                  name,
                  value,
                  color: sectorColors[name] || '#6b7280'
                }));

                sectorArray.sort((a, b) => b.value - a.value);
                setSectorAllocation(sectorArray);
              }
            } catch (e) {
              console.error('Error fetching sector distribution', e);
            }
          } else {
            setSectorAllocation([]);
            setTopAsset("N/A");
          }
        }
      } catch (e) {
        console.error("Error fetching dashboard data", e);
      } finally {
        setLoading(false);
      }
    };

    if (user) fetchData();
  }, [user, api, selectedPortfolioId]);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      const { data } = await api.post('/ai/chat', { message: "Analiza mi portafolio actual y dame recomendaciones estratégicas." });
      setInsight(data.answer);
    } catch (e) {
      setInsight('Error al conectar con la IA.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(val);
  };

  if (loading) return <div className="p-10 text-center">{t('common.loading')}</div>;

  return (
    <main className="flex-1 flex flex-col h-full overflow-y-auto scroll-smooth">
      <div className="flex flex-col md:flex-row items-center justify-between px-6 pt-6 md:px-10">
        <Header title={`Hola, ${user?.name || 'Inversor'}`} />

        {/* Portfolio Switcher */}
        <div className="mt-4 md:mt-0 relative">
          <select
            className="appearance-none bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark rounded-xl px-4 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-primary font-bold cursor-pointer hover:shadow-md transition-shadow"
            value={selectedPortfolioId}
            onChange={(e) => setSelectedPortfolioId(e.target.value)}
          >
            {portfolios.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} {p.is_favorite ? '★' : ''}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-text-secondary-light">
            <span className="material-symbols-outlined text-sm">expand_more</span>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-6 px-6 pb-16 md:px-10 max-w-[1600px] mx-auto w-full">
        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Net Worth */}
          <div className="flex flex-col gap-1 p-8 rounded-[2.5rem] bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-sm hover:shadow-xl hover:border-primary/50 transition-all group">
            <div className="flex items-center justify-between mb-4">
              <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined font-bold">wallet</span>
              </div>
              <span className="text-xs font-bold text-text-secondary-light tracking-widest uppercase">{t('dashboard.net_worth')}</span>
            </div>
            <p className="text-4xl font-bold tracking-tight text-text-primary-light dark:text-text-primary-dark">{formatCurrency(totalValue)}</p>
            <div className="mt-6 flex items-center gap-2">
              <span className={`font-bold text-sm ${gainPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {gainPercent >= 0 ? '↑' : '↓'} {Math.abs(gainPercent).toFixed(2)}% (Hoy)
              </span>
            </div>
          </div>

          {/* Daily Gain */}
          <div className={`flex flex-col gap-1 p-8 rounded-[2.5rem] bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-sm hover:shadow-xl transition-all group ${todaysGain >= 0 ? 'hover:border-green-500/30' : 'hover:border-red-500/30'}`}>
            <div className="flex items-center justify-between mb-4">
              <div className={`size-12 rounded-2xl flex items-center justify-center ${todaysGain >= 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                <span className="material-symbols-outlined font-bold">{todaysGain >= 0 ? 'trending_up' : 'trending_down'}</span>
              </div>
              <span className="text-xs font-bold text-text-secondary-light tracking-widest uppercase">{t('dashboard.todays_gain')}</span>
            </div>
            <div className="flex items-baseline gap-3">
              <p className={`text-4xl font-bold tracking-tight ${todaysGain >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {todaysGain >= 0 ? '+' : ''}{formatCurrency(todaysGain)}
              </p>
              <span className={`px-2 py-1 rounded-lg text-xs font-black ${todaysGain >= 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                {todaysGain >= 0 ? '+' : ''}{gainPercent.toFixed(2)}%
              </span>
            </div>
          </div>

          {/* Total Gain (NEW) */}
          <div className={`flex flex-col gap-1 p-8 rounded-[2.5rem] bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-sm hover:shadow-xl transition-all group ${totalGain >= 0 ? 'hover:border-green-500/30' : 'hover:border-red-500/30'}`}>
            <div className="flex items-center justify-between mb-4">
              <div className={`size-12 rounded-2xl flex items-center justify-center ${totalGain >= 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                <span className="material-symbols-outlined font-bold">show_chart</span>
              </div>
              <span className="text-xs font-bold text-text-secondary-light tracking-widest uppercase">Ganancia Total</span>
            </div>
            <div className="flex items-baseline gap-3">
              <p className={`text-4xl font-bold tracking-tight ${totalGain >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {totalGain >= 0 ? '+' : ''}{formatCurrency(totalGain)}
              </p>
              <span className={`px-2 py-1 rounded-lg text-xs font-black ${totalGain >= 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                {totalGain >= 0 ? '+' : ''}{totalGainPercent.toFixed(2)}%
              </span>
            </div>
          </div>

          {/* AI Banner */}
          <div className="flex flex-col gap-1 p-8 rounded-[2.5rem] bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-sm hover:shadow-xl hover:border-accent-blue/30 transition-all group">
            <div className="flex items-center justify-between mb-4">
              <div className="size-12 rounded-2xl bg-accent-blue/10 flex items-center justify-center text-accent-blue">
                <span className="material-symbols-outlined font-bold">insights</span>
              </div>
              <span className="text-xs font-bold text-text-secondary-light tracking-widest uppercase">{t('dashboard.ai_analysis')}</span>
            </div>
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="mt-2 w-full py-3 rounded-xl bg-accent-blue/10 text-accent-blue font-bold hover:bg-accent-blue hover:text-white transition-all"
            >
              {isAnalyzing ? "Analizando..." : "Consultar Gemini"}
            </button>
          </div>
        </div>

        {/* AI Insight Result */}
        {insight && (
          <div className="p-6 rounded-[2rem] bg-[#1a1a14] text-white border border-primary/20">
            <h3 className="font-bold text-primary mb-2">Gemini Insight</h3>
            <p className="whitespace-pre-wrap text-sm text-gray-300">{insight}</p>
          </div>
        )}

        {/* Charts & Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Chart Placeholder (Future PnL) */}
          <div className="lg:col-span-9 flex flex-col p-8 rounded-[3rem] bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-sm h-[400px] items-center justify-center text-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="size-20 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform duration-300">
              <span className="material-symbols-outlined text-4xl">ssid_chart</span>
            </div>
            <h3 className="text-2xl font-bold dark:text-white mb-2">Gráfico PnL</h3>
            <p className="text-text-secondary-light">Esta visualización avanzada estará disponible próximamente.</p>
          </div>

          {/* Sector Distribution */}
          <div className="lg:col-span-3 flex flex-col p-8 rounded-[3rem] bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-sm">
            <h3 className="text-xs font-bold mb-4 dark:text-white uppercase tracking-wider text-text-secondary-light">Distribución por Sector</h3>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sectorAllocation}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {sectorAllocation.map((entry, index) => (
                      <Cell key={`sector-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              {sectorAllocation.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-2.5 rounded-full" style={{ backgroundColor: item.color }}></div>
                    <span className="text-sm font-medium dark:text-gray-300">{item.name}</span>
                  </div>
                  <span className="text-sm font-bold dark:text-white">{formatCurrency(item.value)}</span>
                </div>
              ))}
              {sectorAllocation.length === 0 && (
                <p className="text-center text-sm text-text-secondary-light py-4 italic">Cargando sectores...</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};
