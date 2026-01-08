import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, TrendingUp, Activity, AlertTriangle, DollarSign, PieChart, BarChart2, Info, Lock, Calendar, Download, ExternalLink, Loader2, Signal, RefreshCw, Calculator } from 'lucide-react';

// Interfaces match Backend v2.2.0
interface FundamentalData {
    marketCap: number;
    enterpriseValue: number;
    trailingPE: number;
    forwardPE: number;
    pegRatio: number;
    priceToSales: number;
    priceToBook: number;

    profitMargins: number;
    operatingMargins: number;
    grossMargins: number;       // NEW
    ebitdaMargins: number;      // NEW
    returnOnEquity: number;
    returnOnAssets: number;

    revenueGrowth: number;      // NEW
    earningsGrowth: number;     // NEW

    totalRevenue: number;
    ebitda: number;
    totalCash: number;
    totalDebt: number;
    debtToEquity: number;
    currentRatio: number;
    quickRatio: number;         // NEW
    freeCashflow: number;       // NEW
    operatingCashflow: number;  // NEW

    trailingEps: number;
    forwardEps: number;
    bookValue: number;
    revenuePerShare: number;    // NEW
    totalCashPerShare: number;  // NEW

    dividendRate: number;
    dividendYield: number;
    payoutRatio: number;
    exDividendDate: string;

    heldPercentInstitutions: number; // NEW
    heldPercentInsiders: number;     // NEW
    shortRatio: number;              // NEW
}

interface CompanyEvent {
    id: string;
    date: string;               // ISO Date String
    type: 'EARNINGS_RELEASE' | 'EARNINGS_CALL' | 'DIVIDEND' | 'SPLIT' | 'OTHER';
    title: string;
    description: string;
    isConfirmed: boolean;
}

interface PositionAnalysis {
    positionId: string;
    ticker: string;
    quantity: number;
    averagePrice: number;
    currentPrice: number;
    currency: string;
    totalValue: number;
    costBasis: number;
    pnl: number;
    pnlPercent: number;
    weight: number;

    technical: {
        rsi: number | null;
        sma50: number | null;
        sma200: number | null;
        trend: string;
    };

    risk: {
        volatility: number;
        sharpe: number;
        sortino: number;
        maxDrawdown: number;
        beta: number;
        var95: number;
        score: number;
        solvency: {
            zScore: number;
            zone: 'SAFE' | 'GREY' | 'DISTRESS';
            label: string;
        } | null;
    };

    analysts: {
        consensus: string | null;
        targetPrice: number | null;
        currentPrice: number;
        targetUpside: string | null;
        numberOfAnalysts: number | null;
        breakdown: {
            strongBuy: number;
            buy: number;
            hold: number;
            sell: number;
            strongSell: number;
        } | null;
        insiderSentiment: {
            mspr: number;
            label: string;
        } | null;
    };

    fundamentals?: FundamentalData; // Updated Interface
    sector: string;                 // NEW
    industry: string;               // NEW
    calendarEvents?: CompanyEvent[]; // NEW
    calculatedAt: string;
}

interface PositionAnalysisModalProps {
    isOpen: boolean;
    onClose: () => void;
    positionId: string;
    ticker: string;
    companyName?: string;
}

interface SimulationResult {
    newAveragePrice: number;
    newQuantity: number;
    newTotalValue: number;
    newWeight: number;
    projectedPnL: number;
    projectedPnLPercent: number;
}

