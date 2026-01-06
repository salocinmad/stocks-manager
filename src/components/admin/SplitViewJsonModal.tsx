import React, { useEffect, useRef, useState } from 'react';
import { X, Info, TrendingUp, TrendingDown, Activity, Globe, DollarSign, Shield, BarChart3, HelpCircle, Loader2 } from 'lucide-react';
import { createChart, ColorType } from 'lightweight-charts';
import { useAuth } from '../../context/AuthContext';

interface SplitViewJsonModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: any;
    title: string;
}

// Tooltip Component
const Tooltip: React.FC<{ text: string }> = ({ text }) => {
    const [isVisible, setIsVisible] = useState(false);

    return (
        <div
            className="relative inline-block ml-1"
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
        >
            <HelpCircle className="w-3 h-3 text-text-secondary-light dark:text-text-secondary-dark cursor-help" />

            {isVisible && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-xl w-48 z-50 animate-fade-in pointer-events-none">
                    {text}
                    {/* Arrow */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                </div>
            )}
        </div>
    );
};

// Data Card Component
const InfoCard: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
    <div className="bg-background-light dark:bg-surface-dark p-4 rounded-xl border border-border-light dark:border-border-dark flex flex-col h-full">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border-light/50 dark:border-border-dark/50">
            {icon}
            <h4 className="text-sm font-bold uppercase text-text-secondary-light dark:text-text-secondary-dark">{title}</h4>
        </div>
        <div className="flex-1 space-y-3">
            {children}
        </div>
    </div>
);

// Key-Value Row Component
const DataRow: React.FC<{ label: string; value: React.ReactNode; tooltip?: string; highlight?: boolean }> = ({ label, value, tooltip, highlight }) => (
    <div className="flex justify-between items-start text-sm">
        <div className="flex items-center">
            <span className="text-text-secondary-light dark:text-text-secondary-dark">{label}</span>
            {tooltip && <Tooltip text={tooltip} />}
        </div>
        <span className={`font-mono font-medium text-right ${highlight ? 'text-primary' : 'text-text-primary'}`}>
            {value !== undefined && value !== null ? value : 'N/A'}
        </span>
    </div>
);

