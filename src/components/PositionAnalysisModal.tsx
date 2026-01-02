import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, TrendingUp, Activity, AlertTriangle, DollarSign, PieChart, BarChart2, Info, Lock, Calendar, Download, ExternalLink } from 'lucide-react';

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
    const { api } = useAuth();
    const [analysis, setAnalysis] = useState<PositionAnalysis | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'fundamental' | 'technical' | 'analysts' | 'risk' | 'whatif' | 'calendar'>('overview');

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
        }
    }, [isOpen, positionId, fetchAnalysis]);

    // Close on ESC
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

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
        // Yahoo mostly returns raw decimals (0.05 = 5%)
        return (val * 100).toFixed(2) + '%';
    };

    const formatTime = (isoDate: string) => {
        const date = new Date(isoDate);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);

        if (diffMins < 60) return `hace ${diffMins} min`;
        return `hace ${diffHours}h ${diffMins % 60}min`;
    };

    // --- OPTIMIZED TOOLTIP COMPONENT ---
    // Isolates mouse tracking to prevent re-rendering the entire parent modal
    const MouseTooltip = ({ data }: { data: { text: string; x: number; y: number } | null }) => {
        const [pos, setPos] = useState({ x: 0, y: 0 });

        useEffect(() => {
            if (data) {
                setPos({ x: data.x, y: data.y });
            }
        }, [data]);

        useEffect(() => {
            if (!data) return;

            const updatePos = (e: MouseEvent) => {
                // Use requestAnimationFrame for smooth performance without blocking main thread
                requestAnimationFrame(() => {
                    setPos({ x: e.clientX, y: e.clientY });
                });
            };

            window.addEventListener('mousemove', updatePos);
            return () => window.removeEventListener('mousemove', updatePos);
        }, [!!data]);

        if (!data) return null;

        return (
            <div
                className="fixed z-[9999] max-w-xs p-3 bg-gray-900 text-xs text-white rounded-lg shadow-2xl pointer-events-none border border-gray-700"
                style={{
                    left: pos.x + 12,
                    top: pos.y + 12,
                }}
            >
                {data.text}
            </div>
        );
    };

    const [activeTooltip, setActiveTooltip] = useState<{ text: string; x: number; y: number } | null>(null);

    // --- METRIC CARD ---
    const MetricCard = ({ label, value, subtext, color, tooltip }: any) => (
        <div
            className="relative bg-gray-100 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500/30 transition-colors"
            onMouseEnter={(e) => tooltip && setActiveTooltip({ text: tooltip, x: e.clientX, y: e.clientY })}
            onMouseLeave={() => setActiveTooltip(null)}
        >
            <div className="flex items-center justify-between mb-1">
                <span className="text-gray-500 dark:text-gray-400 text-xs">
                    {label}
                </span>
            </div>
            <div className={`text-lg font-bold ${color || 'text-gray-900 dark:text-white'}`}>{value}</div>
            {subtext && <div className="text-xs text-gray-500">{subtext}</div>}
        </div>
    );

    // --- CALCULATED METRICS ---
    const getCalculatedMetrics = (f: FundamentalData, currentPrice: number) => {
        // 1. Graham Number = Sqrt(22.5 * EPS * BookValue)
        let grahamNumber = null;
        if (f.trailingEps > 0 && f.bookValue > 0) {
            grahamNumber = Math.sqrt(22.5 * f.trailingEps * f.bookValue);
        }

        // 2. Price / FCF = Market Cap / Free Cash Flow
        let pFcf = null;
        if (f.marketCap && f.freeCashflow && f.freeCashflow > 0) {
            pFcf = f.marketCap / f.freeCashflow;
        }

        // 3. Net Debt = Total Debt - Total Cash
        let netDebt = null;
        if (f.totalDebt !== undefined && f.totalCash !== undefined) {
            netDebt = f.totalDebt - f.totalCash;
        }

        return { grahamNumber, pFcf, netDebt };
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

    const handleRefresh = async () => {
        setLoading(true);
        try {
            await api.post(`/analysis/refresh/${positionId}`);
            await fetchAnalysis();
        } catch (e) {
            console.error('Refresh error:', e);
        }
    };

    const renderContent = () => {
        if (loading) {
            return (
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
            );
        }

        if (error) {
            return (
                <div className="text-center py-10">
                    <p className="text-red-500 mb-4">{error}</p>
                    <button onClick={fetchAnalysis} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">Reintentar</button>
                </div>
            );
        }

        if (!analysis) return null;

        const { fundamentals: f } = analysis;
        const calc = f ? getCalculatedMetrics(f, analysis.currentPrice) : null;



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

        switch (activeTab) {
            case 'calendar':
                const events = analysis.calendarEvents || [];
                if (events.length === 0) return <div className="text-center py-10 text-gray-400">No hay eventos próximos registrados.</div>;

                return (
                    <div className="space-y-6 animate-fadeIn max-w-2xl mx-auto">
                        <div className="relative border-l-2 border-gray-200 dark:border-gray-700 ml-3 space-y-8 pb-4">
                            {events.map((e, idx) => {
                                const date = new Date(e.date);
                                const isEarnings = e.type.includes('EARNINGS');
                                const isDividend = e.type === 'DIVIDEND';

                                return (
                                    <div key={idx} className="relative pl-8">
                                        {/* Dot on timeline */}
                                        <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white dark:border-gray-900 ${isEarnings ? 'bg-blue-500' : isDividend ? 'bg-green-500' : 'bg-gray-400'
                                            }`}></div>

                                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${e.isConfirmed
                                                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                                                            }`}>
                                                            {e.isConfirmed ? 'CONFIRMADO' : 'ESTIMADO'}
                                                        </span>
                                                        <span className="text-xs text-gray-500">
                                                            {date.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                                        </span>
                                                    </div>
                                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                                        {isEarnings ? <BarChart2 size={18} className="text-blue-500" /> : isDividend ? <DollarSign size={18} className="text-green-500" /> : <Activity size={18} />}
                                                        {e.title}
                                                    </h3>
                                                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{e.description}</p>
                                                </div>

                                                {/* Actions */}
                                                <div className="flex flex-col gap-2">
                                                    <a
                                                        href={googleCalendarUrl(e)}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                                        title="Añadir a Google Calendar"
                                                    >
                                                        <ExternalLink size={18} />
                                                    </a>
                                                    <button
                                                        onClick={() => downloadIcs(e)}
                                                        className="p-2 text-gray-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                                                        title="Descargar ICS (Outlook/Apple)"
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
                if (!f || !calc) return <div className="text-center py-10 text-gray-400">Datos fundamentales no disponibles</div>;

                return (
                    <div className="space-y-6 animate-fadeIn">
                        {/* ROW 1: VALORACION & FAIR VALUE */}
                        <div>
                            <h3 className="text-sm font-semibold text-blue-500 dark:text-blue-400 mb-3 flex items-center gap-2">
                                <DollarSign size={16} /> Valoración y Valor Justo
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <MetricCard
                                    label="Analyst Target"
                                    value={formatCurrency(analysis.analysts?.targetPrice)}
                                    subtext={analysis.analysts?.targetUpside ? `Upside: ${analysis.analysts.targetUpside}%` : ''}
                                    tooltip="Precio objetivo promedio estimado por analistas para los próximos 12 meses."
                                />
                                <MetricCard
                                    label="Graham Number"
                                    value={calc.grahamNumber ? formatCurrency(calc.grahamNumber) : 'N/A'}
                                    subtext={calc.grahamNumber && analysis.currentPrice < calc.grahamNumber ? 'Infravalorada' : 'Sobrevalorada'}
                                    color={calc.grahamNumber && analysis.currentPrice < calc.grahamNumber ? 'text-green-500' : 'text-yellow-500'}
                                    tooltip="Valor teórico conservador (Benjamin Graham). Si el precio es menor, podría ser una oportunidad."
                                />
                                <MetricCard
                                    label="P/FCF"
                                    value={calc.pFcf ? formatNumber(calc.pFcf) + 'x' : 'N/A'}
                                    color={calc.pFcf && calc.pFcf < 15 ? 'text-green-500' : undefined}
                                    tooltip="Precio / Flujo de Caja Libre. Mide cuántos años tarda la empresa en pagarse con dinero real. < 15 es excelente."
                                />
                                <MetricCard
                                    label="EV / EBITDA"
                                    value={formatNumber(f.enterpriseValue / f.ebitda)}
                                    tooltip="Valor Empresa / EBITDA. Métrica de valoración estándar que ignora deuda/caja. Comparar con sector."
                                />
                                <MetricCard label="Market Cap" value={formatLargeNumber(f.marketCap)} tooltip="Valor total de mercado de todas las acciones." />
                                <MetricCard label="PER (Trailing)" value={formatNumber(f.trailingPE)} tooltip="Precio / Beneficio últimos 12 meses. Cuánto pagas por cada $1 de beneficio." />
                                <MetricCard label="PEG Ratio" value={formatNumber(f.pegRatio)} tooltip="PER ajustado al crecimiento. < 1 suele indicar acción barata respecto a su crecimiento." />
                                <MetricCard label="Price / Sales" value={formatNumber(f.priceToSales)} tooltip="Precio / Ventas. Útil para empresas que aún no tienen beneficios." />
                            </div>
                        </div>

                        {/* ROW 2: RENTABILIDAD */}
                        <div>
                            <h3 className="text-sm font-semibold text-purple-500 dark:text-purple-400 mb-3 flex items-center gap-2">
                                <PieChart size={16} /> Rentabilidad y Márgenes
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <MetricCard
                                    label="Margen Bruto"
                                    value={formatPercent(f.grossMargins)}
                                    tooltip="% de ingresos que queda tras coste de ventas. Indica poder de fijación de precios."
                                />
                                <MetricCard
                                    label="Margen EBITDA"
                                    value={formatPercent(f.ebitdaMargins)}
                                    tooltip="Rentabilidad operativa pura antes de impuestos, intereses y depreciación."
                                />
                                <MetricCard label="Margen Neto" value={formatPercent(f.profitMargins)} tooltip="% final de ingresos que se convierte en beneficio neto." />
                                <MetricCard label="ROE" value={formatPercent(f.returnOnEquity)} tooltip="Retorno sobre Patrimonio. Eficiencia invirtiendo el dinero de los accionistas." />
                            </div>
                        </div>

                        {/* ROW 3: CRECIMIENTO & CASH FLOW */}
                        <div>
                            <h3 className="text-sm font-semibold text-green-500 dark:text-green-400 mb-3 flex items-center gap-2">
                                <TrendingUp size={16} /> Crecimiento y Flujo de Caja
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <MetricCard
                                    label="Crecim. Ventas (YoY)"
                                    value={formatPercent(f.revenueGrowth)}
                                    color={f.revenueGrowth > 0.10 ? 'text-green-500' : undefined}
                                    tooltip="Crecimiento de ingresos respecto al año anterior."
                                />
                                <MetricCard
                                    label="Crecim. Beneficios"
                                    value={formatPercent(f.earningsGrowth)}
                                    color={f.earningsGrowth > 0.10 ? 'text-green-500' : undefined}
                                    tooltip="Crecimiento de beneficios trimestrales."
                                />
                                <MetricCard
                                    label="Free Cash Flow"
                                    value={formatLargeNumber(f.freeCashflow)}
                                    color="text-emerald-500"
                                    tooltip="Dinero real que la empresa genera tras mantener sus operaciones. Vital para invertir."
                                />
                                <MetricCard label="Op. Cash Flow" value={formatLargeNumber(f.operatingCashflow)} tooltip="Dinero generado por las actividades principales del negocio." />
                            </div>
                        </div>


                        {/* ROW 4: SALUD FINANCIERA */}
                        <div>
                            <h3 className="text-sm font-semibold text-red-500 dark:text-red-400 mb-3 flex items-center gap-2">
                                <Activity size={16} /> Salud Financiera
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <MetricCard
                                    label="Deuda Neta"
                                    value={formatLargeNumber(calc.netDebt)}
                                    tooltip="Deuda Total menos Caja. Si es negativo, la empresa tiene más caja que deuda (Caja Neta)."
                                />
                                <MetricCard
                                    label="Caja Total"
                                    value={formatLargeNumber(f.totalCash)}
                                    subtext={f.totalCashPerShare ? `${formatCurrency(f.totalCashPerShare)} / acc` : ''}
                                    tooltip="Efectivo total disponible e inversiones a corto plazo."
                                />
                                <MetricCard label="Deuda / Equity" value={formatNumber(f.debtToEquity)} tooltip="Ratio de endeudamiento. > 100 significa que debe más de lo que vale su patrimonio." />
                                <MetricCard
                                    label="Quick Ratio"
                                    value={formatNumber(f.quickRatio)}
                                    color={f.quickRatio < 1 ? 'text-red-500' : undefined}
                                    tooltip="Capacidad de pagar deudas a corto plazo sin vender inventario. < 1 es peligroso."
                                />
                            </div>
                        </div>

                        {/* ROW 5: ESTRUCTURA & DIVIDENDOS */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h3 className="text-sm font-semibold text-purple-500 dark:text-purple-400 mb-3 flex items-center gap-2">
                                    <Lock size={16} /> Estructura y Sentimiento
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <MetricCard
                                        label="% Inst."
                                        value={formatPercent(f.heldPercentInstitutions)}
                                        tooltip="Porcentaje de acciones en manos de grandes fondos / bancos."
                                    />
                                    <MetricCard
                                        label="% Insiders"
                                        value={formatPercent(f.heldPercentInsiders)}
                                        tooltip="Porcentaje en manos de directivos/fundadores. Alto es bueno (Skin in the game)."
                                    />
                                    <MetricCard
                                        label="Short Ratio"
                                        value={formatNumber(f.shortRatio)}
                                        tooltip="Días necesarios para cubrir cortos. Alto (>5) puede indicar pesimismo o potencial Short Squeeze."
                                    />
                                    <MetricCard label="Book Value" value={formatNumber(f.bookValue)} tooltip="Valor contable por acción." />
                                </div>
                            </div>

                            <div>
                                <h3 className="text-sm font-semibold text-yellow-500 dark:text-yellow-400 mb-3 flex items-center gap-2">
                                    <DollarSign size={16} /> Dividendos
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <MetricCard label="Yield" value={formatPercent(f.dividendYield)} color="text-yellow-500" tooltip="Rentabilidad por dividendo anualizada." />
                                    <MetricCard label="Payout Ratio" value={formatPercent(f.payoutRatio)} tooltip="% de beneficios destinados a dividendos. > 80% puede ser insostenible." />
                                    <MetricCard label="Rate" value={formatCurrency(f.dividendRate)} tooltip="Pago anual en efectivo por acción." />
                                    <MetricCard label="Ex-Date" value={f.exDividendDate} tooltip="Fecha límite para comprar y recibir el próximo dividendo." />
                                </div>
                            </div>
                        </div>

                        <div className="text-center text-xs text-gray-500 pt-4 border-t border-gray-200 dark:border-gray-700">
                            * [CALCULADO]: Métricas estimadas (Graham, P/FCF, Deuda Neta) usando datos de último cierre.
                            El resto proviene de reportes financieros oficiales (Yahoo Finance).
                        </div>
                    </div>
                );

            case 'overview':
                return (
                    <div className="space-y-6 animate-fadeIn">
                        {/* KPI Summary */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                                <div className="text-gray-500 dark:text-gray-400 text-xs mb-1">Precio Actual</div>
                                <div className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                                    {formatCurrency(analysis?.currentPrice)}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                    Volatilidad: {analysis?.risk.volatility}%
                                </div>
                            </div>
                            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                                <div className="text-gray-500 dark:text-gray-400 text-xs mb-1">Retorno Total</div>
                                <div className={`text-2xl font-bold tracking-tight ${analysis!.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                    {analysis!.pnl >= 0 ? '+' : ''}{formatCurrency(analysis?.pnl)}
                                </div>
                                <div className={`text-xs ${analysis!.pnlPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                    {analysis!.pnlPercent >= 0 ? '+' : ''}{analysis?.pnlPercent}%
                                </div>
                            </div>
                        </div>

                        {/* Dual Risk Indicators (v2.3.0) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Price Risk (Volatility-based) */}
                            <div className="bg-gray-100 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="text-sm font-semibold flex items-center gap-2">
                                        <TrendingUp size={16} className="text-blue-500" /> Riesgo Precio
                                    </h3>
                                    <span className="text-xl font-bold">{analysis?.risk.score}/10</span>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden mb-2">
                                    <div
                                        className={`h-full transition-all duration-500 ${analysis!.risk.score < 4 ? 'bg-green-500' :
                                            analysis!.risk.score < 7 ? 'bg-yellow-500' : 'bg-red-500'
                                            }`}
                                        style={{ width: `${analysis!.risk.score * 10}%` }}
                                    ></div>
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {analysis!.risk.score < 4 ? 'Baja volatilidad' : analysis!.risk.score < 7 ? 'Volatilidad moderada' : 'Alta volatilidad'}
                                </p>
                            </div>

                            {/* Solvency Risk (Altman Z-Score) */}
                            <div className="bg-gray-100 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="text-sm font-semibold flex items-center gap-2">
                                        <AlertTriangle size={16} className="text-yellow-500" /> Riesgo Solvencia
                                    </h3>
                                    {analysis?.risk.solvency ? (
                                        <span className={`text-sm font-bold px-2 py-1 rounded-full ${analysis.risk.solvency.zone === 'SAFE' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                                            analysis.risk.solvency.zone === 'GREY' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                                                'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                            }`}>
                                            {analysis.risk.solvency.label}
                                        </span>
                                    ) : (
                                        <span className="text-sm text-gray-400">N/A</span>
                                    )}
                                </div>
                                {analysis?.risk.solvency && (
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                        <p className="mb-1">Altman Z-Score: <span className="font-medium text-gray-700 dark:text-gray-300">{analysis.risk.solvency.zScore}</span></p>
                                        <p>{analysis.risk.solvency.zone === 'SAFE' ? 'Bajo riesgo de quiebra' : analysis.risk.solvency.zone === 'GREY' ? 'Precaución recomendada' : 'Riesgo financiero elevado'}</p>
                                    </div>
                                )}
                                {!analysis?.risk.solvency && (
                                    <p className="text-xs text-gray-400">Datos insuficientes para calcular</p>
                                )}
                            </div>
                        </div>
                    </div>
                );

            case 'technical':
                // (Reusing existing technical tab logic from memory or keeping simple)
                const t = analysis?.technical;
                if (!t) return <div className="text-center py-10">Sin datos técnicos</div>;
                return (
                    <div className="space-y-6 animate-fadeIn">
                        <div className="grid grid-cols-2 gap-4">
                            <MetricCard
                                label="RSI (14d)"
                                value={formatNumber(t.rsi)}
                                color={t.rsi && (t.rsi > 70 || t.rsi < 30) ? 'text-yellow-500' : undefined}
                                subtext={t.rsi ? (t.rsi > 70 ? 'Sobrecompra' : t.rsi < 30 ? 'Sobreventa' : 'Neutral') : ''}
                                tooltip="Índice de Fuerza Relativa. Indica si el precio está sobreextendido (>70 sobrecompra, <30 sobreventa)."
                            />
                            <MetricCard
                                label="Tendencia"
                                value={t.trend}
                                color={t.trend.includes('ALCISTA') || t.trend === 'BULLISH' ? 'text-green-500' : t.trend.includes('BAJISTA') || t.trend === 'BEARISH' ? 'text-red-500' : 'text-gray-400'}
                                tooltip="Dirección dominante del precio basada en medias móviles simples (SMA)."
                            />
                        </div>
                        <div className="p-4 bg-gray-100 dark:bg-gray-800/30 rounded-lg">
                            <h4 className="text-sm font-medium mb-3">Promedios Móviles</h4>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-gray-500" title="Media Móvil Simple de 50 días. Referencia para tendencia a medio plazo.">
                                    SMA 50
                                </span>
                                <span className={analysis.currentPrice > (t.sma50 || 0) ? 'text-green-500' : 'text-red-500'}>
                                    {formatCurrency(t.sma50)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-500" title="Media Móvil Simple de 200 días. La línea divisoria entre tendencia alcista y bajista a largo plazo.">
                                    SMA 200
                                </span>
                                <span className={analysis.currentPrice > (t.sma200 || 0) ? 'text-green-500' : 'text-red-500'}>
                                    {formatCurrency(t.sma200)}
                                </span>
                            </div>
                        </div>
                    </div>
                );

            case 'risk':
                // (Reusing risk logic)
                return (
                    <div className="grid grid-cols-2 gap-4">
                        <MetricCard
                            label="Volatilidad"
                            value={analysis.risk.volatility + '%'}
                            tooltip="Desviación estándar anualizada. Mide la intensidad de las oscilaciones del precio."
                        />
                        <MetricCard
                            label="Sharpe Ratio"
                            value={analysis.risk.sharpe.toFixed(2)}
                            tooltip="Retorno por unidad de riesgo asumido. >1 es bueno, >2 excelente."
                        />
                        <MetricCard
                            label="Max Drawdown"
                            value={analysis.risk.maxDrawdown + '%'}
                            color="text-red-500"
                            tooltip="La peor caída porcentual desde un máximo histórico (pico) hasta un mínimo (valle)."
                        />
                        <MetricCard
                            label="Beta"
                            value={analysis.risk.beta.toFixed(2)}
                            tooltip="Sensibilidad frente al mercado (S&P 500). 1 = Misma volatilidad. >1 = Más volátil."
                        />
                    </div>
                );

            case 'analysts':
                return (
                    <div className="space-y-4">
                        <MetricCard label="Consenso" value={analysis.analysts.consensus || 'N/A'} />
                        <MetricCard label="Precio Objetivo" value={formatCurrency(analysis.analysts.targetPrice)} />
                    </div>
                );

            case 'whatif':
                return (
                    <div className="space-y-6">
                        {/* Simulation Type Selector */}
                        <div className="flex gap-4 mb-6">
                            {[
                                { id: 'buy', label: '💰 Comprar más' },
                                { id: 'sell', label: '📤 Vender' },
                                { id: 'price', label: '📈 Cambio precio' }
                            ].map(type => (
                                <button
                                    key={type.id}
                                    onClick={() => { setSimType(type.id as any); setSimulation(null); }}
                                    className={`flex-1 py-3 px-4 rounded-lg border-2 transition-colors ${simType === type.id
                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                                        }`}
                                >
                                    {type.label}
                                </button>
                            ))}
                        </div>

                        {/* Simulation Inputs */}
                        <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-6">
                            {simType === 'buy' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Comprar acciones adicionales a {formatCurrency(analysis.currentPrice)}
                                    </label>
                                    <div className="flex gap-4 items-center">
                                        <input
                                            type="range"
                                            min="1"
                                            max="1000"
                                            value={buyQty}
                                            onChange={e => setBuyQty(parseInt(e.target.value))}
                                            className="flex-1"
                                        />
                                        <input
                                            type="number"
                                            value={buyQty}
                                            onChange={e => setBuyQty(parseInt(e.target.value) || 0)}
                                            className="w-24 px-3 py-1 border rounded text-black"
                                        />
                                    </div>
                                </div>
                            )}
                            {simType === 'sell' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Vender acciones a {formatCurrency(analysis.currentPrice)}
                                    </label>
                                    <div className="flex gap-4 items-center">
                                        <input
                                            type="range"
                                            min="1"
                                            max={Math.floor(analysis.quantity)}
                                            value={Math.min(sellQty, analysis.quantity)}
                                            onChange={e => setSellQty(parseInt(e.target.value))}
                                            className="flex-1"
                                        />
                                        <input
                                            type="number"
                                            value={sellQty}
                                            onChange={e => setSellQty(parseInt(e.target.value) || 0)}
                                            className="w-24 px-3 py-1 border rounded text-black"
                                        />
                                    </div>
                                </div>
                            )}
                            {simType === 'price' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Si el precio cambia un {priceChange}%
                                    </label>
                                    <input
                                        type="range"
                                        min="-50"
                                        max="100"
                                        value={priceChange}
                                        onChange={e => setPriceChange(parseInt(e.target.value))}
                                        className="w-full"
                                    />
                                    <div className="text-right mt-1">{priceChange}%</div>
                                </div>
                            )}
                            <button onClick={runSimulation} className="mt-4 w-full py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
                                Simular
                            </button>
                        </div>

                        {simulation && (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                <MetricCard label="Nuevo Precio Medio" value={formatCurrency(simulation.newAveragePrice)} />
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
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-white dark:bg-gray-900 w-full max-w-6xl max-h-[90vh] rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex justify-between items-start bg-gray-50 dark:bg-gray-900/50">
                    <div>
                        <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 bg-clip-text text-transparent">
                            Análisis: {ticker}
                        </h2>
                        <p className="text-gray-500 text-sm mt-1">
                            {companyName} • Actualizado: {analysis ? new Date(analysis.calculatedAt).toLocaleString() : '...'}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleRefresh}
                            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-400 hover:text-blue-500"
                            title="Refrescar datos (Yahoo Finance)"
                        >
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-medium hidden md:block">Refrescar</span>
                                <Activity size={18} className={loading && analysis ? "animate-spin" : ""} />
                            </div>
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-400 hover:text-gray-900 dark:hover:text-white"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200 dark:border-gray-800 overflow-x-auto">
                    {[
                        { id: 'overview', label: 'Resumen', icon: Activity },
                        { id: 'fundamental', label: 'Fundamental', icon: BarChart2 },
                        { id: 'technical', label: 'Técnico', icon: TrendingUp },
                        { id: 'risk', label: 'Riesgo', icon: AlertTriangle },
                        { id: 'analysts', label: 'Analistas', icon: PieChart },
                        { id: 'calendar', label: 'Calendario', icon: Calendar },
                        { id: 'whatif', label: 'Simular', icon: DollarSign },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors border-b-2 whitespace-nowrap flex-1 justify-center ${activeTab === tab.id
                                ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/5'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/50'
                                }`}
                        >
                            <tab.icon size={16} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700 scrollbar-track-transparent">
                    {renderContent()}
                </div>
            </div>

            {/* Global Mouse-Following Tooltip */}
            {/* Global Mouse-Following Tooltip */}
            <MouseTooltip data={activeTooltip} />
        </div>
    );
};

export default PositionAnalysisModal;