export const PositionAnalysisModal: React.FC<PositionAnalysisModalProps> = ({ isOpen, onClose, positionId, ticker, companyName }) => {
    const { api, appVersion } = useAuth();
    const [analysis, setAnalysis] = useState<PositionAnalysis | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'fundamental' | 'technical' | 'analysts' | 'calendar' | 'risk' | 'simulation'>('overview');

    // Simulation State
    const [buyQty, setBuyQty] = useState(10);
    const [sellQty, setSellQty] = useState(1);
    const [priceChange, setPriceChange] = useState(10);
    const [simulation, setSimulation] = useState<SimulationResult | null>(null);
    const [simType, setSimType] = useState<'buy' | 'sell' | 'price'>('buy');

    const fetchAnalysis = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data } = await api.get(`/analysis/position/${positionId}`);
            if (data.error) throw new Error(data.error);
            setAnalysis(data);
        } catch (e: any) {
            setError(e.response?.data?.error || e.message || 'Error loading analysis');
        } finally {
            setLoading(false);
        }
    }, [positionId, api]);

    useEffect(() => {
        if (isOpen && positionId) {
            fetchAnalysis();
            setSimulation(null); // Reset simulation on open
        }
    }, [isOpen, positionId, fetchAnalysis]);

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    const handleRefresh = async () => {
        setLoading(true);
        try {
            await api.post(`/analysis/refresh/${positionId}`);
            await fetchAnalysis();
        } catch (e) {
            console.error('Refresh error:', e);
        }
    };

    const runSimulation = async () => {
        if (!analysis) return;
        try {
            let endpoint = '';
            let body: any = { positionId };

            if (simType === 'buy') {
                endpoint = '/analysis/simulate/buy';
                body.additionalQty = buyQty;
                body.buyPrice = analysis.currentPrice;
            } else if (simType === 'sell') {
                endpoint = '/analysis/simulate/sell';
                body.sellQty = sellQty;
                body.currentPrice = analysis.currentPrice;
            } else {
                endpoint = '/analysis/simulate/price-change';
                body.percentChange = priceChange;
                body.currentPrice = analysis.currentPrice;
            }
            const { data: result } = await api.post(endpoint, body);
            setSimulation(result);
        } catch (e) {
            console.error('Simulation error:', e);
        }
    };

    if (!isOpen) return null;

    // --- TOOLTIPS ---
    const tooltips: Record<string, string> = {
        // Valuation & Price
        'Precio Actual': 'Último precio de cotización de la acción.',
        'Riesgo Precio': 'Score de riesgo calculado basado en volatilidad, beta y drawdown. 1-3 bajo, 4-6 medio, 7-10 alto.',
        'Sector': 'Sector industrial al que pertenece la empresa.',
        'Market Cap': 'Capitalización bursátil: precio × acciones en circulación. Indica el tamaño de la empresa.',
        'Price / Sales': 'Precio sobre ventas. Útil para empresas sin beneficios. Menor = más barato.',
        'Price / Book': 'Precio sobre valor contable. <1 puede indicar infravaloración.',
        'PER Forward': 'Precio/Beneficio estimado para el próximo año. Menor = más barato vs ganancias futuras.',
        'PER (Trailing)': 'Precio/Beneficio últimos 12 meses. Menor = más barato vs ganancias pasadas.',
        'PEG Ratio': 'PER dividido por crecimiento de beneficios. <1 puede indicar infravaloración.',
        'Graham Number': 'Precio máximo a pagar según Benjamin Graham: √(22.5 × EPS × Book Value).',
        'P/FCF': 'Precio sobre flujo de caja libre. Menor = más barato vs efectivo generado.',
        'EV / EBITDA': 'Enterprise Value sobre EBITDA. Menor = más barato. <10 suele ser atractivo.',

        // Analysts & Sentiment
        'Consenso': 'Recomendación consensuada de los analistas (buy, hold, sell).',
        'Analyst Target': 'Precio objetivo promedio estimado por analistas.',
        'Target': 'Precio objetivo promedio estimado por analistas.',
        'Nº Analistas': 'Número de analistas que cubren esta acción.',
        '% Inst.': 'Porcentaje de acciones en manos de instituciones.',
        '% Insiders': 'Porcentaje de acciones en manos de directivos.',
        'Short Ratio': 'Días necesarios para cubrir posiciones cortas con el volumen medio.',

        // Profitability & Margins
        'Margen Bruto': 'Porcentaje de ingresos tras descontar el coste de ventas.',
        'Margen EBITDA': 'Porcentaje de ingresos antes de intereses, impuestos y depreciación.',
        'Margen Neto': 'Porcentaje final de ingresos que queda como beneficio.',
        'ROE': 'Retorno sobre Patrimonio. Eficiencia invirtiendo el capital de los accionistas.',

        // Growth & Cash Flow
        'Crecim. Ventas (YoY)': 'Crecimiento de ingresos respecto al año anterior.',
        'Crecim. Beneficios': 'Crecimiento de beneficios trimestrales.',
        'Free Cash Flow': 'Efectivo generado tras inversiones de capital. Clave para dividendos/recompras.',
        'Op. Cash Flow': 'Efectivo generado por las operaciones principales.',

        // Financial Health
        'Deuda Neta': 'Deuda Total menos Caja Total. Negativo es bueno (más caja que deuda).',
        'Caja Total': 'Efectivo e inversiones a corto plazo disponibles.',
        'Deuda / Equity': 'Ratio de endeudamiento sobre patrimonio. >100 requiere atención.',
        'Quick Ratio': 'Capacidad para pagar pasivos a corto plazo con activos muy líquidos.',

        // Dividends
        'Yield': 'Rentabilidad anual por dividendo.',
        'Payout Ratio': 'Porcentaje de beneficios destinados a dividendos.',
        'Rate': 'Pago anual estimado por acción.',
        'Ex-Date': 'Fecha límite para tener la acción y cobrar el dividendo.',

        // Technical
        'RSI (14d)': 'Índice de Fuerza Relativa. >70 sobrecompra, <30 sobreventa.',
        'Tendencia': 'Dirección general del precio basada en medias móviles.',
    };

    const getTooltip = (label: string): string | undefined => tooltips[label];

    // --- METRIC CARD ---
    const MetricCard = ({ label, value, subtext, color, tooltip }: any) => (
        <div
            className="bg-gray-100 dark:bg-gray-800/50 p-3 rounded-2xl border border-gray-200 dark:border-gray-700 hover:border-primary/30 transition-colors group relative"
            title={tooltip || getTooltip(label)}
        >
            <div className="text-gray-500 dark:text-gray-400 text-xs mb-1 uppercase font-bold tracking-wider flex items-center gap-1">
                {label}
                {(tooltip || getTooltip(label)) && <Info size={10} className="opacity-40 group-hover:opacity-100 transition-opacity" />}
            </div>
            <div className={`text-lg font-black ${color || 'text-gray-900 dark:text-white'}`}>{value}</div>
            {subtext && <div className="text-[10px] text-gray-500 font-bold uppercase mt-0.5">{subtext}</div>}
        </div>
    );

    // Format Helpers
    const formatCurrency = (val: number | undefined | null) => {
        if (val === undefined || val === null) return 'N/A';
        return new Intl.NumberFormat('es-ES', { style: 'currency', currency: analysis?.currency || 'EUR', maximumFractionDigits: 2 }).format(val);
    };

    const formatNumber = (val: number | undefined | null, decimals = 2) => {
        if (val === undefined || val === null) return 'N/A';
        return new Intl.NumberFormat('es-ES', { maximumFractionDigits: decimals }).format(val);
    };

    const formatLargeNumber = (val: number | undefined | null) => {
        if (val === undefined || val === null) return 'N/A';
        if (Math.abs(val) >= 1.0e+12) return (val / 1.0e+12).toFixed(2) + "T";
        if (Math.abs(val) >= 1.0e+9) return (val / 1.0e+9).toFixed(2) + "B";
        if (Math.abs(val) >= 1.0e+6) return (val / 1.0e+6).toFixed(2) + "M";
        return val.toFixed(2);
    };

    const formatPercent = (val: number | undefined | null) => {
        if (val === undefined || val === null) return 'N/A';
        return (val * 100).toFixed(2) + '%';
    };

    const getCalculatedMetrics = (f: FundamentalData, currentPrice: number) => {
        let grahamNumber = null;
        if (f.trailingEps > 0 && f.bookValue > 0) {
            grahamNumber = Math.sqrt(22.5 * f.trailingEps * f.bookValue);
        }
        let pFcf = null;
        if (f.marketCap && f.freeCashflow && f.freeCashflow > 0) {
            pFcf = f.marketCap / f.freeCashflow;
        }
        let netDebt = null;
        if (f.totalDebt !== undefined && f.totalCash !== undefined) {
            netDebt = f.totalDebt - f.totalCash;
        }
        return { grahamNumber, pFcf, netDebt };
    };

    // Calendar Helpers
    const downloadIcs = (e: CompanyEvent) => {
        const startDate = new Date(e.date).toISOString().replace(/-|:|\.\d\d\d/g, "");
        const endDate = new Date(new Date(e.date).getTime() + 3600000).toISOString().replace(/-|:|\.\d\d\d/g, "");
        const icsContent = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "BEGIN:VEVENT",
            `DTSTART:${startDate}`,
            `DTEND:${endDate}`,
            `SUMMARY:${ticker} - ${e.title}`,
            `DESCRIPTION:${e.description}`,
            "END:VEVENT",
            "END:VCALENDAR"
        ].join("\n");

        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${ticker}_${e.type}.ics`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const googleCalendarUrl = (e: CompanyEvent) => {
        const startDate = new Date(e.date).toISOString().replace(/-|:|\.\d\d\d/g, "");
        const endDate = new Date(new Date(e.date).getTime() + 3600000).toISOString().replace(/-|:|\.\d\d\d/g, "");
        const details = encodeURIComponent(e.description);
        const text = encodeURIComponent(`${ticker} - ${e.title}`);
        return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${startDate}/${endDate}&details=${details}`;
    };

    const renderContent = () => {
        if (loading) return <div className="flex flex-col justify-center items-center h-96 gap-4"><Loader2 className="w-10 h-10 text-primary animate-spin" /><p className="text-gray-500 animate-pulse font-bold tracking-widest uppercase text-xs">Analizando Posición...</p></div>;
        if (error) return <div className="text-center py-20 px-6"><div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4"><AlertTriangle className="text-red-500 w-8 h-8" /></div><p className="text-red-500 font-bold mb-6">{error}</p><button onClick={fetchAnalysis} className="px-6 py-2 bg-primary text-black rounded-xl font-bold hover:bg-primary/80 transition-all uppercase tracking-widest text-xs">Reintentar</button></div>;
        if (!analysis) return null;

        const { fundamentals: f } = analysis;
        const calc = f ? getCalculatedMetrics(f, analysis.currentPrice) : null;

        switch (activeTab) {
            case 'simulation': // Replaces 'whatif'
                return (
                    <div className="space-y-6 animate-fadeIn max-w-3xl mx-auto">
                        <div className="bg-gray-100 dark:bg-gray-800 p-6 rounded-[2rem] border border-gray-200 dark:border-gray-700 shadow-sm">
                            <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-6 flex items-center gap-2">
                                <Calculator size={14} /> Simulación de Escenarios
                            </h3>

                            <div className="flex gap-4 mb-6">
                                <button onClick={() => setSimType('buy')} className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${simType === 'buy' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30' : 'bg-white dark:bg-gray-700 text-gray-500 hover:text-gray-700'}`}>
                                    Comprar
                                </button>
                                <button onClick={() => setSimType('sell')} className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${simType === 'sell' ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' : 'bg-white dark:bg-gray-700 text-gray-500 hover:text-gray-700'}`}>
                                    Vender
                                </button>
                                <button onClick={() => setSimType('price')} className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${simType === 'price' ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/30' : 'bg-white dark:bg-gray-700 text-gray-500 hover:text-gray-700'}`}>
                                    Precio
                                </button>
                            </div>

                            <div className="bg-white dark:bg-gray-900/50 p-6 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 mb-6">
                                {simType === 'buy' && (
                                    <div className="space-y-4">
                                        <label className="text-xs font-bold uppercase text-gray-400 block pb-1">Cantidad a Comprar</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="number"
                                                value={buyQty}
                                                onChange={e => setBuyQty(parseInt(e.target.value) || 0)}
                                                className="flex-1 bg-gray-50 dark:bg-gray-800 border-none rounded-xl p-3 text-lg font-black text-center focus:ring-2 focus:ring-blue-500"
                                            />
                                            <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-xl text-xs font-bold uppercase flex items-center">acciones</div>
                                        </div>
                                    </div>
                                )}

                                {simType === 'sell' && (
                                    <div className="space-y-4">
                                        <label className="text-xs font-bold uppercase text-gray-400 block pb-1">Cantidad a Vender (Max: {analysis.quantity})</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="number"
                                                value={sellQty}
                                                onChange={e => setSellQty(Math.min(parseInt(e.target.value) || 0, analysis.quantity))}
                                                className="flex-1 bg-gray-50 dark:bg-gray-800 border-none rounded-xl p-3 text-lg font-black text-center focus:ring-2 focus:ring-red-500"
                                            />
                                            <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-xl text-xs font-bold uppercase flex items-center">acciones</div>
                                        </div>
                                    </div>
                                )}

                                {simType === 'price' && (
                                    <div className="space-y-4">
                                        <label className="text-xs font-bold uppercase text-gray-400 block pb-1">Cambio de Precio: {priceChange > 0 ? '+' : ''}{priceChange}%</label>
                                        <input
                                            type="range"
                                            min="-50"
                                            max="100"
                                            value={priceChange}
                                            onChange={e => setPriceChange(parseInt(e.target.value))}
                                            className="w-full accent-yellow-500 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                                        />
                                        <div className="flex justify-between text-[10px] uppercase font-bold text-gray-400">
                                            <span>-50%</span>
                                            <span>0%</span>
                                            <span>+100%</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <button onClick={runSimulation} className="w-full py-4 bg-gray-900 dark:bg-white text-white dark:text-black rounded-xl font-black uppercase tracking-widest hover:opacity-90 transition-opacity">
                                Ejecutar Simulación
                            </button>
                        </div>

                        {simulation && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fadeIn">
                                <MetricCard label="Nuevo Precio Avg" value={formatCurrency(simulation.newAveragePrice)} />
                                <MetricCard label="Nueva Cantidad" value={simulation.newQuantity.toString()} />
                                <MetricCard label="Nuevo Valor" value={formatCurrency(simulation.newTotalValue)} />
                                <MetricCard
                                    label="PnL Proyectado"
                                    value={formatCurrency(simulation.projectedPnL)}
                                    color={simulation.projectedPnL >= 0 ? 'text-green-500' : 'text-red-500'}
                                />
                            </div>
                        )}
                    </div>
                );

            case 'calendar':
                const events = analysis.calendarEvents || [];
                if (events.length === 0) return <div className="text-center py-20 text-gray-400 italic font-bold uppercase tracking-widest text-xs">No hay eventos próximos registrados</div>;

                return (
                    <div className="space-y-6 animate-fadeIn max-w-2xl mx-auto">
                        <div className="relative border-l-2 border-gray-200 dark:border-gray-700 ml-3 space-y-8 pb-4">
                            {events.map((e, idx) => {
                                const date = new Date(e.date);
                                const isEarnings = e.type.includes('EARNINGS');
                                const isDividend = e.type === 'DIVIDEND';

                                return (
                                    <div key={idx} className="relative pl-8">
                                        <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white dark:border-gray-900 ${isEarnings ? 'bg-blue-500' : isDividend ? 'bg-green-500' : 'bg-gray-400'}`}></div>

                                        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${e.isConfirmed
                                                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                                                            }`}>
                                                            {e.isConfirmed ? 'CONFIRMADO' : 'ESTIMADO'}
                                                        </span>
                                                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                                            {date.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                                        </span>
                                                    </div>
                                                    <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                                                        {isEarnings ? <BarChart2 size={18} className="text-blue-500" /> : isDividend ? <DollarSign size={18} className="text-green-500" /> : <Activity size={18} />}
                                                        {e.title}
                                                    </h3>
                                                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 font-medium">{e.description}</p>
                                                </div>

                                                <div className="flex flex-col gap-2">
                                                    <a
                                                        href={googleCalendarUrl(e)}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-colors"
                                                        title="Añadir a Google Calendar"
                                                    >
                                                        <ExternalLink size={18} />
                                                    </a>
                                                    <button
                                                        onClick={() => downloadIcs(e)}
                                                        className="p-2 text-gray-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-xl transition-colors"
                                                        title="Descargar ICS"
                                                    >
                                                        <Download size={18} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );

            case 'fundamental':
                if (!f || !calc) return <div className="text-center py-20 text-gray-400 italic font-bold uppercase tracking-widest text-xs">Datos fundamentales no disponibles</div>;

                return (
                    <div className="space-y-8 animate-fadeIn">
                        {/* ROW 1: VALORACION & FAIR VALUE */}
                        <div>
                            <h3 className="text-xs font-black text-blue-500 dark:text-blue-400 mb-4 flex items-center gap-2 uppercase tracking-widest">
                                <DollarSign size={14} /> Valoración y Valor Justo
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <MetricCard
                                    label="Target Analistas"
                                    value={formatCurrency(analysis.analysts?.targetPrice)}
                                    subtext={analysis.analysts?.targetUpside ? `Upside: ${analysis.analysts.targetUpside}%` : ''}
                                />
                                <MetricCard
                                    label="Graham Number"
                                    value={calc.grahamNumber ? formatCurrency(calc.grahamNumber) : 'N/A'}
                                    subtext={calc.grahamNumber && analysis.currentPrice < calc.grahamNumber ? 'Infravalorada' : 'Sobrevalorada'}
                                    color={calc.grahamNumber && analysis.currentPrice < calc.grahamNumber ? 'text-green-500' : 'text-yellow-500'}
                                />
                                <MetricCard
                                    label="P/FCF"
                                    value={calc.pFcf ? formatNumber(calc.pFcf) + 'x' : 'N/A'}
                                    color={calc.pFcf && calc.pFcf < 15 ? 'text-green-500' : undefined}
                                />
                                <MetricCard label="EV / EBITDA" value={formatNumber(f.enterpriseValue / f.ebitda)} />
                                <MetricCard label="Market Cap" value={formatLargeNumber(f.marketCap)} />
                                <MetricCard label="PER (Trailing)" value={formatNumber(f.trailingPE)} />
                                <MetricCard label="PEG Ratio" value={formatNumber(f.pegRatio)} />
                                <MetricCard label="Price / Sales" value={formatNumber(f.priceToSales)} />
                            </div>
                        </div>

                        {/* ROW 2: RENTABILIDAD */}
                        <div>
                            <h3 className="text-xs font-black text-purple-500 dark:text-purple-400 mb-4 flex items-center gap-2 uppercase tracking-widest">
                                <PieChart size={14} /> Rentabilidad y Márgenes
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <MetricCard label="Margen Bruto" value={formatPercent(f.grossMargins)} />
                                <MetricCard label="Margen EBITDA" value={formatPercent(f.ebitdaMargins)} />
                                <MetricCard label="Margen Neto" value={formatPercent(f.profitMargins)} />
                                <MetricCard label="ROE" value={formatPercent(f.returnOnEquity)} />
                            </div>
                        </div>

                        {/* ROW 3: CRECIMIENTO & CASH FLOW */}
                        <div>
                            <h3 className="text-xs font-black text-green-500 dark:text-green-400 mb-4 flex items-center gap-2 uppercase tracking-widest">
                                <TrendingUp size={14} /> Crecimiento y Flujo de Caja
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <MetricCard label="Crecim. Ventas (YoY)" value={formatPercent(f.revenueGrowth)} color={f.revenueGrowth > 0.10 ? 'text-green-500' : undefined} />
                                <MetricCard label="Crecim. Beneficios" value={formatPercent(f.earningsGrowth)} color={f.earningsGrowth > 0.10 ? 'text-green-500' : undefined} />
                                <MetricCard label="Free Cash Flow" value={formatLargeNumber(f.freeCashflow)} color="text-emerald-500" />
                                <MetricCard label="Op. Cash Flow" value={formatLargeNumber(f.operatingCashflow)} />
                            </div>
                        </div>

                        {/* ROW 4: SALUD FINANCIERA */}
                        <div>
                            <h3 className="text-xs font-black text-red-500 dark:text-red-400 mb-4 flex items-center gap-2 uppercase tracking-widest">
                                <Activity size={14} /> Salud Financiera
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <MetricCard label="Deuda Neta" value={formatLargeNumber(calc.netDebt)} />
                                <MetricCard label="Caja Total" value={formatLargeNumber(f.totalCash)} subtext={f.totalCashPerShare ? `${formatCurrency(f.totalCashPerShare)} / acc` : ''} />
                                <MetricCard label="Deuda / Equity" value={formatNumber(f.debtToEquity)} />
                                <MetricCard label="Quick Ratio" value={formatNumber(f.quickRatio)} color={f.quickRatio < 1 ? 'text-red-500' : undefined} />
                            </div>
                        </div>

                        {/* ROW 5/6: ESTRUCTURA & DIVIDENDOS */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h3 className="text-xs font-black text-purple-500 dark:text-purple-400 mb-4 flex items-center gap-2 uppercase tracking-widest">
                                    <Lock size={14} /> Estructura
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <MetricCard label="% Inst." value={formatPercent(f.heldPercentInstitutions)} />
                                    <MetricCard label="% Insiders" value={formatPercent(f.heldPercentInsiders)} />
                                    <MetricCard label="Short Ratio" value={formatNumber(f.shortRatio)} />
                                    <MetricCard label="Book Value" value={formatNumber(f.bookValue)} />
                                </div>
                            </div>
                            <div>
                                <h3 className="text-xs font-black text-yellow-500 dark:text-yellow-400 mb-4 flex items-center gap-2 uppercase tracking-widest">
                                    <DollarSign size={14} /> Dividendos
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <MetricCard label="Yield" value={formatPercent(f.dividendYield)} color="text-yellow-500" />
                                    <MetricCard label="Payout Ratio" value={formatPercent(f.payoutRatio)} />
                                    <MetricCard label="Rate" value={formatCurrency(f.dividendRate)} />
                                    <MetricCard label="Ex-Date" value={f.exDividendDate} />
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'overview':
                return (
                    <div className="space-y-5 animate-fadeIn">
                        {/* KPI Cards: Price & Return */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-gray-100 dark:bg-gray-800 p-5 rounded-[2rem] border border-gray-200 dark:border-gray-700 shadow-sm">
                                <div className="text-gray-500 dark:text-gray-400 text-xs mb-1 uppercase font-bold tracking-wider">Precio Actual</div>
                                <div className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter">
                                    {formatCurrency(analysis?.currentPrice)}
                                </div>
                                <div className="text-[10px] text-gray-500 font-bold uppercase mt-1">
                                    Volatilidad: {analysis?.risk.volatility}%
                                </div>
                            </div>
                            <div className="bg-gray-100 dark:bg-gray-800 p-5 rounded-[2rem] border border-gray-200 dark:border-gray-700 shadow-sm">
                                <div className="text-gray-500 dark:text-gray-400 text-xs mb-1 uppercase font-bold tracking-wider">Retorno Total</div>
                                <div className={`text-3xl font-black tracking-tighter ${analysis!.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                    {analysis!.pnl >= 0 ? '+' : ''}{formatCurrency(analysis?.pnl)}
                                </div>
                                <div className={`text-[10px] font-bold uppercase mt-1 ${analysis!.pnlPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                    {analysis!.pnlPercent >= 0 ? '+' : ''}{analysis?.pnlPercent}%
                                </div>
                            </div>
                        </div>

                        {/* Sector & Valuation Highlights */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-primary/10 p-5 rounded-[2rem] border border-primary/20 shadow-sm">
                                <div className="text-primary text-xs font-black mb-1 uppercase tracking-widest flex items-center gap-2">
                                    <PieChart size={14} /> Sector e Industria
                                </div>
                                <div className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter truncate">
                                    {analysis.sector}
                                </div>
                                <div className="text-xs text-gray-500 font-bold uppercase tracking-wider truncate">
                                    {analysis.industry}
                                </div>
                            </div>

                            <div className="bg-purple-50 dark:bg-purple-900/10 p-5 rounded-[2rem] border border-purple-100 dark:border-purple-900/30">
                                <div className="text-purple-500 dark:text-purple-400 text-xs font-black mb-2 flex items-center gap-2 uppercase tracking-widest">
                                    <Activity size={14} /> Estado de Valoración
                                </div>
                                {(() => {
                                    const targetPrice = analysis.analysts?.targetPrice || 0;
                                    const grahamPrice = calc?.grahamNumber || 0;
                                    const currentPrice = analysis.currentPrice;

                                    let status = "Neutral";
                                    let color = "text-gray-500";
                                    let icon = <Info size={16} className="text-gray-400" />;

                                    if (targetPrice > currentPrice * 1.15 || (grahamPrice > currentPrice && grahamPrice !== 0)) {
                                        status = "Infravalorada";
                                        color = "text-green-500";
                                        icon = <TrendingUp size={16} className="text-green-500" />;
                                    } else if (currentPrice > targetPrice * 1.15 && targetPrice !== 0) {
                                        status = "Sobrevalorada";
                                        color = "text-red-500";
                                        icon = <AlertTriangle size={16} className="text-red-500" />;
                                    } else if (targetPrice > 0) {
                                        status = "Precio Justo";
                                        color = "text-blue-500";
                                    }

                                    return (
                                        <div className="flex justify-between items-end">
                                            <div>
                                                <div className={`text-2xl font-black tracking-tighter ${color} flex items-center gap-2`}>
                                                    {icon} {status}
                                                </div>
                                                <div className="text-[10px] text-gray-500 font-bold uppercase mt-1">
                                                    Target: {targetPrice > 0 ? formatCurrency(targetPrice) : 'N/A'}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>

                        {/* Dual Risk Indicators */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-gray-100 dark:bg-gray-800/50 p-5 rounded-[2rem] border border-gray-200 dark:border-gray-700">
                                <div className="text-xs font-black uppercase tracking-widest text-gray-500 mb-2">Riesgo Precio (Volatilidad)</div>
                                <div className="flex items-center gap-4">
                                    <span className="text-3xl font-black tracking-tighter">{analysis.risk.score}/10</span>
                                    <div className="flex-1 h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden shadow-inner">
                                        <div className={`h-full transition-all duration-1000 ${analysis.risk.score < 4 ? 'bg-green-500' : analysis.risk.score < 7 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${analysis.risk.score * 10}%` }}></div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-gray-100 dark:bg-gray-800/50 p-5 rounded-[2rem] border border-gray-200 dark:border-gray-700">
                                <div className="flex justify-between items-center mb-2">
                                    <div className="text-xs font-black uppercase tracking-widest text-gray-500">Riesgo Solvencia</div>
                                    {analysis.risk.solvency && (
                                        <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter ${analysis.risk.solvency.zone === 'SAFE' ? 'bg-green-100 text-green-700' : analysis.risk.solvency.zone === 'GREY' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                            {analysis.risk.solvency.label}
                                        </span>
                                    )}
                                </div>
                                <div className="text-xl font-black tracking-tighter">
                                    Altman Z-Score: {analysis.risk.solvency?.zScore.toFixed(2) || 'N/A'}
                                </div>
                                <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">
                                    {analysis.risk.solvency?.zone === 'SAFE' ? 'Bajo riesgo de quiebra' : analysis.risk.solvency?.zone === 'GREY' ? 'Precaución recomendada' : 'Riesgo financiero elevado'}
                                </p>
                            </div>
                        </div>
                    </div>
                );

            case 'technical':
                const t = analysis?.technical;
                if (!t) return <div className="text-center py-10 font-bold uppercase text-gray-500">Sin datos técnicos</div>;
                return (
                    <div className="space-y-6 animate-fadeIn">
                        <div className="grid grid-cols-2 gap-4">
                            <MetricCard
                                label="RSI (14d)"
                                value={formatNumber(t.rsi)}
                                color={t.rsi && (t.rsi > 70 ? 'text-red-500' : t.rsi < 30 ? 'text-green-500' : 'text-blue-500') || ''}
                                subtext={t.rsi ? (t.rsi > 70 ? 'Sobrecompra' : t.rsi < 30 ? 'Sobreventa' : 'Neutral') : ''}
                            />
                            <MetricCard
                                label="Tendencia"
                                value={t.trend}
                                color={t.trend.includes('ALCISTA') || t.trend === 'BULLISH' ? 'text-green-500' : t.trend.includes('BAJISTA') || t.trend === 'BEARISH' ? 'text-red-500' : 'text-gray-400'}
                            />
                        </div>
                        <div className="p-6 bg-gray-100 dark:bg-gray-800/30 rounded-[2rem] border border-gray-200 dark:border-gray-700">
                            <h4 className="text-[10px] font-bold uppercase mb-4 text-gray-500 tracking-widest">Promedios Móviles</h4>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl">
                                    <span className="text-xs font-bold uppercase text-gray-400">SMA 50 (Medio Plazo)</span>
                                    <span className={`font-black text-lg ${analysis.currentPrice > (t.sma50 || 0) ? 'text-green-500' : 'text-red-500'}`}>
                                        {formatCurrency(t.sma50)}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl">
                                    <span className="text-xs font-bold uppercase text-gray-400">SMA 200 (Largo Plazo)</span>
                                    <span className={`font-black text-lg ${analysis.currentPrice > (t.sma200 || 0) ? 'text-green-500' : 'text-red-500'}`}>
                                        {formatCurrency(t.sma200)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'risk':
                return (
                    <div className="space-y-6 animate-fadeIn">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <MetricCard label="Riesgo (Score)" value={`${analysis.risk.score}/10`} color={analysis.risk.score < 4 ? 'text-green-500' : analysis.risk.score < 7 ? 'text-yellow-500' : 'text-red-500'} />
                            <MetricCard label="Volatilidad" value={formatPercent(analysis.risk.volatility)} />
                            <MetricCard label="Beta" value={formatNumber(analysis.risk.beta)} />
                            <MetricCard label="Sharpe Ratio" value={formatNumber(analysis.risk.sharpe)} />
                            <MetricCard label="Sortino Ratio" value={formatNumber(analysis.risk.sortino)} />
                            <MetricCard label="Max Drawdown" value={formatPercent(analysis.risk.maxDrawdown)} color="text-red-500" />
                            <MetricCard label="VaR (95%)" value={formatPercent(analysis.risk.var95)} />
                        </div>
                    </div>
                );
            case 'analysts':
                const a = analysis?.analysts;
                if (!a) return null;
                return (
                    <div className="space-y-6 animate-fadeIn">
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <MetricCard label="Consenso" value={a.consensus || 'N/A'} color="text-blue-500" />
                            <MetricCard label="Target Avg" value={formatCurrency(a.targetPrice)} />
                            <MetricCard label="Upside" value={a.targetUpside ? `${a.targetUpside}%` : 'N/A'} color={parseFloat(a.targetUpside || '0') > 0 ? 'text-green-500' : 'text-red-500'} />
                            <MetricCard label="Analistas" value={a.numberOfAnalysts} />
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-white dark:bg-[#1A1A1A] w-full max-w-5xl h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-gray-200 dark:border-gray-800">

                {/* --- HEADER (Imagen 2 Style) --- */}
                <div className="bg-[#121212] p-8 rounded-t-[2.5rem] border-b border-gray-800 relative overflow-hidden">
                    {/* Background Glow Effect */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

                    <div className="relative flex justify-between items-center">
                        <div className="flex items-center gap-5">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gray-800 to-black border border-gray-700 flex items-center justify-center shadow-lg">
                                <span className="text-lg font-black text-primary">{ticker.slice(0, 2)}</span>
                            </div>
                            <div>
                                <h2 className="text-4xl font-black text-white tracking-tighter uppercase mb-2 flex items-center gap-3">
                                    {ticker}
                                    <span className="text-base font-bold text-gray-500 bg-gray-800/50 px-3 py-1 rounded-lg tracking-wider border border-gray-700">
                                        {companyName || ticker}
                                    </span>
                                </h2>
                                <div className="flex items-center gap-2">
                                    <span className="text-yellow-500 font-bold text-[10px] tracking-[0.2em] uppercase">
                                        PORTFOLIO POSITION STATISTICS
                                    </span>
                                    <span className="text-gray-600 text-[10px]">•</span>
                                    <span className="text-yellow-500 font-bold text-[10px] tracking-[0.2em] uppercase">
                                        PREMIUM DEEP ANALYSIS
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={handleRefresh}
                                className={`p-3 bg-gray-800/50 hover:bg-gray-700 text-gray-400 hover:text-white rounded-2xl transition-all border border-transparent hover:border-gray-600 ${loading ? 'animate-spin' : ''}`}
                                title="Refrescar Datos"
                            >
                                <RefreshCw size={24} />
                            </button>
                            <button
                                onClick={onClose}
                                className="p-3 bg-gray-800/50 hover:bg-gray-700 text-gray-400 hover:text-white rounded-2xl transition-all border border-transparent hover:border-gray-600"
                            >
                                <X size={24} />
                            </button>
                        </div>
                    </div>

                    {/* Tabs (Pill Style) */}
                    <div className="mt-8">
                        <div className="inline-flex bg-black/30 p-1.5 rounded-full border border-gray-800">
                            {(['overview', 'fundamental', 'technical', 'analysts', 'calendar', 'risk', 'simulation'] as const).map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${activeTab === tab
                                        ? 'bg-white text-black shadow-lg shadow-white/10'
                                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                                        }`}
                                >
                                    {tab === 'overview' ? 'General' : tab === 'fundamental' ? 'Fundamental' : tab === 'technical' ? 'Técnico' : tab === 'analysts' ? 'Analistas' : tab === 'calendar' ? 'Calendario' : tab === 'risk' ? 'Riesgo' : 'Simular'}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* --- SCROLLABLE CONTENT --- */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    {renderContent()}
                </div>

                {/* --- FOOTER (Imagen 1 Style) --- */}
                <div className="bg-[#0f0f11] px-8 py-4 border-t border-gray-800/50 text-[10px] font-bold uppercase tracking-widest text-gray-500 flex justify-between items-center rounded-b-[2.5rem]">
                    <div className="flex items-center gap-8">
                        <div className="flex items-center gap-2">
                            <Info size={12} className="text-yellow-500" />
                            <span>Datos de Yahoo Finance & Finnhub</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Signal size={12} className="text-yellow-500" />
                            <span>Análisis Algorítmico Activo</span>
                        </div>
                    </div>
                    <div>
                        STOCKS MANAGER <span className="text-white">{appVersion}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
