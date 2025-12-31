import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import MDEditor from '@uiw/react-md-editor';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Header } from '../components/Header';
import { TradingViewChart } from '../components/TradingViewChart';
import { PnLChart } from '../components/PnLChart';

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
  const { user, api, token } = useAuth();

  const [portfolios, setPortfolios] = useState<any[]>([]);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>('');

  const [totalValue, setTotalValue] = useState<number>(0);
  const [todaysGain, setTodaysGain] = useState<number>(0);
  const [gainPercent, setGainPercent] = useState<number>(0);
  const [totalGain, setTotalGain] = useState<number>(0);
  const [totalGainPercent, setTotalGainPercent] = useState<number>(0);
  const [sectorAllocation, setSectorAllocation] = useState<any[]>([]);
  const [topAsset, setTopAsset] = useState<string>("NASDAQ:AAPL");
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [pnlHistory, setPnlHistory] = useState<any[]>([]);
  const [pnlPeriod, setPnlPeriod] = useState<'1M' | '3M' | '1Y'>('3M'); // Default 3 months
  const [loading, setLoading] = useState(true);
  const [pnlLoading, setPnlLoading] = useState(false); // To track chart loading specifically
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
        setPnlLoading(true);

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

        // 3. Get Summary AND Details in PARALLEL (Optimized)
        if (activeId) {
          const [summaryRes, detailsRes] = await Promise.all([
            api.get(`/portfolios/summary?portfolioId=${activeId}`),
            api.get(`/portfolios/${activeId}`)
          ]);

          const summary = summaryRes.data;
          const details = detailsRes.data;

          if (summary && !summary.error) {
            setTotalValue(summary.totalValueEur || 0);
            setTodaysGain(summary.dailyChangeEur || 0);
            setGainPercent(summary.dailyChangePercent || 0);
            setTotalGain(summary.totalGainEur || 0);
            setTotalGainPercent(summary.totalGainPercent || 0);
          }

          if (details && details.positions && details.positions.length > 0) {
            const positions = details.positions;

            // Build Watchlist
            const tickers = positions.map((p: any) => p.ticker);
            setWatchlist(tickers);

            // Find Top Asset
            const sortedByValue = [...positions].sort((a: any, b: any) =>
              (b.quantity * b.average_buy_price) - (a.quantity * a.average_buy_price)
            );

            if (sortedByValue.length > 0) {
              setTopAsset(sortedByValue[0].ticker);
            }

            // Fetch sector distribution (Async but fast enough to wait? Or split?)
            // Let's keep it here for now to ensure layout doesn't jump too much, 
            // usually sector data is faster than 6 months of history calculations.
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

          // CRITICAL: Stop global loading here to show the page
          setLoading(false);

          // 4. Fetch PnL History (Slow - Async)
          try {
            setPnlLoading(true); // Ensure specific loading is set
            const { data: history } = await api.get(`/portfolios/${activeId}/pnl-history?period=3M`);
            if (Array.isArray(history)) {
              setPnlHistory(history);
            } else {
              setPnlHistory([]);
            }
          } catch (e) {
            console.error("Error fetching PnL history", e);
            setPnlHistory([]);
          } finally {
            setPnlLoading(false);
          }
        } else {
          setLoading(false);
          setPnlLoading(false);
        }
      } catch (e) {
        console.error("Error fetching dashboard data", e);
        setLoading(false);
        setPnlLoading(false);
      }
    };

    if (user) fetchData();
  }, [user, api, selectedPortfolioId]);



  // ...

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setInsight(''); // Clear previous insight
    try {
      const response = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: "Analiza mi portafolio actual y dame recomendaciones estratégicas." })
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        setInsight(prev => (prev || '') + text);
      }

    } catch (e) {
      console.error(e);
      setInsight('Error al conectar con la IA.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(val);
  };

  if (loading) {
    return (
      <main className="flex-1 flex flex-col h-screen bg-background-light dark:bg-background-dark">
        <Header title={`Hola, ${user?.name || 'Inversor'}`} />
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-text-secondary-light font-medium animate-pulse">Cargando dashboard...</p>
        </div>
      </main>
    );
  }

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
          <div className="p-6 rounded-[2rem] bg-[#1a1a14] text-white border border-primary/20 pb-8">
            <h3 className="font-bold text-primary mb-4 text-lg">Gemini Insight</h3>
            <div data-color-mode="dark">
              <MDEditor.Markdown
                source={insight}
                style={{ backgroundColor: 'transparent', color: '#d1d5db', fontSize: '0.95rem' }}
              />
            </div>
          </div>
        )}

        {/* Charts & Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* PnL Chart */}
          <div className="lg:col-span-9 flex flex-col p-8 rounded-[3rem] bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-sm h-[400px] relative overflow-hidden group">
            <div className="flex items-center justify-between mb-4 z-10 relative">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-xl">ssid_chart</span>
                </div>
                <h3 className="text-xl font-bold dark:text-white">PnL Ganancias/Perdidas</h3>
              </div>
              {/* Period Filter Buttons */}
              <div className="flex gap-1 bg-bg-light dark:bg-bg-dark rounded-lg p-1">
                {(['1M', '3M', '1Y'] as const).map((period) => (
                  <button
                    key={period}
                    onClick={async () => {
                      setPnlPeriod(period);
                      setPnlLoading(true);
                      try {
                        const { data } = await api.get(`/portfolios/${selectedPortfolioId}/pnl-history?period=${period}`);
                        setPnlHistory(Array.isArray(data) ? data : []);
                      } catch (e) {
                        console.error('Error fetching PnL:', e);
                      } finally {
                        setPnlLoading(false);
                      }
                    }}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${pnlPeriod === period
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-text-secondary-light dark:text-text-secondary-dark hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                  >
                    {period}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 w-full h-full z-10">
              {pnlLoading ? (
                <div className="w-full h-full flex flex-col items-center justify-center text-text-secondary-light">
                  <div className="size-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-sm font-medium animate-pulse">Calculando histórico...</p>
                </div>
              ) : pnlHistory.length > 0 ? (
                <PnLChart data={pnlHistory} theme={theme} />
              ) : (
                /* Placeholder content using the new PnLChart dependency logic if empty */
                <div className="w-full h-full flex flex-col items-center justify-center text-text-secondary-light">
                  <span className="material-symbols-outlined text-4xl mb-2 opacity-50">show_chart</span>
                  <p>No hay suficientes datos históricos para el gráfico PnL</p>
                  <p className="text-xs opacity-70 mt-1">Sincronizando datos...</p>
                </div>
              )}
            </div>
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
    </main >
  );
};
