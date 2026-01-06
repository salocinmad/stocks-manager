import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, TrendingUp, Activity, AlertTriangle, DollarSign, PieChart, BarChart2, Info, Calendar, Download, ExternalLink, Loader2, Layers, Users } from 'lucide-react';
import { createChart, IChartApi, ColorType } from 'lightweight-charts';

// Interfaces match PositionAnalysis
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
    grossMargins: number;
    ebitdaMargins: number;
    returnOnEquity: number;
    returnOnAssets: number;
    revenueGrowth: number;
    earningsGrowth: number;
    totalRevenue: number;
    ebitda: number;
    totalCash: number;
    totalDebt: number;
    debtToEquity: number;
    currentRatio: number;
    quickRatio: number;
    freeCashflow: number;
    operatingCashflow: number;
    trailingEps: number;
    forwardEps: number;
    bookValue: number;
    revenuePerShare: number;
    totalCashPerShare: number;
    dividendRate: number;
    dividendYield: number;
    payoutRatio: number;
    exDividendDate: string;
    heldPercentInstitutions: number;
    heldPercentInsiders: number;
    shortRatio: number;
}

interface CompanyEvent {
    id: string;
    date: string;
    type: 'EARNINGS_RELEASE' | 'EARNINGS_CALL' | 'DIVIDEND' | 'SPLIT' | 'OTHER';
    title: string;
    description: string;
    isConfirmed: boolean;
}

interface TickerAnalysis {
    ticker: string;
    currentPrice: number;
    currency: string;
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
        fiftyTwoWeekHigh?: number | null;
        fiftyTwoWeekLow?: number | null;
        shortRatio?: number | null;
        shortPercentFloat?: number | null;
        solvency: {
            zScore: number;
            zone: 'SAFE' | 'GREY' | 'DISTRESS';
            label: string;
        } | null;
    };
    // V10: Governance Risk Scores
    governance?: {
        auditRisk: number | null;
        boardRisk: number | null;
        compensationRisk: number | null;
        shareholderRightsRisk: number | null;
        overallRisk: number | null;
    } | null;
    // V10: Dividend Data
    dividends?: {
        rate: number;
        yield: number;
        exDate: string | null;
        payoutRatio: number;
        trailingAnnualRate: number;
        trailingAnnualYield: number;
    };
    // V10: Calendar Events
    calendar?: {
        earningsDate: string | null;
        epsEstimate: number | null;
        epsLow: number | null;
        epsHigh: number | null;
        revenueEstimate: number | null;
        dividendDate: string | null;
        exDividendDate: string | null;
    };
    analysts: {
        consensus: string | null;
        targetPrice: number | null;
        currentPrice: number;
        targetUpside: string | null;
        numberOfAnalysts: number | null;
        targetHigh?: number | null;
        targetLow?: number | null;
        targetMedian?: number | null;
        recommendationKey?: string | null;
        recommendationMean?: number | null;
        breakdown: {
            strongBuy: number;
            buy: number;
            hold: number;
            sell: number;
            strongSell: number;
        } | null;
        // V10: Trend history (last 4 months)
        trendHistory?: {
            period: string;
            strongBuy: number;
            buy: number;
            hold: number;
            sell: number;
            strongSell: number;
        }[];
        insiderSentiment: {
            mspr: number;
            label: string;
        } | null;
    };
    // V10: EPS History & Projections
    earnings?: {
        trailing: number | null;
        forward: number | null;
        quarterlyGrowth: number | null;
        history: {
            quarter: string;
            actual: number;
            estimate: number;
            surprise: number;
            surprisePct: number;
        }[];
        projections: {
            period: string;
            endDate: string;
            growth: number;
            epsAvg: number | null;
            revenueAvg: number | null;
        }[];
    };
    // V10: Financial Health
    financialHealth?: {
        totalCash: number | null;
        totalDebt: number | null;
        debtToEquity: number | null;
        currentRatio: number | null;
        quickRatio: number | null;
        freeCashflow: number | null;
        grossMargins: number | null;
        profitMargins: number | null;
        revenueGrowth: number | null;
        earningsGrowth: number | null;
        returnOnEquity: number | null;
    };
    fundamentals?: FundamentalData;
    sector: string;
    industry: string;
    calendarEvents?: CompanyEvent[];
    calculatedAt: string;
    // Normalized Fields (v2.3.0)
    targetPrice?: number;
    recommendationKey?: string;
    fairValue?: number; // Graham Number
}

interface DiscoveryAnalysisModalProps {
    isOpen: boolean;
    onClose: () => void;
    ticker: string;
    companyName?: string;
}