export const SplitViewJsonModal: React.FC<SplitViewJsonModalProps> = ({ isOpen, onClose, data: initialData, title }) => {
    const { api } = useAuth(); // Use authenticated API client
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const [data, setData] = useState<any>(initialData);
    const [loading, setLoading] = useState(false);

    // Update local state when prop changes
    useEffect(() => {
        setData(initialData);
    }, [initialData]);

    // Auto-fetch if candles are missing
    useEffect(() => {
        if (!isOpen || !data?.t) return;

        // If we don't have candles, we should try to fetch fresh enriched data
        if (!data.candles || data.candles.length === 0) {
            const fetchFreshData = async () => {
                try {
                    setLoading(true);
                    // Use api client which includes base URL and token if needed
                    const response = await api.get(`/market/enrich?ticker=${data.t}`);
                    const freshData = response.data;

                    if (freshData) {
                        // Merge fresh data
                        setData((prev: any) => ({ ...prev, ...freshData }));
                    }
                } catch (e) {
                    console.error("Failed to fetch fresh candle data", e);
                } finally {
                    setLoading(false);
                }
            };
            fetchFreshData();
        }
    }, [isOpen, data?.t, api]);

    const formatCurrency = (val: number) => val?.toLocaleString('en-US', { style: 'currency', currency: data.currency || 'USD' });
    const formatNumber = (val: number, decimals = 2) => val?.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

    // Extract Logic (With Defaults)
    const tech = data.technical || {};
    const risk = data.risk || {};
    const fund = data.fund || {};
    const analysts = data.analysts || {};
    const rawHist = data.priceHistory || [];
    const candles = data.candles || [];

    // Chart Effect
    useEffect(() => {
        if (!isOpen || !chartContainerRef.current) return;

        // If loading, wait or show partial? Show partial if available.
        if (rawHist.length === 0 && candles.length === 0) return;

        const isDark = document.documentElement.classList.contains('dark');

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: 'transparent' },
                textColor: isDark ? '#9ca3af' : '#4b5563',
            },
            grid: {
                vertLines: { color: isDark ? '#374151' : '#e5e7eb' },
                horzLines: { color: isDark ? '#374151' : '#e5e7eb' },
            },
            width: chartContainerRef.current.clientWidth,
            height: 250,
            timeScale: {
                borderColor: isDark ? '#374151' : '#e5e7eb',
                timeVisible: true,
            },
            rightPriceScale: {
                borderColor: isDark ? '#374151' : '#e5e7eb',
            },
        });

        // Determine if we have Candle data or just Line data
        let series: any;

        if (candles.length > 0) {
            // Use Candlestick Series
            series = chart.addCandlestickSeries({
                upColor: '#10b981',
                downColor: '#ef4444',
                borderVisible: false,
                wickUpColor: '#10b981',
                wickDownColor: '#ef4444',
            });
            const sortedCandles = [...candles].sort((a: any, b: any) => new Date(a.time).getTime() - new Date(b.time).getTime());
            // Filter invalid candles to prevent crash
            const validCandles = sortedCandles.filter((c: any) =>
                c.open != null && c.high != null && c.low != null && c.close != null && !isNaN(c.close)
            );

            if (validCandles.length > 0) {
                series.setData(validCandles);
            }
        } else {
            // Fallback to Area
            series = chart.addAreaSeries({
                lineColor: '#3b82f6',
                topColor: 'rgba(59, 130, 246, 0.4)',
                bottomColor: 'rgba(59, 130, 246, 0.0)',
                lineWidth: 2,
            });

            const chartData = rawHist.map((price: number, index: number) => {
                const date = new Date();
                date.setDate(date.getDate() - (rawHist.length - 1 - index));
                const timeString = date.toISOString().split('T')[0];
                return { time: timeString, value: price };
            });
            series.setData(chartData);
        }

        chart.timeScale().fitContent();

        const handleResize = () => {
            if (chartContainerRef.current) {
                chart.applyOptions({ width: chartContainerRef.current.clientWidth });
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, [isOpen, rawHist, candles, data.currency, loading]);


    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 overflow-y-auto">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md animate-fade-in" onClick={onClose} />

            {/* Modal Container */}
            <div className="relative bg-surface-light dark:bg-surface-dark-elevated w-full max-w-5xl rounded-3xl shadow-2xl flex flex-col animate-scale-in border border-border-light dark:border-border-dark max-h-[95vh]">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border-light dark:border-border-dark">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center shrink-0">
                            <Activity className="text-primary w-7 h-7" />
                        </div>
                        <div>
                            <h3 className="text-xl md:text-2xl font-bold text-text-primary-light dark:text-white leading-tight">
                                {data.n || title}
                            </h3>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs bg-background-light dark:bg-black/30 px-2 py-0.5 rounded font-mono border border-border-light dark:border-border-dark">
                                    {data.t}
                                </span>
                                <span className="text-xs text-text-secondary-light">{data.s || 'Sector Desconocido'}</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-all"><X /></button>
                </div>

                {/* Dashboard Grid */}
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 overflow-y-auto custom-scrollbar">

                    {/* 1. General Info */}
                    <InfoCard title="General" icon={<Globe className="w-4 h-4 text-blue-500" />}>
                        <DataRow label="Precio" value={formatCurrency(data.p)} highlight tooltip="Precio actual de mercado por acción." />
                        <DataRow label="Cambio 1D" value={
                            <span className={data.chg_1d >= 0 ? "text-green-500" : "text-red-500"}>
                                {data.chg_1d > 0 ? '+' : ''}{formatNumber(data.chg_1d)}%
                            </span>
                        } tooltip="Variación porcentual del precio en la última sesión." />
                        <DataRow label="Mkt Cap" value={fund.mcap} tooltip="Capitalización de Mercado: Valor total de la empresa en bolsa." />
                        <DataRow label="ISIN" value={data.isin} tooltip="Código internacional único de identificación de valores." />
                        <DataRow label="Fuente" value={data.source} tooltip="Proveedor de datos de mercado (ej. Yahoo Finance)." />
                    </InfoCard>

                    {/* 2. Risk Profile */}
                    <InfoCard title="Riesgo" icon={<Shield className="w-4 h-4 text-red-500" />}>
                        <DataRow label="Beta" value={risk.beta} tooltip="Volatilidad relativa al mercado. Beta > 1 indica mayor riesgo." />
                        <DataRow label="Altman Z" value={formatNumber(risk.altmanZScore)} tooltip="Probabilidad de quiebra. Z < 1.8 indica zona de peligro." />
                        <DataRow label="Zona" value={
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${risk.zone === 'Safe' ? 'bg-green-500/20 text-green-500' :
                                risk.zone === 'Distress' ? 'bg-red-500/20 text-red-500' : 'bg-yellow-500/20 text-yellow-500'
                                }`}>
                                {risk.zone || 'N/A'}
                            </span>
                        } tooltip="Clasificación de riesgo según el Z-Score (Segura, Gris, Peligro)." />
                        <DataRow label="Est. Valor" value={data.valuation?.state} tooltip="Estimación de valoración (Infravalorada/Sobrevalorada)." />
                    </InfoCard>

                    {/* 3. Market / Analysts (Información Extra) */}
                    <InfoCard title="Información Extra" icon={<DollarSign className="w-4 h-4 text-green-500" />}>
                        {/* Added missing fields from request */}
                        <DataRow label="Recomendación" value={analysts.recommendation} highlight tooltip="Consenso de compra/venta de los analistas." />
                        <DataRow label="Precio Obj." value={formatCurrency(analysts.targetMean)} tooltip="Precio objetivo promedio a 12 meses." />
                        <DataRow label="Analistas" value={analysts.numberOfAnalysts} tooltip="Número de analistas cubriendo la acción." />
                        <DataRow label="P/E Ratio" value={formatNumber(data.valuation?.peRatio)} tooltip="Precio/Beneficio. Cuánto se paga por cada dolar de ganancia." />
                    </InfoCard>

                    {/* 4. Technicals (Información Técnica) */}
                    <InfoCard title="Información Técnica" icon={<BarChart3 className="w-4 h-4 text-purple-500" />}>
                        {/* Added missing RSI7, Trend, SMA50 */}
                        <DataRow label="RSI (7d)" value={formatNumber(tech.rsi7)} tooltip="Fuerza Relativa (7 días). >70 Sobrecompra, <30 Sobreventa." />
                        <DataRow label="RSI (14d)" value={formatNumber(tech.rsi14)} tooltip="Fuerza Relativa (14 días). Estándar de la industria." />
                        <DataRow label="SMA 50" value={formatCurrency(tech.sma50)} tooltip="Media Móvil Simple de 50 días. Referencia de tendencia." />
                        <DataRow label="Tendencia" value={
                            <span className={tech.trend === 'Bullish' ? 'text-green-500' : tech.trend === 'Bearish' ? 'text-red-500' : ''}>
                                {tech.trend || 'N/A'}
                            </span>
                        } tooltip="Tendencia técnica general automatizada." />
                        <DataRow label="Sharpe" value={formatNumber(tech.sharpe)} tooltip="Rendimiento ajustado al riesgo. Mayor es mejor." />
                        <DataRow label="Volatilidad" value={formatNumber(tech.volatility)} tooltip="Desviación estándar de los rendimientos." />
                    </InfoCard>

                </div>

                {/* Chart Section */}
                <div className="px-6 pb-6 pt-2 flex flex-col shrink-0">
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-text-secondary-light" />
                        <h4 className="text-xs font-bold uppercase text-text-secondary-light flex items-center gap-2">
                            {loading ? (
                                <>
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    <span>Obteniendo Velas...</span>
                                </>
                            ) : (
                                <span>{candles.length > 0 ? 'Gráfico de Velas (30 Días)' : 'Historial de Precios (30 Días)'}</span>
                            )}
                        </h4>
                    </div>
                    {/* Lightweight Chart Container */}
                    <div className="w-full h-64 bg-background-light dark:bg-black/20 rounded-xl border border-border-light dark:border-border-dark overflow-hidden relative">
                        <div ref={chartContainerRef} className="w-full h-full" />
                        {rawHist.length === 0 && candles.length === 0 && !loading && (
                            <div className="absolute inset-0 flex items-center justify-center text-text-secondary-light">Sin datos históricos</div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};
