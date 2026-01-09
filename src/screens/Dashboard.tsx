import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import MDEditor from '@uiw/react-md-editor';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { DashboardSkeleton } from '../components/skeletons/DashboardSkeleton';
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
  const [topGainers, setTopGainers] = useState<any[]>([]);
  const [topLosers, setTopLosers] = useState<any[]>([]);
  const [topAsset, setTopAsset] = useState<string>("NASDAQ:AAPL");
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [pnlHistory, setPnlHistory] = useState<any[]>([]);
  const [pnlPeriod, setPnlPeriod] = useState<'1M' | '3M' | '1Y'>('3M'); // Default 3 months
  const [loading, setLoading] = useState(true);
  const [pnlLoading, setPnlLoading] = useState(true);
  const [isPortfolioMenuOpen, setIsPortfolioMenuOpen] = useState(false); // To track chart loading specifically
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
            if (summary.topGainers) setTopGainers(summary.topGainers);
            if (summary.topLosers) setTopLosers(summary.topLosers);
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

            // Fetch sector distribution (Now provided by summary endpoint with correct currency conversion)
            if (summary && summary.sectorAllocation) {
              // Paleta de colores consistente para sectores comunes
              const sectorColors: Record<string, string> = {
                'Technology': '#3b82f6',
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
                'Desconocido': '#6b7280',
                // Spanish translations if backend returns them, though likely returns English
                'Tecnología': '#3b82f6',
                'Salud': '#34d399',
                'Servicios Financieros': '#fbbf24',
                'Consumo Cíclico': '#f472b6',
                'Consumo Defensivo': '#fb923c',
                'Industrial': '#a78bfa',
                'Energía': '#ef4444',
                'Materiales Básicos': '#c084fc',
                'Servicios de Comunicación': '#22d3ee',
                'Inmobiliario': '#14b8a6',
                'Utilidades': '#6366f1'
              };

              const getSectorColor = (name: string) => {
                if (sectorColors[name]) return sectorColors[name];
                let hash = 0;
                for (let i = 0; i < name.length; i++) {
                  hash = name.charCodeAt(i) + ((hash << 5) - hash);
                }
                const h = Math.abs(hash) % 360;
                return `hsl(${h}, 70%, 50%)`;
              };

              const sectorArray = summary.sectorAllocation.map((item: any) => ({
                name: item.name,
                value: item.value,
                color: getSectorColor(item.name)
              }));

              setSectorAllocation(sectorArray);
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

  // Auto-refresh every 5 minutes
  useEffect(() => {
    if (!user || !selectedPortfolioId) return;

    const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

    const refreshData = async () => {
      try {
        console.log('[Dashboard] Auto-refreshing data...');
        const [summaryRes] = await Promise.all([
          api.get(`/portfolios/summary?portfolioId=${selectedPortfolioId}`)
        ]);

        const summary = summaryRes.data;
        if (summary && !summary.error) {
          setTotalValue(summary.totalValueEur || 0);
          setTodaysGain(summary.dailyChangeEur || 0);
          setGainPercent(summary.dailyChangePercent || 0);
          setTotalGain(summary.totalGainEur || 0);
          setTotalGainPercent(summary.totalGainPercent || 0);
          if (summary.topGainers) setTopGainers(summary.topGainers);
          if (summary.topLosers) setTopLosers(summary.topLosers);
          if (summary.sectorAllocation) {
            const sectorColors: Record<string, string> = {
              'Technology': '#3b82f6', 'Healthcare': '#34d399', 'Financial Services': '#fbbf24',
              'Consumer Cyclical': '#f472b6', 'Consumer Defensive': '#fb923c', 'Industrials': '#a78bfa',
              'Energy': '#ef4444', 'Basic Materials': '#c084fc', 'Communication Services': '#22d3ee',
              'Real Estate': '#14b8a6', 'Utilities': '#6366f1', 'Desconocido': '#6b7280'
            };
            const getSectorColor = (name: string) => sectorColors[name] || `hsl(${Math.abs([...name].reduce((h, c) => c.charCodeAt(0) + ((h << 5) - h), 0)) % 360}, 70%, 50%)`;
            setSectorAllocation(summary.sectorAllocation.map((item: any) => ({
              name: item.name, value: item.value, color: getSectorColor(item.name)
            })));
          }
        }
        console.log('[Dashboard] Auto-refresh completed');
      } catch (e) {
        console.error('[Dashboard] Auto-refresh failed:', e);
      }
    };

    const intervalId = setInterval(refreshData, REFRESH_INTERVAL);
    return () => clearInterval(intervalId);
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
        body: JSON.stringify({
          message: "Analiza mi portafolio actual y dame recomendaciones estratégicas.",
          portfolioId: selectedPortfolioId
        })
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
    return <DashboardSkeleton />;
  }

  return (
    <main className="flex-1 flex flex-col h-full overflow-y-auto scroll-smooth">
      {/* Spacer for aesthetics */}
      <div className="h-8 md:h-10"></div>

      <div className="flex flex-col gap-3 px-3 pb-12 md:px-6 max-w-[1700px] mx-auto w-full">
        {/* Custom Portfolio H1 Selector */}
        <div className="relative mb-4 z-30">
          <button
            onClick={() => setIsPortfolioMenuOpen(!isPortfolioMenuOpen)}
            className="flex items-center gap-3 text-3xl font-bold text-text-primary-light dark:text-white hover:opacity-80 transition-all group outline-none"
          >
            <div className="p-2.5 rounded-xl bg-surface-light dark:bg-white/5 border border-border-light dark:border-white/10 group-hover:bg-primary/10 group-hover:border-primary/30 transition-all shadow-sm">
              <span className="material-symbols-outlined text-2xl text-primary">business_center</span>
            </div>
            <span className="tracking-tight">{portfolios.find(p => p.id === selectedPortfolioId)?.name || 'Seleccionar'}</span>
            <span className={`material-symbols-outlined text-3xl text-text-secondary-light dark:text-white/50 transition-transform duration-300 ${isPortfolioMenuOpen ? 'rotate-180' : ''}`}>
              keyboard_arrow_down
            </span>
          </button>

          {/* Dropdown Menu */}
          {isPortfolioMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-10 cursor-default"
                onClick={() => setIsPortfolioMenuOpen(false)}
              />
              <div className="absolute top-full left-0 mt-3 w-80 bg-white dark:bg-[#1E1E2D]/95 backdrop-blur-xl border border-border-light dark:border-white/10 rounded-2xl shadow-2xl z-20 overflow-hidden flex flex-col py-2 animate-in fade-in zoom-in-95 duration-200">
                <div className="px-4 py-2 text-[10px] font-bold text-text-secondary-light dark:text-white/40 uppercase tracking-widest mb-1">
                  Mis Portafolios
                </div>
                <div className="flex flex-col max-h-[300px] overflow-y-auto custom-scrollbar">
                  {portfolios.map(p => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSelectedPortfolioId(p.id);
                        setIsPortfolioMenuOpen(false);
                      }}
                      className={`w-full text-left px-5 py-3 flex items-center justify-between transition-all border-l-[3px] ${selectedPortfolioId === p.id
                        ? 'bg-primary/5 dark:bg-primary/10 text-primary border-primary'
                        : 'text-text-primary-light dark:text-white/80 hover:bg-bg-light dark:hover:bg-white/5 hover:text-primary border-transparent'
                        }`}
                    >
                      <span className="font-bold text-sm">{p.name}</span>
                      {p.is_favorite && <span className="text-yellow-500 text-xs material-symbols-outlined filled">star</span>}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* MAIN TWO-COLUMN LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

          {/* MAIN COLUMN (75%) */}
          <div className="lg:col-span-9 flex flex-col gap-3">

            {/* Row 1: 3 Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Net Worth */}
              <div className="flex flex-col gap-0.5 p-4 rounded-[1.5rem] bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-sm hover:shadow-xl hover:border-primary/50 transition-all group min-h-[120px]">
                <div className="flex items-center gap-2 mb-1">
                  <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined font-bold text-base">wallet</span>
                  </div>
                  <h3 className="text-sm font-bold dark:text-white">{t('dashboard.net_worth')}</h3>
                </div>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold tracking-tight text-text-primary-light dark:text-text-primary-dark">{formatCurrency(totalValue)}</p>
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${gainPercent >= 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                    {gainPercent >= 0 ? '↑' : '↓'} {Math.abs(gainPercent).toFixed(2)}%
                  </span>
                </div>
              </div>

              {/* Daily Gain */}
              <div className={`flex flex-col gap-0.5 p-4 rounded-[1.5rem] bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-sm hover:shadow-xl transition-all group min-h-[120px] ${todaysGain >= 0 ? 'hover:border-green-500/30' : 'hover:border-red-500/30'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <div className={`size-8 rounded-lg flex items-center justify-center ${todaysGain >= 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                    <span className="material-symbols-outlined font-bold text-base">{todaysGain >= 0 ? 'trending_up' : 'trending_down'}</span>
                  </div>
                  <h3 className="text-sm font-bold dark:text-white">{t('dashboard.todays_gain')}</h3>
                </div>
                <div className="flex items-baseline gap-2">
                  <p className={`text-2xl font-bold tracking-tight ${todaysGain >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {todaysGain >= 0 ? '+' : ''}{formatCurrency(todaysGain)}
                  </p>
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${todaysGain >= 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                    {todaysGain >= 0 ? '↑' : '↓'} {Math.abs(gainPercent).toFixed(2)}%
                  </span>
                </div>
              </div>

              {/* Total Gain */}
              <div className={`flex flex-col gap-0.5 p-4 rounded-[1.5rem] bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-sm hover:shadow-xl transition-all group min-h-[120px] ${totalGain >= 0 ? 'hover:border-green-500/30' : 'hover:border-red-500/30'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <div className={`size-8 rounded-lg flex items-center justify-center ${totalGain >= 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                    <span className="material-symbols-outlined font-bold text-base">show_chart</span>
                  </div>
                  <h3 className="text-sm font-bold dark:text-white">Ganancia Total</h3>
                </div>
                <div className="flex items-baseline gap-2">
                  <p className={`text-2xl font-bold tracking-tight ${totalGain >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {totalGain >= 0 ? '+' : ''}{formatCurrency(totalGain)}
                  </p>
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${totalGain >= 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                    {totalGain >= 0 ? '↑' : '↓'} {Math.abs(totalGainPercent).toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>

            {/* AI Insight Result - Solo visible en DESKTOP aquí */}
            {insight && (
              <div className="hidden md:block p-6 rounded-[2rem] bg-[#1a1a14] text-white border border-primary/20 pb-8">
                <h3 className="font-bold text-primary mb-4 text-lg">Análisis de IA</h3>
                <div data-color-mode="dark">
                  <MDEditor.Markdown
                    source={insight}
                    style={{ backgroundColor: 'transparent', color: '#d1d5db', fontSize: '0.95rem' }}
                  />
                </div>
              </div>
            )}

            {/* Row 2: Top Movers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Top Gainers */}
              <div className="flex flex-col p-4 rounded-[1.5rem] bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="size-8 rounded-lg bg-green-500/10 flex items-center justify-center text-green-500">
                      <span className="material-symbols-outlined font-bold text-base">rocket_launch</span>
                    </div>
                    <h3 className="text-sm font-bold dark:text-white">Mejores del Día</h3>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  {topGainers.length > 0 ? topGainers.map((asset, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-background-light/50 dark:bg-white/5 border border-border-light dark:border-border-dark hover:bg-background-light dark:hover:bg-white/10 transition-colors">
                      <div className="flex flex-col">
                        <span className="font-bold text-xs dark:text-white">{asset.ticker}</span>
                        <span className="text-[9px] text-text-secondary-light font-medium">{formatCurrency(asset.price)}</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="font-bold text-xs text-green-500 leading-tight">
                          {asset.change > 0 ? '+' : ''}{asset.change.toLocaleString('es-ES', { style: 'currency', currency: asset.currency || 'USD' })}
                        </span>
                        <span className="text-[9px] font-black text-green-500/70">
                          +{asset.changePercent.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  )) : (
                    <p className="text-xs text-text-secondary-light italic">Sin ganancias hoy</p>
                  )}
                </div>
              </div>

              {/* Top Losers */}
              <div className="flex flex-col p-4 rounded-[1.5rem] bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="size-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500">
                      <span className="material-symbols-outlined font-bold text-base">trending_down</span>
                    </div>
                    <h3 className="text-sm font-bold dark:text-white">Peores del Día</h3>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  {topLosers.length > 0 ? topLosers.map((asset, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-background-light/50 dark:bg-white/5 border border-border-light dark:border-border-dark hover:bg-background-light dark:hover:bg-white/10 transition-colors">
                      <div className="flex flex-col">
                        <span className="font-bold text-xs dark:text-white">{asset.ticker}</span>
                        <span className="text-[9px] text-text-secondary-light font-medium">{formatCurrency(asset.price)}</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="font-bold text-xs text-red-500 leading-tight">
                          {asset.change.toLocaleString('es-ES', { style: 'currency', currency: asset.currency || 'USD' })}
                        </span>
                        <span className="text-[9px] font-black text-red-500/70">
                          {asset.changePercent.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  )) : (
                    <p className="text-xs text-text-secondary-light italic">Sin pérdidas hoy</p>
                  )}
                </div>
              </div>
            </div>

            {/* Row 3: PnL Chart (Full Width of Main Column) */}
            <div className="flex flex-col p-4 rounded-[1.5rem] bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-sm h-[360px] relative overflow-hidden group">
              <div className="flex items-center justify-between mb-1 z-10 relative">
                <div className="flex items-center gap-2">
                  <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-base">ssid_chart</span>
                  </div>
                  <h3 className="text-sm font-bold dark:text-white">PnL Ganancias/Perdidas</h3>
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
                  <div className="w-full h-full flex flex-col items-center justify-center text-text-secondary-light">
                    <span className="material-symbols-outlined text-4xl mb-2 opacity-50">show_chart</span>
                    <p>No hay suficientes datos históricos para el gráfico PnL</p>
                    <p className="text-xs opacity-70 mt-1">Sincronizando datos...</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SIDEBAR COLUMN (25%) */}
          <div className="lg:col-span-3 flex flex-col gap-3">

            {/* AI Analysis Button + Mobile Insight */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col justify-between p-4 rounded-[1.5rem] bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-sm hover:shadow-xl hover:border-accent-blue/30 transition-all group min-h-[120px]">
                <div className="flex items-center gap-2 mb-1">
                  <div className="size-8 rounded-lg bg-accent-blue/10 flex items-center justify-center text-accent-blue">
                    <span className="material-symbols-outlined font-bold text-base">insights</span>
                  </div>
                  <h3 className="text-sm font-bold dark:text-white">{t('dashboard.ai_analysis')}</h3>
                </div>
                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                  className="mt-auto w-full py-2.5 rounded-lg bg-accent-blue/10 text-accent-blue text-xs font-bold hover:bg-accent-blue hover:text-white transition-all"
                >
                  {isAnalyzing ? "Analizando..." : "Generar Análisis de IA"}
                </button>
              </div>

              {/* AI Insight Result - Solo visible en MÓVIL aquí (debajo del botón) */}
              {insight && (
                <div className="md:hidden p-4 rounded-[1.5rem] bg-[#1a1a14] text-white border border-primary/20">
                  <h3 className="font-bold text-primary mb-3 text-sm">Análisis de IA</h3>
                  <div data-color-mode="dark" className="text-sm">
                    <MDEditor.Markdown
                      source={insight}
                      style={{ backgroundColor: 'transparent', color: '#d1d5db', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Sector Distribution */}
            <div className="flex flex-col p-4 rounded-[1.5rem] bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-sm flex-1">
              <h3 className="text-xs font-bold mb-4 dark:text-white uppercase tracking-wider text-text-secondary-light">Distribución por Sector</h3>
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sectorAllocation}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
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
                      <span className="text-xs font-medium dark:text-gray-300 truncate max-w-[100px]">{item.name}</span>
                    </div>
                    <span className="text-xs font-bold dark:text-white">{formatCurrency(item.value)}</span>
                  </div>
                ))}
                {sectorAllocation.length === 0 && (
                  <p className="text-center text-sm text-text-secondary-light py-4 italic">Cargando sectores...</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main >
  );
};