export const DiscoveryAnalysisModal: React.FC<DiscoveryAnalysisModalProps> = ({ isOpen, onClose, ticker, companyName }) => {
    const { api, appVersion } = useAuth();
    const [analysis, setAnalysis] = useState<TickerAnalysis | null>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'fundamental' | 'technical' | 'analysts' | 'risk' | 'calendar' | 'all_data'>('overview');
    const [historyRange, setHistoryRange] = useState<'30d' | '60d' | '6m'>('30d');
    const [historyLoading, setHistoryLoading] = useState(false);

    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);

    const fetchAnalysis = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data } = await api.get(`/analysis/ticker/${ticker}`);
            if (data.error) throw new Error(data.error);
            setAnalysis(data);
        } catch (e: any) {
            setError(e.response?.data?.error || e.message || 'Error loading analysis');
        } finally {
            setLoading(false);
        }
    }, [ticker, api]);

    const fetchHistory = useCallback(async (range: string) => {
        setHistoryLoading(true);
        try {
            const { data } = await api.get(`/analysis/ticker/${ticker}/history?range=${range}`);
            if (Array.isArray(data)) {
                setHistory(data);
            }
        } catch (e) {
            console.error('Error fetching history:', e);
        } finally {
            setHistoryLoading(false);
        }
    }, [ticker, api]);

    useEffect(() => {
        if (isOpen && ticker) {
            fetchAnalysis();
            fetchHistory(historyRange);
        }
    }, [isOpen, ticker, fetchAnalysis, fetchHistory, historyRange]);

    useEffect(() => {
        if (!isOpen) {
            if (chartRef.current) {
                chartRef.current.remove();
                chartRef.current = null;
            }
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen || !chartContainerRef.current || history.length === 0 || activeTab !== 'overview') {
            if (chartRef.current) {
                chartRef.current.remove();
                chartRef.current = null;
            }
            return;
        }

        // Clean previous chart
        if (chartRef.current) {
            chartRef.current.remove();
            chartRef.current = null;
        }

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
            height: 300,
            timeScale: {
                borderColor: isDark ? '#374151' : '#e5e7eb',
                timeVisible: true,
            },
            rightPriceScale: {
                borderColor: isDark ? '#374151' : '#e5e7eb',
            },
        });

        const candlestickSeries = chart.addCandlestickSeries({
            upColor: '#10B981',
            downColor: '#EF4444',
            borderVisible: false,
            wickUpColor: '#10B981',
            wickDownColor: '#EF4444',
        });

        const formattedData = history.map((h: any) => ({
            time: new Date(h.date).toISOString().split('T')[0],
            open: Number(h.open),
            high: Number(h.high),
            low: Number(h.low),
            close: Number(h.close),
        })).sort((a, b) => a.time.localeCompare(b.time));

        candlestickSeries.setData(formattedData);
        chart.timeScale().fitContent();

        chartRef.current = chart;

        const handleResize = () => {
            if (chartContainerRef.current && chartRef.current) {
                chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
            }
        };

        const resizeObserver = new ResizeObserver((entries) => {
            // Check if we have dimension
            for (let entry of entries) {
                if (entry.contentRect.width > 0) {
                    setTimeout(handleResize, 50);
                }
            }
        });
        resizeObserver.observe(chartContainerRef.current);

        return () => {
            resizeObserver.disconnect();
            if (chartRef.current) {
                chartRef.current.remove();
                chartRef.current = null;
            }
        };
    }, [history, activeTab, isOpen, historyLoading]);

    if (!isOpen) return null;

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

    // Comprehensive tooltip dictionary for all financial metrics
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
        'Beta': 'Sensibilidad al mercado. >1 más volátil que el mercado, <1 menos volátil.',
        'Enterprise Value': 'Valor total de la empresa incluyendo deuda. Útil para comparar empresas.',
        'EV/Revenue': 'Enterprise Value sobre ingresos. Útil para empresas sin beneficios.',
        'EV/EBITDA': 'Enterprise Value sobre EBITDA. Menor = más barato. <10 suele ser atractivo.',
        '52s Max': 'Precio máximo alcanzado en las últimas 52 semanas.',
        '52s Min': 'Precio mínimo alcanzado en las últimas 52 semanas.',
        '52s Máx/Mín': 'Rango de precios máximo y mínimo en las últimas 52 semanas.',
        'SMA50': 'Media móvil simple de 50 días. Precio por encima = tendencia alcista.',
        'SMA200': 'Media móvil simple de 200 días. Referencia de tendencia a largo plazo.',

        // Analysts
        'Analistas': 'Número de analistas que cubren esta acción y su consenso.',
        'Target Analistas': 'Precio objetivo promedio de los analistas.',
        'Precio Objetivo': 'Precio objetivo promedio según analistas.',
        'Objetivo Alto': 'Precio objetivo más alto entre los analistas.',
        'Objetivo Bajo': 'Precio objetivo más bajo entre los analistas.',
        'Objetivo Mediana': 'Precio objetivo mediana de los analistas.',
        'Upside': 'Potencial de revalorización según el precio objetivo vs precio actual.',
        'Nº Analistas': 'Cantidad de analistas que cubren esta acción.',
        'Score Recomendación': 'Puntuación media de recomendación. 1=Strong Buy, 5=Strong Sell.',
        'Consenso': 'Recomendación consensuada de los analistas (buy, hold, sell).',
        'Strong Buy': 'Analistas con recomendación de compra fuerte.',
        'Buy': 'Analistas con recomendación de compra.',
        'Hold': 'Analistas con recomendación de mantener.',
        'Sell': 'Analistas con recomendación de venta.',
        'Strong Sell': 'Analistas con recomendación de venta fuerte.',

        // Dividends
        'Dividendo Anual': 'Rendimiento del dividendo anual como porcentaje del precio.',
        'Rentabilidad': 'Yield del dividendo: dividendo anual / precio de la acción.',
        'Payout Ratio': 'Porcentaje de beneficios destinados a dividendos. >80% puede ser insostenible.',
        'Fecha Ex-Dividendo': 'Fecha límite para comprar y recibir el próximo dividendo.',
        '5Y Avg Yield': 'Yield promedio de dividendos en los últimos 5 años.',

        // Calendar & Earnings
        'Próximos Resultados': 'Fecha de publicación del próximo informe de resultados.',
        'Próximo Dividendo': 'Información sobre el próximo pago de dividendo.',
        'EPS Estimado': 'Beneficio por acción estimado por analistas.',
        'EPS Bajo': 'Estimación más baja de EPS entre los analistas.',
        'EPS Alto': 'Estimación más alta de EPS entre los analistas.',
        'Ingreso Est.': 'Ingresos estimados para el próximo trimestre.',
        'Ingresos Estimados': 'Ingresos estimados por analistas para el trimestre.',
        'EPS Trailing': 'Beneficio por acción de los últimos 12 meses.',
        'EPS Forward': 'Beneficio por acción estimado para los próximos 12 meses.',
        'Crecimiento Q/Q': 'Crecimiento de beneficios trimestre vs trimestre anterior.',
        'Crec. Q/Q': 'Crecimiento de EPS respecto al trimestre anterior.',

        // Profitability
        'Margen Bruto': 'Porcentaje de ingresos que queda tras costes directos.',
        'Margen EBITDA': 'EBITDA como porcentaje de ingresos. Mayor = más rentable operativamente.',
        'Margen Neto': 'Beneficio neto como porcentaje de ingresos. Mayor = más rentable.',
        'Margen Operativo': 'Beneficio operativo como porcentaje de ingresos.',
        'Op. Margin': 'Margen operativo: beneficio antes de intereses e impuestos / ingresos.',
        'ROE': 'Return on Equity: beneficio neto / patrimonio. >15% suele ser bueno.',
        'ROA': 'Return on Assets: beneficio neto / activos totales.',

        // Financial Health
        'Ingresos Totales': 'Ventas totales de la empresa en el último año.',
        'EBITDA': 'Beneficio antes de intereses, impuestos, depreciación y amortización.',
        'Beneficio Bruto': 'Ingresos menos coste de bienes vendidos.',
        'Free Cash Flow': 'Flujo de caja libre: efectivo disponible tras inversiones.',
        'FCF': 'Flujo de caja libre. Positivo = genera efectivo para accionistas/deuda.',
        'Caja Total': 'Efectivo y equivalentes disponibles.',
        'Deuda Total': 'Total de deuda financiera de la empresa.',
        'Deuda/Capital': 'Ratio deuda/patrimonio. >100 indica alta apalancamiento.',
        'Ratio Liquidez': 'Activo corriente / pasivo corriente. >1.5 = buena liquidez.',
        'Quick Ratio': 'Ratio rápido: (activo corriente - inventario) / pasivo corriente.',
        'Crec. Ingresos': 'Crecimiento de ingresos año sobre año.',
        'Crecimiento Ingresos': 'Tasa de crecimiento de ingresos interanual.',
        'Crecimiento EPS': 'Tasa de crecimiento de beneficios por acción.',

        // Risk Metrics
        'Score Riesgo': 'Puntuación de riesgo global. 1-3 bajo, 4-6 moderado, 7-10 alto.',
        'Volatilidad Anual': 'Desviación estándar anualizada de retornos. Mayor = más riesgo.',
        'Sharpe Ratio': 'Retorno ajustado al riesgo. >1 bueno, >2 muy bueno.',
        'Sortino Ratio': 'Similar a Sharpe pero solo penaliza volatilidad negativa.',
        'Max Drawdown': 'Máxima caída desde un pico. Indica el peor escenario histórico.',
        'VaR 95%': 'Value at Risk: máxima pérdida esperada con 95% de confianza en un día.',
        'Short % Float': 'Porcentaje de acciones vendidas en corto. >20% = alto interés bajista.',
        'Altman Z-Score': 'Predictor de quiebra. >3 seguro, 1.8-3 gris, <1.8 riesgo.',
        'Zona Solvencia': 'Clasificación de solvencia basada en Z-Score de Altman.',
        '52s Máximo': 'Precio máximo en las últimas 52 semanas.',
        '52s Mínimo': 'Precio mínimo en las últimas 52 semanas.',

        // Governance
        'Riesgo Auditoría': 'Riesgo relacionado con prácticas de auditoría. Menor = mejor.',
        'Riesgo Junta': 'Riesgo relacionado con la composición del consejo. Menor = mejor.',
        'Riesgo Compensación': 'Riesgo por prácticas de compensación ejecutiva. Menor = mejor.',
        'Riesgo Accionistas': 'Riesgo relacionado con derechos de accionistas. Menor = mejor.',
        'Riesgo General': 'Puntuación global de riesgo de gobernanza. 1-3 bajo, 4-6 medio, 7-10 alto.',

        // Technical
        'Estado de Valoración': 'Comparación del precio actual con el objetivo de los analistas.',
        'Riesgo Solvencia': 'Evaluación del riesgo de quiebra usando Altman Z-Score.',
        'Gráfico de Velas': 'Visualización del precio con velas japonesas.',

        // Technical Indicators
        'RSI': 'Índice de fuerza relativa. >70 sobrecompra, <30 sobreventa.',
        'RSI (14)': 'RSI de 14 períodos. >70 sobrecompra, <30 sobreventa.',
        'SMA 50': 'Media móvil simple de 50 días.',
        'SMA 200': 'Media móvil simple de 200 días.',
        'RSI Variación': 'Cambio del RSI respecto al día anterior.',
        'Tendencia': 'Dirección del precio basado en medias móviles.',
        'MACD': 'Convergencia/divergencia de medias móviles. Indicador de momentum.',
        'Señal': 'Línea de señal del MACD.',
        'Histograma': 'Diferencia entre MACD y su señal.',

        // Balance Sheet
        'Total Assets': 'Activos totales de la empresa.',
        'Total Liabilities': 'Pasivos totales de la empresa.',
        'Shareholders Equity': 'Patrimonio neto atribuible a accionistas.',
        'Working Capital': 'Capital de trabajo: activo corriente - pasivo corriente.',
        'Book Value': 'Valor contable por acción.',
        'Book Value per Share': 'Patrimonio neto dividido entre acciones en circulación.',

        // Income Statement
        'Revenue': 'Ingresos totales por ventas.',
        'Net Income': 'Beneficio neto después de impuestos.',
        'Operating Income': 'Beneficio operativo antes de intereses e impuestos.',
        'Gross Profit': 'Beneficio bruto: ingresos - coste de ventas.',

        // Cash Flow
        'Operating Cash Flow': 'Efectivo generado por operaciones del negocio.',
        'Investing Cash Flow': 'Efectivo usado en inversiones (CAPEX, adquisiciones).',
        'Financing Cash Flow': 'Efectivo de actividades de financiación (deuda, dividendos).',

        // Ratios adicionales
        'P/E Trailing': 'Precio/Beneficio de los últimos 12 meses.',
        'P/E Forward': 'Precio/Beneficio estimado para los próximos 12 meses.',
        'Dividend Rate': 'Dividendo anual por acción en valor absoluto.',
        'Dividend Yield': 'Rentabilidad del dividendo: dividendo anual / precio.',
        'Payout': 'Porcentaje de beneficios distribuidos como dividendos.',
        'Rango EPS': 'Rango de estimaciones de EPS (bajo - alto).',
        'Fecha Pago': 'Fecha en que se abonará el dividendo.',
        'Ex-Dividendo': 'Fecha límite para recibir el dividendo.',
        'Trimestre': 'Período trimestral del reporte.',
        'Real': 'EPS real reportado por la empresa.',
        'Estimado': 'EPS esperado por los analistas.',
        'Sorpresa': 'Diferencia entre EPS real y estimado.',
    };

    // Get tooltip for a label
    const getTooltip = (label: string): string | undefined => tooltips[label];

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

    const getCalculatedMetrics = (f: FundamentalData) => {
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

    const renderContent = () => {
        if (loading) return <div className="flex flex-col justify-center items-center h-96 gap-4"><Loader2 className="w-10 h-10 text-primary animate-spin" /><p className="text-gray-500 animate-pulse font-bold tracking-widest uppercase text-xs">Analizando {ticker}...</p></div>;
        if (error) return <div className="text-center py-20 px-6"><div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4"><AlertTriangle className="text-red-500 w-8 h-8" /></div><p className="text-red-500 font-bold mb-6">{error}</p><button onClick={fetchAnalysis} className="px-6 py-2 bg-primary text-black rounded-xl font-bold hover:bg-primary/80 transition-all uppercase tracking-widest text-xs">Reintentar</button></div>;
        if (!analysis) return null;

        const { fundamentals: f } = analysis;
        const calc = f ? getCalculatedMetrics(f) : null;

        switch (activeTab) {
            case 'overview':
                const div = (analysis as any).dividends;
                const cal = (analysis as any).calendar;
                const gov = (analysis as any).governance;
                const fh = (analysis as any).financialHealth;
                const val = (analysis as any).valuation;
                const earn = (analysis as any).earnings;

                // Days until next earnings
                const daysToEarnings = cal?.earningsDate
                    ? Math.ceil((new Date(cal.earningsDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                    : null;

                return (
                    <div className="space-y-5 animate-fadeIn">
                        {/* Row 1: Price, Risk, Sector */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-gray-100 dark:bg-gray-800 p-5 rounded-[2rem] border border-gray-200 dark:border-gray-700 shadow-sm">
                                <div className="text-gray-500 dark:text-gray-400 text-xs mb-1 uppercase font-bold tracking-wider">Precio Actual</div>
                                <div className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter">{formatCurrency(analysis.currentPrice)}</div>
                                <div className="text-[10px] text-gray-500 font-bold uppercase mt-1">Calculado: {new Date(analysis.calculatedAt).toLocaleTimeString()}</div>
                            </div>
                            <div className="bg-gray-100 dark:bg-gray-800 p-5 rounded-[2rem] border border-gray-200 dark:border-gray-700 shadow-sm">
                                <div className="text-gray-500 dark:text-gray-400 text-xs mb-1 uppercase font-bold tracking-wider">Riesgo Precio</div>
                                <div className="flex items-center gap-4">
                                    <span className="text-3xl font-black tracking-tighter">{analysis.risk.score}/10</span>
                                    <div className="flex-1 h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden shadow-inner">
                                        <div className={`h-full transition-all duration-1000 ${analysis.risk.score < 4 ? 'bg-green-500' : analysis.risk.score < 7 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${analysis.risk.score * 10}%` }}></div>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-primary/10 p-5 rounded-[2rem] border border-primary/20 shadow-sm">
                                <div className="text-primary text-xs font-black mb-1 uppercase tracking-widest flex items-center gap-2"><PieChart size={14} /> Sector</div>
                                <div className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter truncate">{analysis.sector}</div>
                                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider truncate">{analysis.industry}</div>
                            </div>
                        </div>

                        {/* Row 2: Market Cap, Analysts, Dividends */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            <MetricCard label="Market Cap" value={val?.marketCap ? formatLargeNumber(val.marketCap) : f?.marketCap ? formatLargeNumber(f.marketCap) : 'N/A'} />
                            <MetricCard label="Analistas" value={analysis.analysts?.numberOfAnalysts || 0} subtext={analysis.recommendationKey || analysis.analysts?.recommendationKey || analysis.analysts?.consensus || 'N/A'} />
                            <MetricCard label="Target Price" value={analysis.targetPrice ? formatCurrency(analysis.targetPrice) : (analysis.analysts?.targetPrice ? formatCurrency(analysis.analysts.targetPrice) : 'N/A')} subtext="Consenso" tooltip="Precio Objetivo Medio de Analistas" />
                            <MetricCard label="Dividendo Anual" value={div?.yield ? (div.yield * 100).toFixed(2) + '%' : 'N/A'} subtext={div?.rate ? `€${div.rate.toFixed(2)}/acc` : 'Sin dividendo'} color={div?.yield > 0.03 ? 'text-green-500' : ''} />
                            <MetricCard label="PER Forward" value={val?.peForward ? formatNumber(val.peForward) + 'x' : f?.forwardPE ? formatNumber(f.forwardPE) + 'x' : 'N/A'} />
                        </div>

                        {/* Row 3: Valuation + Solvency */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Col 1: Fair Value (Graham) */}
                            <div className="bg-purple-50 dark:bg-purple-900/10 p-5 rounded-[2rem] border border-purple-100 dark:border-purple-900/30">
                                <div className="text-purple-500 dark:text-purple-400 text-xs font-bold mb-2 flex items-center gap-2 uppercase tracking-widest">
                                    <Activity size={14} /> Valoración Fundamental
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <MetricCard
                                        label="Fair Value (Graham)"
                                        value={analysis.fairValue ? formatCurrency(analysis.fairValue) : (calc?.grahamNumber ? formatCurrency(calc.grahamNumber) : 'N/A')}
                                        subtext={analysis.fairValue && analysis.currentPrice < analysis.fairValue ? 'Infravalorada' : (analysis.fairValue ? 'Sobrevalorada' : '')}
                                        color={analysis.fairValue && analysis.currentPrice < analysis.fairValue ? 'text-green-500' : 'text-red-500'}
                                        tooltip="Valor intrínseco estimado según la fórmula de Benjamin Graham: √(22.5 × EPS × Book Value)."
                                    />
                                    <div className="flex flex-col justify-center bg-white dark:bg-black/20 p-3 rounded-xl border border-purple-100 dark:border-purple-900/50">
                                        <div className="text-[10px] text-gray-400 font-bold uppercase mb-1">Potencial (Graham)</div>
                                        <div className={`text-2xl font-black ${analysis.fairValue && analysis.currentPrice < analysis.fairValue ? 'text-green-500' : 'text-red-500'}`}>
                                            {analysis.fairValue ? (
                                                ((analysis.fairValue - analysis.currentPrice) / analysis.currentPrice * 100).toFixed(2) + '%'
                                            ) : 'N/A'}
                                        </div>
                                        <div className="text-[10px] text-gray-500 font-bold uppercase mt-1">vs Precio Actual</div>
                                    </div>
                                </div>
                            </div>

                            {/* Col 2: Solvency (Original) */}
                            <div className="bg-gray-100 dark:bg-gray-800/50 p-5 rounded-[2rem] border border-gray-200 dark:border-gray-700">
                                <div className="flex justify-between items-center mb-2">
                                    <div className="text-gray-500 text-xs font-bold flex items-center gap-2 uppercase tracking-widest"><AlertTriangle size={14} className="text-yellow-500" /> Riesgo Solvencia</div>
                                    {analysis.risk.solvency && (
                                        <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter ${analysis.risk.solvency.zone === 'SAFE' ? 'bg-green-100 text-green-700' : analysis.risk.solvency.zone === 'GREY' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                            {analysis.risk.solvency.label}
                                        </span>
                                    )}
                                </div>
                                <div className="text-xl font-black tracking-tighter">Altman Z-Score: {analysis.risk.solvency?.zScore || 'N/A'}</div>
                                <p className="text-[10px] text-gray-500 font-bold uppercase mt-1 leading-relaxed">{analysis.risk.solvency?.zone === 'SAFE' ? 'Bajo riesgo de quiebra' : 'Riesgo financiero elevado'}</p>
                            </div>
                        </div>

                        {/* Row 4: Next Earnings + Governance Quick View */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Next Earnings */}
                            {cal?.earningsDate && (
                                <div className="bg-blue-50/50 dark:bg-blue-900/10 p-5 rounded-[2rem] border border-blue-200/50 dark:border-blue-900/30 flex items-center justify-between">
                                    <div>
                                        <div className="text-blue-500 text-xs font-black uppercase tracking-widest flex items-center gap-2 mb-1"><Calendar size={14} /> Próximos Resultados</div>
                                        <div className="font-black text-gray-900 dark:text-white">{new Date(cal.earningsDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                                        {cal.epsEstimate && <div className="text-[10px] text-gray-500 font-bold">EPS est: ${formatNumber(cal.epsEstimate)}</div>}
                                    </div>
                                    {daysToEarnings !== null && daysToEarnings > 0 && (
                                        <div className="text-center bg-blue-500/20 px-4 py-2 rounded-2xl">
                                            <div className="text-2xl font-black text-blue-500">{daysToEarnings}</div>
                                            <div className="text-[10px] font-bold text-blue-400 uppercase">días</div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Governance Quick View */}
                            {gov && (
                                <div className="bg-orange-50/50 dark:bg-orange-900/10 p-5 rounded-[2rem] border border-orange-200/50 dark:border-orange-900/30">
                                    <div className="text-orange-500 text-xs font-black uppercase tracking-widest flex items-center gap-2 mb-2"><AlertTriangle size={14} /> Gobernanza Corporativa</div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex gap-2 items-center">
                                            <span className="text-[10px] text-gray-500 font-bold uppercase">Riesgo General:</span>
                                            <span className={`text-lg font-black ${(gov.overallRisk || 0) <= 3 ? 'text-green-500' : (gov.overallRisk || 0) <= 6 ? 'text-yellow-500' : 'text-red-500'}`}>
                                                {gov.overallRisk ?? 'N/A'}/10
                                            </span>
                                        </div>
                                        <div className="text-[10px] text-gray-400 font-bold">Ver más en pestaña Riesgo</div>
                                    </div>
                                </div>
                            )}

                            {/* Fallback if no calendar but no governance */}
                            {!cal?.earningsDate && !gov && (
                                <div className="md:col-span-2 bg-gray-100 dark:bg-gray-800/30 p-5 rounded-[2rem] border border-gray-200 dark:border-gray-700 text-center text-gray-400 italic text-xs font-bold uppercase">
                                    Sin datos adicionales de calendario o gobernanza para este ticker
                                </div>
                            )}
                        </div>

                        {/* Row 5: Financial Health Quick Stats */}
                        {fh && (fh.profitMargins || fh.debtToEquity || fh.currentRatio) && (
                            <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
                                {fh.profitMargins && <MetricCard label="Margen Neto" value={(fh.profitMargins * 100).toFixed(1) + '%'} color={fh.profitMargins > 0.1 ? 'text-green-500' : fh.profitMargins < 0 ? 'text-red-500' : ''} />}
                                {fh.revenueGrowth && <MetricCard label="Crec. Ingresos" value={(fh.revenueGrowth * 100).toFixed(1) + '%'} color={fh.revenueGrowth > 0 ? 'text-green-500' : 'text-red-500'} />}
                                {fh.debtToEquity && <MetricCard label="Deuda/Capital" value={fh.debtToEquity.toFixed(2)} color={fh.debtToEquity > 150 ? 'text-red-500' : ''} />}
                                {fh.currentRatio && <MetricCard label="Ratio Liquidez" value={fh.currentRatio.toFixed(2)} color={fh.currentRatio > 1.5 ? 'text-green-500' : fh.currentRatio < 1 ? 'text-red-500' : ''} />}
                                {fh.returnOnEquity && <MetricCard label="ROE" value={(fh.returnOnEquity * 100).toFixed(1) + '%'} color={fh.returnOnEquity > 0.15 ? 'text-green-500' : ''} />}
                                {fh.freeCashflow && <MetricCard label="FCF" value={formatLargeNumber(fh.freeCashflow)} color={fh.freeCashflow > 0 ? 'text-green-500' : 'text-red-500'} />}
                            </div>
                        )}

                        {/* Row 6: EPS Quick View */}
                        {earn && (earn.trailing || earn.forward) && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <MetricCard label="EPS Trailing" value={earn.trailing ? '$' + formatNumber(earn.trailing) : 'N/A'} />
                                <MetricCard label="EPS Forward" value={earn.forward ? '$' + formatNumber(earn.forward) : 'N/A'} />
                                {earn.quarterlyGrowth && <MetricCard label="Crec. Q/Q" value={(earn.quarterlyGrowth * 100).toFixed(1) + '%'} color={earn.quarterlyGrowth > 0 ? 'text-green-500' : 'text-red-500'} />}
                                {analysis.risk.fiftyTwoWeekHigh && <MetricCard label="52s Máx/Mín" value={`${formatCurrency(analysis.risk.fiftyTwoWeekHigh)} / ${formatCurrency(analysis.risk.fiftyTwoWeekLow)}`} />}
                            </div>
                        )}

                        {/* Chart */}
                        <div className="bg-gray-50 dark:bg-black/20 p-6 rounded-[2.5rem] border border-gray-200 dark:border-gray-700 shadow-inner">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-sm font-black flex items-center gap-2 uppercase tracking-widest text-gray-900 dark:text-white"><BarChart2 size={18} className="text-primary" /> Gráfico de Velas</h3>
                                <div className="flex gap-1 bg-gray-200 dark:bg-gray-800/80 p-1 rounded-2xl shadow-inner">
                                    {(['30d', '60d', '6m'] as const).map(r => (
                                        <button key={r} onClick={() => setHistoryRange(r)} className={`px-4 py-1.5 text-[10px] font-black rounded-xl transition-all uppercase tracking-widest ${historyRange === r ? 'bg-primary text-black shadow-lg shadow-primary/20' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}>{r}</button>
                                    ))}
                                </div>
                            </div>
                            <div className="relative h-[250px] w-full">
                                {historyLoading && (
                                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/5 backdrop-blur-sm rounded-2xl">
                                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                                    </div>
                                )}
                                <div ref={chartContainerRef} className="w-full h-full"></div>
                            </div>
                        </div>
                    </div>
                );

            case 'fundamental':
                if (!f || !calc) return <div className="text-center py-20 text-gray-400 italic font-bold uppercase tracking-widest text-xs">Datos fundamentales no disponibles</div>;
                return (
                    <div className="space-y-8 animate-fadeIn">
                        <div>
                            <h3 className="text-xs font-black text-primary uppercase mb-4 flex items-center gap-2 tracking-widest"><DollarSign size={14} /> Valoración y Valor Justo</h3>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                <MetricCard label="Target Analistas" value={formatCurrency(analysis.analysts.targetPrice)} subtext={`Upside: ${analysis.analysts.targetUpside}%`} />
                                <MetricCard label="Graham Number" value={formatCurrency(calc.grahamNumber)} color={calc.grahamNumber && analysis.currentPrice < calc.grahamNumber ? 'text-green-500' : ''} />
                                <MetricCard label="P/FCF" value={calc.pFcf ? formatNumber(calc.pFcf) + 'x' : 'N/A'} color={calc.pFcf && calc.pFcf < 15 ? 'text-green-500' : ''} />
                                <MetricCard label="PER (Trailing)" value={formatNumber(f.trailingPE)} />
                                <MetricCard label="Market Cap" value={formatLargeNumber(f.marketCap)} />
                                <MetricCard label="Price / Sales" value={formatNumber(f.priceToSales)} />
                                <MetricCard label="PEG Ratio" value={formatNumber(f.pegRatio)} />
                                <MetricCard label="Price / Book" value={formatNumber(f.priceToBook)} />
                            </div>
                        </div>
                        <div>
                            <h3 className="text-xs font-black text-purple-500 uppercase mb-4 flex items-center gap-2 tracking-widest"><PieChart size={14} /> Rentabilidad</h3>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                <MetricCard label="Margen Bruto" value={formatPercent(f.grossMargins)} />
                                <MetricCard label="Margen EBITDA" value={formatPercent(f.ebitdaMargins)} />
                                <MetricCard label="Margen Neto" value={formatPercent(f.profitMargins)} />
                                <MetricCard label="ROE" value={formatPercent(f.returnOnEquity)} />
                                <MetricCard label="ROA" value={formatPercent(f.returnOnAssets)} />
                                <MetricCard label="Op. Margin" value={formatPercent(f.operatingMargins)} />
                            </div>
                        </div>
                        <div>
                            <h3 className="text-xs font-black text-green-500 uppercase mb-4 flex items-center gap-2 tracking-widest"><TrendingUp size={14} /> Efectivo y Crecimiento</h3>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                <MetricCard label="Free Cash Flow" value={formatLargeNumber(f.freeCashflow)} color="text-emerald-500" />
                                <MetricCard label="Caja Total" value={formatLargeNumber(f.totalCash)} />
                                <MetricCard label="Crecim. Ventas" value={formatPercent(f.revenueGrowth)} />
                                <MetricCard label="Deuda / Equity" value={formatNumber(f.debtToEquity)} />
                                <MetricCard label="Current Ratio" value={formatNumber(f.currentRatio)} />
                                <MetricCard label="Quick Ratio" value={formatNumber(f.quickRatio)} />
                            </div>
                        </div>
                    </div>
                );

            case 'technical':
                const t = analysis.technical;
                return (
                    <div className="space-y-6 animate-fadeIn">
                        <div className="grid grid-cols-2 gap-4">
                            <MetricCard label="RSI (14d)" value={formatNumber(t.rsi)} color={t.rsi && (t.rsi > 70 ? 'text-red-500' : t.rsi < 30 ? 'text-green-500' : 'text-blue-500') || ''} subtext={t.rsi ? (t.rsi > 70 ? 'Sobrecompra' : t.rsi < 30 ? 'Sobreventa' : 'Neutral') : ''} />
                            <MetricCard label="Tendencia" value={t.trend} color={t.trend.includes('ALCISTA') ? 'text-green-500' : t.trend.includes('BAJISTA') ? 'text-red-500' : ''} />
                        </div>
                        <div className="p-6 bg-gray-100 dark:bg-gray-800/30 rounded-[2rem] border border-gray-200 dark:border-gray-700">
                            <h4 className="text-[10px] font-bold uppercase mb-4 text-gray-500 tracking-widest">Promedios Móviles</h4>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl">
                                    <span className="text-xs font-bold uppercase text-gray-400">SMA 50 (Medio Plazo)</span>
                                    <span className={`font-black text-lg ${analysis.currentPrice > (t.sma50 || 0) ? 'text-green-500' : 'text-red-500'}`}>{formatCurrency(t.sma50)}</span>
                                </div>
                                <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl">
                                    <span className="text-xs font-bold uppercase text-gray-400">SMA 200 (Largo Plazo)</span>
                                    <span className={`font-black text-lg ${analysis.currentPrice > (t.sma200 || 0) ? 'text-green-500' : 'text-red-500'}`}>{formatCurrency(t.sma200)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'analysts':
                const a = analysis.analysts;
                return (
                    <div className="space-y-8 animate-fadeIn">
                        {/* Primary Metrics */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <MetricCard label="Consenso" value={a.recommendationKey || a.consensus || 'N/A'} color="text-blue-500" />
                            <MetricCard label="Target Avg" value={formatCurrency(a.targetPrice)} />
                            <MetricCard label="Upside" value={a.targetUpside ? (parseFloat(a.targetUpside) > 0 ? '+' : '') + a.targetUpside + '%' : 'N/A'} color={parseFloat(a.targetUpside || '0') > 0 ? 'text-green-500' : 'text-red-500'} />
                            <MetricCard label="Analistas" value={a.numberOfAnalysts} />
                        </div>

                        {/* V10: Target Price Range */}
                        {(a.targetHigh || a.targetLow) && (
                            <div className="bg-blue-50/50 dark:bg-blue-900/10 p-6 rounded-[2rem] border border-blue-200/50 dark:border-blue-900/30">
                                <h4 className="text-[10px] font-bold uppercase mb-4 text-blue-500 tracking-widest">Rango de Precio Objetivo</h4>
                                <div className="grid grid-cols-3 gap-4 text-center">
                                    <div className="p-4 bg-white/50 dark:bg-black/20 rounded-2xl">
                                        <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Bajo</div>
                                        <div className="text-xl font-black text-red-500">{formatCurrency(a.targetLow)}</div>
                                    </div>
                                    <div className="p-4 bg-white/50 dark:bg-black/20 rounded-2xl border-2 border-blue-300 dark:border-blue-700">
                                        <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Mediana</div>
                                        <div className="text-xl font-black text-blue-500">{formatCurrency(a.targetMedian || a.targetPrice)}</div>
                                    </div>
                                    <div className="p-4 bg-white/50 dark:bg-black/20 rounded-2xl">
                                        <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Alto</div>
                                        <div className="text-xl font-black text-green-500">{formatCurrency(a.targetHigh)}</div>
                                    </div>
                                </div>
                                {a.recommendationMean && (
                                    <div className="mt-4 text-center">
                                        <span className="text-[10px] text-gray-500 font-bold uppercase">Score Recomendación: </span>
                                        <span className={`font-black ${a.recommendationMean <= 2 ? 'text-green-500' : a.recommendationMean <= 3 ? 'text-yellow-500' : 'text-red-500'}`}>
                                            {a.recommendationMean.toFixed(2)} (1=Strong Buy, 5=Strong Sell)
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}

                        {a.breakdown && (
                            <div className="bg-gray-100 dark:bg-gray-800/30 p-8 rounded-[2rem] border border-gray-200 dark:border-gray-700">
                                <h4 className="text-[10px] font-bold uppercase mb-6 text-gray-500 tracking-widest text-center">Distribución de Recomendaciones</h4>
                                <div className="flex h-5 rounded-full overflow-hidden mb-6 shadow-inner">
                                    <div style={{ width: `${(a.breakdown.strongBuy + a.breakdown.buy) / a.numberOfAnalysts! * 100}%` }} className="bg-green-500 transition-all duration-1000 shadow-lg shadow-green-500/20"></div>
                                    <div style={{ width: `${a.breakdown.hold / a.numberOfAnalysts! * 100}%` }} className="bg-yellow-500 transition-all duration-1000 shadow-lg shadow-yellow-500/20"></div>
                                    <div style={{ width: `${(a.breakdown.sell + a.breakdown.strongSell) / a.numberOfAnalysts! * 100}%` }} className="bg-red-500 transition-all duration-1000 shadow-lg shadow-red-500/20"></div>
                                </div>
                                <div className="grid grid-cols-5 text-center text-[10px] font-black tracking-widest">
                                    <div className="text-green-600 uppercase">Strong Buy: {a.breakdown.strongBuy}</div>
                                    <div className="text-green-500 uppercase">Buy: {a.breakdown.buy}</div>
                                    <div className="text-yellow-500 uppercase">Hold: {a.breakdown.hold}</div>
                                    <div className="text-orange-500 uppercase">Sell: {a.breakdown.sell}</div>
                                    <div className="text-red-500 uppercase">Strong Sell: {a.breakdown.strongSell}</div>
                                </div>
                            </div>
                        )}

                        {/* V10: Trend History */}
                        {a.trendHistory && a.trendHistory.length > 1 && (
                            <div className="bg-purple-50/50 dark:bg-purple-900/10 p-6 rounded-[2rem] border border-purple-200/50 dark:border-purple-900/30">
                                <h4 className="text-[10px] font-bold uppercase mb-4 text-purple-500 tracking-widest">Evolución de Recomendaciones (últimos meses)</h4>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="text-[10px] font-bold uppercase text-gray-500 tracking-widest">
                                                <th className="text-left p-2">Mes</th>
                                                <th className="text-center p-2 text-green-600">S.Buy</th>
                                                <th className="text-center p-2 text-green-500">Buy</th>
                                                <th className="text-center p-2 text-yellow-500">Hold</th>
                                                <th className="text-center p-2 text-orange-500">Sell</th>
                                                <th className="text-center p-2 text-red-500">S.Sell</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {a.trendHistory.slice(0, 4).map((trend, idx) => (
                                                <tr key={idx} className="border-t border-gray-200 dark:border-gray-700">
                                                    <td className="p-2 font-bold">{trend.period}</td>
                                                    <td className="p-2 text-center font-black text-green-600">{trend.strongBuy}</td>
                                                    <td className="p-2 text-center font-black text-green-500">{trend.buy}</td>
                                                    <td className="p-2 text-center font-black text-yellow-500">{trend.hold}</td>
                                                    <td className="p-2 text-center font-black text-orange-500">{trend.sell}</td>
                                                    <td className="p-2 text-center font-black text-red-500">{trend.strongSell}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {a.insiderSentiment && (
                            <div className="p-6 bg-gray-100 dark:bg-gray-800/30 rounded-[2rem] border border-gray-200 dark:border-gray-700 flex justify-between items-center">
                                <span className="text-xs font-black uppercase text-gray-500 tracking-widest">Sentimiento Insiders</span>
                                <span className={`text-lg font-black tracking-tight ${a.insiderSentiment.mspr > 0 ? 'text-green-500' : 'text-red-500'}`}>{a.insiderSentiment.label} ({a.insiderSentiment.mspr.toFixed(2)})</span>
                            </div>
                        )}
                    </div>
                );

            case 'risk':
                const r = analysis.risk;
                const g = analysis.governance;
                const getRiskColor = (val: number | null | undefined) => {
                    if (val === null || val === undefined) return 'text-gray-400';
                    if (val <= 3) return 'text-green-500';
                    if (val <= 6) return 'text-yellow-500';
                    return 'text-red-500';
                };
                return (
                    <div className="space-y-8 animate-fadeIn">
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                            <MetricCard label="Volatilidad Anual" value={r.volatility + '%'} />
                            <MetricCard label="Sharpe Ratio" value={r.sharpe} color={r.sharpe > 1.5 ? 'text-green-500' : r.sharpe < 0 ? 'text-red-500' : 'text-blue-500'} />
                            <MetricCard label="Beta vs Mercado" value={r.beta} color={Math.abs(r.beta - 1) > 0.5 ? 'text-yellow-500' : ''} />
                            <MetricCard label="Max Drawdown" value={r.maxDrawdown + '%'} color="text-red-500" />
                            <MetricCard label="VaR (95%)" value={r.var95 + '%'} />
                            <MetricCard label="Sortino Ratio" value={r.sortino} />
                        </div>

                        {/* 52-Week Range & Short Interest */}
                        {(r.fiftyTwoWeekHigh || r.shortRatio) && (
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                {r.fiftyTwoWeekHigh && <MetricCard label="52s Máximo" value={formatCurrency(r.fiftyTwoWeekHigh)} />}
                                {r.fiftyTwoWeekLow && <MetricCard label="52s Mínimo" value={formatCurrency(r.fiftyTwoWeekLow)} />}
                                {r.shortRatio && <MetricCard label="Short Ratio" value={formatNumber(r.shortRatio)} />}
                                {r.shortPercentFloat && <MetricCard label="% Short Float" value={(r.shortPercentFloat * 100).toFixed(2) + '%'} color={r.shortPercentFloat > 0.1 ? 'text-orange-500' : ''} />}
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-gray-100 dark:bg-gray-800/30 p-6 rounded-[2rem] border border-gray-200 dark:border-gray-700">
                                <h4 className="text-[10px] font-bold uppercase mb-2 text-gray-500 tracking-widest">Score de Riesgo</h4>
                                <div className="text-5xl font-black tracking-tighter mb-2">{r.score}/10</div>
                                <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div className={`h-full ${r.score < 4 ? 'bg-green-500' : r.score < 7 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${r.score * 10}%` }}></div>
                                </div>
                                <p className="text-[10px] text-gray-500 font-bold uppercase mt-3">Basado en volatilidad histórica y fundamentos de calidad</p>
                            </div>
                            <div className="bg-gray-100 dark:bg-gray-800/30 p-6 rounded-[2rem] border border-gray-200 dark:border-gray-700">
                                <div className="flex justify-between items-center mb-2">
                                    <h4 className="text-[10px] font-bold uppercase text-gray-500 tracking-widest">Solvencia (Z-Score)</h4>
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${r.solvency?.zone === 'SAFE' ? 'bg-green-500/20 text-green-500' : r.solvency?.zone === 'GREY' ? 'bg-yellow-500/20 text-yellow-500' : 'bg-red-500/20 text-red-500'}`}>{r.solvency?.label}</span>
                                </div>
                                <div className="text-5xl font-black tracking-tighter">{r.solvency?.zScore || 'N/A'}</div>
                                <p className="text-[10px] text-gray-500 font-bold uppercase mt-3">Indicador predictivo de estabilidad financiera a largo plazo</p>
                            </div>
                        </div>

                        {/* V10: Governance Risk Section */}
                        {g && (
                            <div className="bg-orange-50/50 dark:bg-orange-900/10 p-6 rounded-[2rem] border border-orange-200/50 dark:border-orange-900/30">
                                <h3 className="text-xs font-black text-orange-500 uppercase mb-6 flex items-center gap-2 tracking-widest">
                                    <AlertTriangle size={14} /> Riesgo de Gobernanza Corporativa
                                </h3>
                                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                                    <div className="text-center p-4 bg-white/50 dark:bg-black/20 rounded-2xl">
                                        <div className="text-[10px] text-gray-500 font-bold uppercase mb-2">General</div>
                                        <div className={`text-3xl font-black ${getRiskColor(g.overallRisk)}`}>{g.overallRisk ?? 'N/A'}</div>
                                        <div className="text-[10px] text-gray-400 font-bold">/10</div>
                                    </div>
                                    <div className="text-center p-4 bg-white/50 dark:bg-black/20 rounded-2xl">
                                        <div className="text-[10px] text-gray-500 font-bold uppercase mb-2">Auditoría</div>
                                        <div className={`text-3xl font-black ${getRiskColor(g.auditRisk)}`}>{g.auditRisk ?? 'N/A'}</div>
                                        <div className="text-[10px] text-gray-400 font-bold">/10</div>
                                    </div>
                                    <div className="text-center p-4 bg-white/50 dark:bg-black/20 rounded-2xl">
                                        <div className="text-[10px] text-gray-500 font-bold uppercase mb-2">Consejo</div>
                                        <div className={`text-3xl font-black ${getRiskColor(g.boardRisk)}`}>{g.boardRisk ?? 'N/A'}</div>
                                        <div className="text-[10px] text-gray-400 font-bold">/10</div>
                                    </div>
                                    <div className="text-center p-4 bg-white/50 dark:bg-black/20 rounded-2xl">
                                        <div className="text-[10px] text-gray-500 font-bold uppercase mb-2">Compensación</div>
                                        <div className={`text-3xl font-black ${getRiskColor(g.compensationRisk)}`}>{g.compensationRisk ?? 'N/A'}</div>
                                        <div className="text-[10px] text-gray-400 font-bold">/10</div>
                                    </div>
                                    <div className="text-center p-4 bg-white/50 dark:bg-black/20 rounded-2xl">
                                        <div className="text-[10px] text-gray-500 font-bold uppercase mb-2">Accionistas</div>
                                        <div className={`text-3xl font-black ${getRiskColor(g.shareholderRightsRisk)}`}>{g.shareholderRightsRisk ?? 'N/A'}</div>
                                        <div className="text-[10px] text-gray-400 font-bold">/10</div>
                                    </div>
                                </div>
                                <p className="text-[10px] text-gray-500 font-bold uppercase mt-4 text-center">Menor valor = Menor riesgo • Datos de Yahoo Finance ESG</p>
                            </div>
                        )}
                    </div>
                );

            case 'calendar':
                const events = analysis.calendarEvents || [];
                const calData = analysis.calendar;
                const earnData = analysis.earnings;

                // Calculate days until event
                const getDaysUntil = (dateStr: string | null | undefined) => {
                    if (!dateStr) return null;
                    const diff = (new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
                    return Math.ceil(diff);
                };

                const earningsDays = getDaysUntil(calData?.earningsDate);
                const dividendDays = getDaysUntil(calData?.dividendDate);

                return (
                    <div className="space-y-6 animate-fadeIn">
                        {/* V10: Next Earnings Event */}
                        {calData?.earningsDate && (
                            <div className="bg-blue-50/50 dark:bg-blue-900/10 p-6 rounded-[2rem] border border-blue-200/50 dark:border-blue-900/30">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="text-xs font-black text-blue-500 uppercase mb-2 flex items-center gap-2 tracking-widest">
                                            <Calendar size={14} /> Próximos Resultados
                                        </h3>
                                        <div className="text-2xl font-black text-gray-900 dark:text-white">
                                            {new Date(calData.earningsDate).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                        </div>
                                    </div>
                                    {earningsDays !== null && earningsDays > 0 && (
                                        <div className="text-center bg-blue-500/20 px-4 py-2 rounded-2xl">
                                            <div className="text-3xl font-black text-blue-500">{earningsDays}</div>
                                            <div className="text-[10px] font-bold text-blue-400 uppercase">días</div>
                                        </div>
                                    )}
                                </div>
                                {(calData.epsEstimate || calData.revenueEstimate) && (
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                                        {calData.epsEstimate && <MetricCard label="EPS Estimado" value={formatNumber(calData.epsEstimate)} color="text-blue-500" />}
                                        {calData.epsLow && calData.epsHigh && <MetricCard label="Rango EPS" value={`${formatNumber(calData.epsLow)} - ${formatNumber(calData.epsHigh)}`} />}
                                        {calData.revenueEstimate && <MetricCard label="Ingreso Est." value={formatLargeNumber(calData.revenueEstimate)} />}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* V10: Dividend Date */}
                        {(calData?.dividendDate || calData?.exDividendDate) && (
                            <div className="bg-green-50/50 dark:bg-green-900/10 p-6 rounded-[2rem] border border-green-200/50 dark:border-green-900/30">
                                <h3 className="text-xs font-black text-green-500 uppercase mb-4 flex items-center gap-2 tracking-widest">
                                    <DollarSign size={14} /> Próximo Dividendo
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {calData.dividendDate && (
                                        <div className="flex justify-between items-center bg-white/50 dark:bg-black/20 p-4 rounded-2xl">
                                            <span className="text-xs font-bold uppercase text-gray-500">Fecha Pago</span>
                                            <span className="font-black text-gray-900 dark:text-white">{new Date(calData.dividendDate).toLocaleDateString('es-ES')}</span>
                                        </div>
                                    )}
                                    {calData.exDividendDate && (
                                        <div className="flex justify-between items-center bg-white/50 dark:bg-black/20 p-4 rounded-2xl">
                                            <span className="text-xs font-bold uppercase text-gray-500">Ex-Dividendo</span>
                                            <span className="font-black text-gray-900 dark:text-white">{new Date(calData.exDividendDate).toLocaleDateString('es-ES')}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* V10: EPS History */}
                        {earnData?.history && earnData.history.length > 0 && (
                            <div className="bg-purple-50/50 dark:bg-purple-900/10 p-6 rounded-[2rem] border border-purple-200/50 dark:border-purple-900/30">
                                <h3 className="text-xs font-black text-purple-500 uppercase mb-4 flex items-center gap-2 tracking-widest">
                                    <BarChart2 size={14} /> Historial EPS (últimos 4 trimestres)
                                </h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-[10px] font-bold uppercase text-gray-500 tracking-widest">
                                                <th className="text-left p-2">Trimestre</th>
                                                <th className="text-right p-2">Real</th>
                                                <th className="text-right p-2">Estimado</th>
                                                <th className="text-right p-2">Sorpresa</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {earnData.history.slice(0, 4).map((h, idx) => (
                                                <tr key={idx} className="border-t border-gray-200 dark:border-gray-700">
                                                    <td className="p-2 font-bold">{h.quarter}</td>
                                                    <td className="p-2 text-right font-black">${formatNumber(h.actual)}</td>
                                                    <td className="p-2 text-right text-gray-500">${formatNumber(h.estimate)}</td>
                                                    <td className={`p-2 text-right font-bold ${h.surprisePct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                        {h.surprisePct >= 0 ? '+' : ''}{formatNumber(h.surprisePct)}%
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Legacy Events (if any) */}
                        {events.length > 0 && (
                            <div className="space-y-4">
                                <h3 className="text-xs font-black text-gray-500 uppercase flex items-center gap-2 tracking-widest">
                                    <Calendar size={14} /> Otros Eventos
                                </h3>
                                {events.map((e, idx) => (
                                    <div key={idx} className="bg-gray-100 dark:bg-gray-800/30 p-6 rounded-[2rem] flex justify-between items-center border border-gray-200 dark:border-gray-700 hover:border-primary/50 transition-all group">
                                        <div className="flex items-center gap-5">
                                            <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                                <Calendar size={24} />
                                            </div>
                                            <div>
                                                <div className="text-[10px] text-gray-500 font-bold uppercase mb-1 tracking-widest">{new Date(e.date).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} • {e.isConfirmed ? 'CONFIRMADO' : 'ESTIMADO'}</div>
                                                <div className="font-black text-lg text-gray-900 dark:text-white uppercase tracking-tighter leading-none">{e.title}</div>
                                                <div className="text-xs text-gray-500 font-medium mt-1">{e.description}</div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button className="p-3 text-gray-500 hover:text-primary hover:bg-primary/10 rounded-xl transition-all"><ExternalLink size={20} /></button>
                                            <button className="p-3 text-gray-500 hover:text-green-500 hover:bg-green-500/10 rounded-xl transition-all"><Download size={20} /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* No data fallback */}
                        {!calData?.earningsDate && !calData?.dividendDate && events.length === 0 && (
                            <div className="text-center py-20 text-gray-400 italic font-bold uppercase tracking-widest text-xs">No hay eventos próximos registrados.</div>
                        )}
                    </div>
                );
            case 'all_data':
                // Get all V10 data sections
                const allGov = (analysis as any).governance;
                const allDiv = (analysis as any).dividends;
                const allCal = (analysis as any).calendar;
                const allEarn = (analysis as any).earnings;
                const allFh = (analysis as any).financialHealth;
                const allVal = (analysis as any).valuation;
                const extended = (analysis as any).extended || {};

                // Helper to render a data row with tooltip
                const DataRow = ({ label, value, color }: { label: string; value: any; color?: string }) => {
                    if (value === undefined || value === null || value === '') return null;
                    const displayVal = typeof value === 'number' ? value.toLocaleString('es-ES', { maximumFractionDigits: 4 }) : String(value);
                    const tip = getTooltip(label);
                    return (
                        <div
                            className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800 last:border-0 group/row"
                            title={tip}
                        >
                            <span className="text-xs text-gray-500 font-bold uppercase flex items-center gap-1">
                                {label}
                                {tip && <Info size={9} className="opacity-30 group-hover/row:opacity-100 transition-opacity" />}
                            </span>
                            <span className={`font-black text-sm ${color || ''}`}>{displayVal}</span>
                        </div>
                    );
                };

                // Section Card component
                const SectionCard = ({ title, icon, color, children }: { title: string; icon: React.ReactNode; color: string; children: React.ReactNode }) => (
                    <div className={`${color} p-5 rounded-[2rem] border`}>
                        <h3 className="text-xs font-black uppercase mb-4 flex items-center gap-2 tracking-widest border-b pb-3">{icon}{title}</h3>
                        <div className="space-y-1">{children}</div>
                    </div>
                );

                return (
                    <div className="space-y-6 animate-fadeIn pb-10">
                        <p className="text-[10px] text-center text-gray-400 font-bold uppercase tracking-widest">Datos completos obtenidos de Yahoo Finance V10 • 10 módulos</p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {/* Governance Card */}
                            {allGov && (
                                <SectionCard title="Gobernanza Corporativa" icon={<AlertTriangle size={14} />} color="bg-orange-50/50 dark:bg-orange-900/10 border-orange-200/50 dark:border-orange-900/30">
                                    <DataRow label="Riesgo Auditoría" value={allGov.auditRisk} color={allGov.auditRisk <= 3 ? 'text-green-500' : allGov.auditRisk <= 6 ? 'text-yellow-500' : 'text-red-500'} />
                                    <DataRow label="Riesgo Junta" value={allGov.boardRisk} color={allGov.boardRisk <= 3 ? 'text-green-500' : allGov.boardRisk <= 6 ? 'text-yellow-500' : 'text-red-500'} />
                                    <DataRow label="Riesgo Compensación" value={allGov.compensationRisk} color={allGov.compensationRisk <= 3 ? 'text-green-500' : allGov.compensationRisk <= 6 ? 'text-yellow-500' : 'text-red-500'} />
                                    <DataRow label="Riesgo Accionistas" value={allGov.shareholderRightsRisk} color={allGov.shareholderRightsRisk <= 3 ? 'text-green-500' : allGov.shareholderRightsRisk <= 6 ? 'text-yellow-500' : 'text-red-500'} />
                                    <DataRow label="Riesgo General" value={allGov.overallRisk} color={allGov.overallRisk <= 3 ? 'text-green-500' : allGov.overallRisk <= 6 ? 'text-yellow-500' : 'text-red-500'} />
                                </SectionCard>
                            )}

                            {/* Dividends Card */}
                            {allDiv && (
                                <SectionCard title="Dividendos" icon={<DollarSign size={14} />} color="bg-green-50/50 dark:bg-green-900/10 border-green-200/50 dark:border-green-900/30">
                                    <DataRow label="Dividendo Anual" value={allDiv.rate ? `$${allDiv.rate.toFixed(2)}` : null} />
                                    <DataRow label="Rentabilidad" value={allDiv.yield ? `${(allDiv.yield * 100).toFixed(2)}%` : null} color={allDiv.yield > 0.03 ? 'text-green-500' : ''} />
                                    <DataRow label="Payout Ratio" value={allDiv.payoutRatio ? `${(allDiv.payoutRatio * 100).toFixed(1)}%` : null} />
                                    <DataRow label="Fecha Ex-Dividendo" value={allDiv.exDate ? new Date(allDiv.exDate).toLocaleDateString('es-ES') : null} />
                                    <DataRow label="5Y Avg Yield" value={allDiv.fiveYearAvgYield ? `${allDiv.fiveYearAvgYield.toFixed(2)}%` : null} />
                                </SectionCard>
                            )}

                            {/* Calendar Card */}
                            {allCal && (
                                <SectionCard title="Calendario" icon={<Calendar size={14} />} color="bg-blue-50/50 dark:bg-blue-900/10 border-blue-200/50 dark:border-blue-900/30">
                                    <DataRow label="Próximos Resultados" value={allCal.earningsDate ? new Date(allCal.earningsDate).toLocaleDateString('es-ES') : null} />
                                    <DataRow label="EPS Estimado" value={allCal.epsEstimate ? `$${allCal.epsEstimate.toFixed(2)}` : null} />
                                    <DataRow label="EPS Bajo" value={allCal.epsLow ? `$${allCal.epsLow.toFixed(2)}` : null} />
                                    <DataRow label="EPS Alto" value={allCal.epsHigh ? `$${allCal.epsHigh.toFixed(2)}` : null} />
                                    <DataRow label="Ingresos Estimados" value={allCal.revenueEstimate ? formatLargeNumber(allCal.revenueEstimate) : null} />
                                    <DataRow label="Fecha Dividendo" value={allCal.dividendDate ? new Date(allCal.dividendDate).toLocaleDateString('es-ES') : null} />
                                    <DataRow label="Fecha Ex-Dividendo" value={allCal.exDividendDate ? new Date(allCal.exDividendDate).toLocaleDateString('es-ES') : null} />
                                </SectionCard>
                            )}

                            {/* Earnings Card */}
                            {allEarn && (
                                <SectionCard title="Ganancias (EPS)" icon={<TrendingUp size={14} />} color="bg-purple-50/50 dark:bg-purple-900/10 border-purple-200/50 dark:border-purple-900/30">
                                    <DataRow label="EPS Trailing" value={allEarn.trailing ? `$${allEarn.trailing.toFixed(2)}` : null} />
                                    <DataRow label="EPS Forward" value={allEarn.forward ? `$${allEarn.forward.toFixed(2)}` : null} />
                                    <DataRow label="Crecimiento Q/Q" value={allEarn.quarterlyGrowth ? `${(allEarn.quarterlyGrowth * 100).toFixed(1)}%` : null} color={allEarn.quarterlyGrowth > 0 ? 'text-green-500' : 'text-red-500'} />
                                    {allEarn.history && allEarn.history.length > 0 && (
                                        <>
                                            <div className="text-[10px] text-gray-400 font-bold uppercase mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">Historial Últimos 4Q</div>
                                            {allEarn.history.slice(0, 4).map((h: any, idx: number) => (
                                                <DataRow key={idx} label={h.quarter} value={`$${formatNumber(h.actual)} (sorpresa: ${h.surprisePct >= 0 ? '+' : ''}${formatNumber(h.surprisePct)}%)`} color={h.surprisePct >= 0 ? 'text-green-500' : 'text-red-500'} />
                                            ))}
                                        </>
                                    )}
                                </SectionCard>
                            )}

                            {/* Analysts Card */}
                            <SectionCard title="Analistas" icon={<Users size={14} />} color="bg-cyan-50/50 dark:bg-cyan-900/10 border-cyan-200/50 dark:border-cyan-900/30">
                                <DataRow label="Consenso" value={analysis.analysts?.recommendationKey || analysis.analysts?.consensus} />
                                <DataRow label="Precio Objetivo" value={analysis.analysts?.targetPrice ? formatCurrency(analysis.analysts.targetPrice) : null} />
                                <DataRow label="Objetivo Alto" value={analysis.analysts?.targetHigh ? formatCurrency(analysis.analysts.targetHigh) : null} />
                                <DataRow label="Objetivo Bajo" value={analysis.analysts?.targetLow ? formatCurrency(analysis.analysts.targetLow) : null} />
                                <DataRow label="Objetivo Mediana" value={analysis.analysts?.targetMedian ? formatCurrency(analysis.analysts.targetMedian) : null} />
                                <DataRow label="Upside" value={analysis.analysts?.targetUpside ? `${analysis.analysts.targetUpside}%` : null} color={parseFloat(analysis.analysts?.targetUpside || '0') > 0 ? 'text-green-500' : 'text-red-500'} />
                                <DataRow label="Nº Analistas" value={analysis.analysts?.numberOfAnalysts} />
                                <DataRow label="Score Recomendación" value={analysis.analysts?.recommendationMean?.toFixed(2)} />
                                {analysis.analysts?.breakdown && (
                                    <>
                                        <div className="text-[10px] text-gray-400 font-bold uppercase mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">Desglose</div>
                                        <DataRow label="Strong Buy" value={analysis.analysts.breakdown.strongBuy} color="text-green-600" />
                                        <DataRow label="Buy" value={analysis.analysts.breakdown.buy} color="text-green-500" />
                                        <DataRow label="Hold" value={analysis.analysts.breakdown.hold} color="text-yellow-500" />
                                        <DataRow label="Sell" value={analysis.analysts.breakdown.sell} color="text-orange-500" />
                                        <DataRow label="Strong Sell" value={analysis.analysts.breakdown.strongSell} color="text-red-500" />
                                    </>
                                )}
                            </SectionCard>

                            {/* Financial Health Card */}
                            {allFh && (
                                <SectionCard title="Salud Financiera" icon={<Activity size={14} />} color="bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200/50 dark:border-emerald-900/30">
                                    <DataRow label="Ingresos Totales" value={allFh.totalRevenue ? formatLargeNumber(allFh.totalRevenue) : null} />
                                    <DataRow label="EBITDA" value={allFh.ebitda ? formatLargeNumber(allFh.ebitda) : null} />
                                    <DataRow label="Beneficio Bruto" value={allFh.grossProfits ? formatLargeNumber(allFh.grossProfits) : null} />
                                    <DataRow label="Free Cash Flow" value={allFh.freeCashflow ? formatLargeNumber(allFh.freeCashflow) : null} color={allFh.freeCashflow > 0 ? 'text-green-500' : 'text-red-500'} />
                                    <DataRow label="Caja Total" value={allFh.totalCash ? formatLargeNumber(allFh.totalCash) : null} />
                                    <DataRow label="Deuda Total" value={allFh.totalDebt ? formatLargeNumber(allFh.totalDebt) : null} />
                                    <DataRow label="Margen Neto" value={allFh.profitMargins ? `${(allFh.profitMargins * 100).toFixed(1)}%` : null} />
                                    <DataRow label="Margen Bruto" value={allFh.grossMargins ? `${(allFh.grossMargins * 100).toFixed(1)}%` : null} />
                                    <DataRow label="Margen EBITDA" value={allFh.ebitdaMargins ? `${(allFh.ebitdaMargins * 100).toFixed(1)}%` : null} />
                                    <DataRow label="Margen Operativo" value={allFh.operatingMargins ? `${(allFh.operatingMargins * 100).toFixed(1)}%` : null} />
                                    <DataRow label="ROE" value={allFh.returnOnEquity ? `${(allFh.returnOnEquity * 100).toFixed(1)}%` : null} color={allFh.returnOnEquity > 0.15 ? 'text-green-500' : ''} />
                                    <DataRow label="ROA" value={allFh.returnOnAssets ? `${(allFh.returnOnAssets * 100).toFixed(1)}%` : null} />
                                    <DataRow label="Crecimiento Ingresos" value={allFh.revenueGrowth ? `${(allFh.revenueGrowth * 100).toFixed(1)}%` : null} color={allFh.revenueGrowth > 0 ? 'text-green-500' : 'text-red-500'} />
                                    <DataRow label="Crecimiento EPS" value={allFh.earningsGrowth ? `${(allFh.earningsGrowth * 100).toFixed(1)}%` : null} color={allFh.earningsGrowth > 0 ? 'text-green-500' : 'text-red-500'} />
                                    <DataRow label="Deuda/Capital" value={allFh.debtToEquity?.toFixed(2)} color={allFh.debtToEquity > 150 ? 'text-red-500' : ''} />
                                    <DataRow label="Ratio Liquidez" value={allFh.currentRatio?.toFixed(2)} color={allFh.currentRatio > 1.5 ? 'text-green-500' : allFh.currentRatio < 1 ? 'text-red-500' : ''} />
                                    <DataRow label="Quick Ratio" value={allFh.quickRatio?.toFixed(2)} />
                                </SectionCard>
                            )}

                            {/* Valuation Card */}
                            {allVal && (
                                <SectionCard title="Valoración" icon={<PieChart size={14} />} color="bg-indigo-50/50 dark:bg-indigo-900/10 border-indigo-200/50 dark:border-indigo-900/30">
                                    <DataRow label="Market Cap" value={allVal.marketCap ? formatLargeNumber(allVal.marketCap) : null} />
                                    <DataRow label="Enterprise Value" value={allVal.enterpriseValue ? formatLargeNumber(allVal.enterpriseValue) : null} />
                                    <DataRow label="P/E Trailing" value={allVal.peTrailing?.toFixed(2)} />
                                    <DataRow label="P/E Forward" value={allVal.peForward?.toFixed(2)} />
                                    <DataRow label="PEG Ratio" value={allVal.pegRatio?.toFixed(2)} />
                                    <DataRow label="Price/Sales" value={allVal.priceToSales?.toFixed(2)} />
                                    <DataRow label="Price/Book" value={allVal.priceToBook?.toFixed(2)} />
                                    <DataRow label="EV/Revenue" value={allVal.evToRevenue?.toFixed(2)} />
                                    <DataRow label="EV/EBITDA" value={allVal.evToEbitda?.toFixed(2)} />
                                    <DataRow label="Beta" value={allVal.beta?.toFixed(2)} />
                                    <DataRow label="52s Max" value={allVal.fiftyTwoWeekHigh ? formatCurrency(allVal.fiftyTwoWeekHigh) : null} />
                                    <DataRow label="52s Min" value={allVal.fiftyTwoWeekLow ? formatCurrency(allVal.fiftyTwoWeekLow) : null} />
                                    <DataRow label="SMA50" value={allVal.fiftyDayAverage ? formatCurrency(allVal.fiftyDayAverage) : null} />
                                    <DataRow label="SMA200" value={allVal.twoHundredDayAverage ? formatCurrency(allVal.twoHundredDayAverage) : null} />
                                </SectionCard>
                            )}

                            {/* Risk Card */}
                            <SectionCard title="Métricas de Riesgo" icon={<AlertTriangle size={14} />} color="bg-red-50/50 dark:bg-red-900/10 border-red-200/50 dark:border-red-900/30">
                                <DataRow label="Score Riesgo" value={`${analysis.risk.score}/10`} color={analysis.risk.score <= 3 ? 'text-green-500' : analysis.risk.score <= 6 ? 'text-yellow-500' : 'text-red-500'} />
                                <DataRow label="Volatilidad Anual" value={`${(analysis.risk.volatility * 100).toFixed(1)}%`} />
                                <DataRow label="Sharpe Ratio" value={analysis.risk.sharpe?.toFixed(2)} />
                                <DataRow label="Sortino Ratio" value={analysis.risk.sortino?.toFixed(2)} />
                                <DataRow label="Max Drawdown" value={`${(analysis.risk.maxDrawdown * 100).toFixed(1)}%`} color="text-red-500" />
                                <DataRow label="Beta" value={analysis.risk.beta?.toFixed(2)} />
                                <DataRow label="VaR 95%" value={`${(analysis.risk.var95 * 100).toFixed(2)}%`} />
                                <DataRow label="52s Máximo" value={analysis.risk.fiftyTwoWeekHigh ? formatCurrency(analysis.risk.fiftyTwoWeekHigh) : null} />
                                <DataRow label="52s Mínimo" value={analysis.risk.fiftyTwoWeekLow ? formatCurrency(analysis.risk.fiftyTwoWeekLow) : null} />
                                <DataRow label="Short % Float" value={analysis.risk.shortPercentFloat ? `${(analysis.risk.shortPercentFloat * 100).toFixed(1)}%` : null} />
                                {analysis.risk.solvency && (
                                    <>
                                        <DataRow label="Altman Z-Score" value={analysis.risk.solvency.zScore?.toFixed(2)} color={analysis.risk.solvency.zone === 'SAFE' ? 'text-green-500' : analysis.risk.solvency.zone === 'GREY' ? 'text-yellow-500' : 'text-red-500'} />
                                        <DataRow label="Zona Solvencia" value={analysis.risk.solvency.label} />
                                    </>
                                )}
                            </SectionCard>
                        </div>

                        {/* Extended Raw Data (legacy) */}
                        {Object.keys(extended).filter(k => k !== '_raw').length > 0 && (
                            <div className="mt-8">
                                <h3 className="text-xs font-black text-gray-500 uppercase mb-4 tracking-widest">Datos Adicionales (Extended)</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {Object.entries(extended).filter(([k]) => k !== '_raw').slice(0, 24).map(([k, v]) => (
                                        <div key={k} className="p-3 bg-gray-50 dark:bg-gray-800/30 rounded-xl border border-gray-100 dark:border-gray-700">
                                            <div className="text-[9px] text-gray-400 uppercase font-bold truncate" title={k}>{k.replace(/^[a-zA-Z]+_/g, '').replace(/_/g, ' ')}</div>
                                            <div className="text-xs font-bold text-gray-700 dark:text-gray-300 truncate">{typeof v === 'number' ? v.toLocaleString('es-ES', { maximumFractionDigits: 4 }) : String(v)}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md animate-fadeIn" onClick={onClose} />
            <div className="relative bg-white dark:bg-gray-900 w-full max-w-6xl rounded-[3rem] shadow-2xl flex flex-col animate-scaleIn border border-gray-200 dark:border-gray-800 max-h-[95vh] overflow-hidden">

                {/* Header */}
                <div className="p-8 border-b border-gray-100 dark:border-gray-800 flex justify-between items-start bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-black shrink-0">
                    <div className="flex items-center gap-6">
                        <div className="w-20 h-20 bg-primary/20 rounded-[2rem] flex items-center justify-center border border-primary/20 shadow-lg shadow-primary/5 shrink-0">
                            <Activity className="text-primary" size={40} />
                        </div>
                        <div>
                            <div className="flex items-center gap-4">
                                <h1 className="text-3xl md:text-5xl font-black text-gray-900 dark:text-white tracking-tighter leading-none uppercase">
                                    {companyName || ticker}
                                </h1>
                                <div className="px-4 py-1.5 bg-black/10 dark:bg-white/10 rounded-2xl border border-black/10 dark:border-white/10 text-sm font-black font-mono tracking-widest shadow-inner">
                                    {ticker}
                                </div>
                            </div>
                            <div className="text-xs text-gray-500 font-black uppercase tracking-[0.2em] mt-3 flex items-center gap-3">
                                <span>Discovery Engine Statistics</span>
                                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                                <span className="text-primary">Premium Deep Analysis</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-4 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-[1.5rem] transition-all border border-transparent hover:border-gray-200 dark:hover:border-white/10 shadow-sm active:scale-90"><X size={28} /></button>
                </div>

                {/* Navigation */}
                <div className="px-8 border-b border-gray-100 dark:border-gray-800 flex gap-10 overflow-x-auto scrollbar-hide bg-gray-50/50 dark:bg-black/20 shrink-0">
                    {([
                        { id: 'overview', label: 'RESUMEN' },
                        { id: 'fundamental', label: 'FUNDAMENTAL' },
                        { id: 'technical', label: 'TÉCNICO' },
                        { id: 'analysts', label: 'ANALISTAS' },
                        { id: 'risk', label: 'RIESGO' },
                        { id: 'calendar', label: 'CALENDARIO' },
                        { id: 'all_data', label: 'TODOS LOS DATOS' }
                    ] as const).map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`py-5 text-[10px] font-black tracking-[0.3em] transition-all relative uppercase whitespace-nowrap ${activeTab === tab.id ? 'text-primary' : 'text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'}`}>
                            {tab.label}
                            {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full shadow-[0_-4px_10px_rgba(255,255,255,0.2)]"></div>}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-white dark:bg-gray-900">
                    {renderContent()}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-black/40 flex justify-between items-center text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 px-10 shrink-0">
                    <div className="flex gap-8">
                        <span className="flex items-center gap-2"><Info size={14} className="text-primary" /> Datos de Yahoo Finance & Finnhub</span>
                        <span className="flex items-center gap-2"><BarChart2 size={14} className="text-primary" /> Análisis Algorítmico Activo</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="opacity-50">Stocks Manager</span>
                        <span className="text-gray-900 dark:text-white font-black">{appVersion}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
