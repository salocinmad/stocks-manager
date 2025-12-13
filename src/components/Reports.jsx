import React, { useState, useEffect, useRef } from 'react';
import { authenticatedFetch } from '../services/auth.js';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import CalendarHeatmap from './CalendarHeatmap.jsx';
import './Reports.css';

/**
 * Componente principal de Reportes Avanzados del Portafolio
 * Muestra métricas, gráficos, alertas y análisis detallados
 */
function Reports({
    operations = [],
    currentPrices = {},
    currentEURUSD = 0.92,
    portfolioId,
    theme = 'dark'
}) {
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedPeriod, setSelectedPeriod] = useState('30'); // días
    const [generatingPDF, setGeneratingPDF] = useState(false);
    const reportRef = useRef(null);

    // Fetch reporte actual
    useEffect(() => {
        const fetchReport = async () => {
            if (!portfolioId) {
                setError('No hay portafolio seleccionado');
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError(null);

                const response = await authenticatedFetch(
                    `/api/reports/current?portfolioId=${portfolioId}&eurUsd=${currentEURUSD}&period=${selectedPeriod}`
                );

                if (!response.ok) {
                    throw new Error('Error al obtener el reporte');
                }

                const data = await response.json();
                setReportData(data.data);
            } catch (err) {
                console.error('Error fetching report:', err);
                setError(err.message || 'Error al cargar el reporte');
            } finally {
                setLoading(false);
            }
        };

        fetchReport();
    }, [portfolioId, currentEURUSD, selectedPeriod]);

    // Handle PDF download
    const handleDownloadPDF = async () => {
        if (!reportRef.current || !reportData) return;

        try {
            setGeneratingPDF(true);

            // Capturar el contenedor del reporte como canvas
            const canvas = await html2canvas(reportRef.current, {
                scale: 2,
                useCORS: true,
                backgroundColor: theme === 'dark' ? '#1a1a2e' : '#ffffff',
                logging: false
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');

            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
            const imgX = (pdfWidth - imgWidth * ratio) / 2;
            const imgY = 10;

            pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);

            const fileName = `Reporte_Portfolio_${new Date().toISOString().split('T')[0]}.pdf`;
            pdf.save(fileName);
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Error al generar el PDF. Por favor, inténtalo de nuevo.');
        } finally {
            setGeneratingPDF(false);
        }
    };

    // Función auxiliar para formatear fechas
    const formatDate = (dateString) => {
        const options = { day: '2-digit', month: '2-digit', year: 'numeric' };
        return new Date(dateString).toLocaleDateString('es-ES', options);
    };

    // Loading state
    if (loading) {
        return (
            <div className="reports-container">
                <div className="loading-container">
                    <div className="loading-spinner"></div>
                    <p>Generando reporte...</p>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="reports-container">
                <div className="error-container">
                    <h3>⚠️ Error</h3>
                    <p>{error}</p>
                </div>
            </div>
        );
    }

    // No data
    if (!reportData) {
        return (
            <div className="reports-container">
                <div className="no-data-container">
                    <h3>📊 No hay datos disponibles</h3>
                    <p>No se ha generado ningún reporte para este portafolio aún.</p>
                    <p>Los reportes se generan automáticamente cada día a las 01:00 AM.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="reports-container" ref={reportRef}>
            {/* Header con título y filtros */}
            <div className="reports-header">
                <h2>📊 Análisis del Portafolio</h2>
                <div className="header-actions">
                    <div className="period-selector">
                        <label>Período:</label>
                        <select value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)}>
                            <option value="7">Últimos 7 días</option>
                            <option value="30">Último mes</option>
                            <option value="90">Últimos 3 meses</option>
                            <option value="365">Último año</option>
                        </select>
                    </div>
                    <button
                        className="download-pdf-button"
                        onClick={handleDownloadPDF}
                        disabled={generatingPDF}
                    >
                        {generatingPDF ? '⏳ Generando...' : '📄 Descargar PDF'}
                    </button>
                </div>
            </div>

            {/* Métricas Principales - 4 Cards */}
            <div className="metrics-grid">
                {/* ROI Card */}
                <div className={`metric-card ${reportData.roi >= 0 ? 'positive' : 'negative'}`}>
                    <div className="metric-icon">📈</div>
                    <div className="metric-content">
                        <h3>ROI</h3>
                        <div className="metric-value">
                            {reportData.roi >= 0 ? '+' : ''}{reportData.roi.toFixed(2)}%
                        </div>
                        <div className="metric-subtitle">Return on Investment</div>
                    </div>
                </div>

                {/* Win Rate Card */}
                <div className="metric-card">
                    <div className="metric-icon">🎯</div>
                    <div className="metric-content">
                        <h3>Win Rate</h3>
                        <div className="metric-value">{reportData.winRate.toFixed(1)}%</div>
                        <div className="metric-subtitle">
                            {reportData.successfulOperations}/{reportData.totalOperations} operaciones exitosas
                        </div>
                    </div>
                </div>

                {/* Tiempo de Tenencia Card */}
                <div className="metric-card">
                    <div className="metric-icon">⏱️</div>
                    <div className="metric-content">
                        <h3>Tiempo Promedio</h3>
                        <div className="metric-value">{Math.round(reportData.avgHoldingTime)} días</div>
                        <div className="metric-subtitle">Tenencia promedio</div>
                    </div>
                </div>

                {/* Tasa de Crecimiento Card */}
                <div className={`metric-card ${reportData.growthRate >= 0 ? 'positive' : 'negative'}`}>
                    <div className="metric-icon">📊</div>
                    <div className="metric-content">
                        <h3>Crecimiento</h3>
                        <div className="metric-value">
                            {reportData.growthRate >= 0 ? '+' : ''}{reportData.growthRate.toFixed(2)}%
                        </div>
                        <div className="metric-subtitle">Tasa de crecimiento</div>
                    </div>
                </div>
            </div>

            {/* Resumen Financiero */}
            <div className="metrics-grid">
                <div className="metric-card">
                    <div className="metric-icon">💰</div>
                    <div className="metric-content">
                        <h3>Total Invertido</h3>
                        <div className="metric-value">€{reportData.totalInvestedEUR.toFixed(2)}</div>
                    </div>
                </div>
                <div className="metric-card">
                    <div className="metric-icon">🏦</div>
                    <div className="metric-content">
                        <h3>Valor Actual</h3>
                        <div className="metric-value">€{reportData.totalValueEUR.toFixed(2)}</div>
                    </div>
                </div>
                <div className={`metric-card ${reportData.pnlEUR >= 0 ? 'positive' : 'negative'}`}>
                    <div className="metric-icon">⚖️</div>
                    <div className="metric-content">
                        <h3>PnL Total</h3>
                        <div className="metric-value">
                            {reportData.pnlEUR >= 0 ? '+' : ''}€{reportData.pnlEUR.toFixed(2)}
                        </div>
                    </div>
                </div>
                {reportData.dailyChangeEUR !== undefined && (
                    <div className={`metric-card ${reportData.dailyChangeEUR >= 0 ? 'positive' : 'negative'}`}>
                        <div className="metric-icon">💸</div>
                        <div className="metric-content">
                            <h3>Cambio Hoy</h3>
                            <div className="metric-value">
                                {reportData.dailyChangeEUR >= 0 ? '+' : ''}€{reportData.dailyChangeEUR.toFixed(2)}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Ganancias Realizadas por Período */}
            {reportData.fixedPeriodPnLMetrics && (
                <div className="metrics-grid">
                    <div className={`metric-card ${reportData.fixedPeriodPnLMetrics.lastMonth >= 0 ? 'positive' : 'negative'}`}>
                        <div className="metric-icon">🗓️</div>
                        <div className="metric-content">
                            <h3>Ganancias Último Mes</h3>
                            <div className="metric-value">
                                {reportData.fixedPeriodPnLMetrics.lastMonth >= 0 ? '+' : ''}€{reportData.fixedPeriodPnLMetrics.lastMonth.toFixed(2)}
                            </div>
                        </div>
                    </div>
                    <div className={`metric-card ${reportData.fixedPeriodPnLMetrics.last3Months >= 0 ? 'positive' : 'negative'}`}>
                        <div className="metric-icon">📅</div>
                        <div className="metric-content">
                            <h3>Ganancias 3 Meses</h3>
                            <div className="metric-value">
                                {reportData.fixedPeriodPnLMetrics.last3Months >= 0 ? '+' : ''}€{reportData.fixedPeriodPnLMetrics.last3Months.toFixed(2)}
                            </div>
                        </div>
                    </div>
                    <div className={`metric-card ${reportData.fixedPeriodPnLMetrics.lastYear >= 0 ? 'positive' : 'negative'}`}>
                        <div className="metric-icon">📈</div>
                        <div className="metric-content">
                            <h3>Ganancias Último Año</h3>
                            <div className="metric-value">
                                {reportData.fixedPeriodPnLMetrics.lastYear >= 0 ? '+' : ''}€{reportData.fixedPeriodPnLMetrics.lastYear.toFixed(2)}
                            </div>
                        </div>
                    </div>
                    <div className={`metric-card ${reportData.fixedPeriodPnLMetrics.sinceInception >= 0 ? 'positive' : 'negative'}`}>
                        <div className="metric-icon">🚀</div>
                        <div className="metric-content">
                            <h3>Gancias Desde Inicio</h3>
                            <div className="metric-value">
                                {reportData.fixedPeriodPnLMetrics.sinceInception >= 0 ? '+' : ''}€{reportData.fixedPeriodPnLMetrics.sinceInception.toFixed(2)}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Gráficos de Inversión vs Ganancias y Contribución por Empresa */}
            <div className="charts-grid">
                {reportData.investmentVsGain && (
                    <div className="chart-card">
                        <h3>📈 Inversión vs Ganancias</h3>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={reportData.investmentVsGain}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {reportData.investmentVsGain.map((entry, index) => (
                                        <Cell key={`cell-investment-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value) => `€${value.toFixed(2)}`} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {reportData.companyContribution && (
                    <div className="chart-card">
                        <h3>📊 Contribución por Empresa</h3>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={reportData.companyContribution}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {reportData.companyContribution.map((entry, index) => (
                                        <Cell key={`cell-contribution-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value) => `€${value.toFixed(2)}`} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            {/* Alertas */}
            {reportData.alerts && reportData.alerts.length > 0 && (
                <div className="alerts-section">
                    <h3>🔔 Alertas Activas ({reportData.alerts.length})</h3>
                    <div className="alerts-list">
                        {reportData.alerts.map((alert, index) => (
                            <div key={index} className={`alert-card alert-${alert.severity}`}>
                                <div className="alert-icon">
                                    {alert.severity === 'critical' && '🔴'}
                                    {alert.severity === 'warning' && '⚠️'}
                                    {alert.severity === 'info' && '💚'}
                                </div>
                                <div className="alert-content">
                                    <div className="alert-company">{alert.company}</div>
                                    <div className="alert-message">{alert.message}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Análisis Mensual */}
            {reportData.monthlyGains && reportData.monthlyGains.length > 0 && (
                <div className="monthly-analysis">
                    <h3>📊 PnL No Realizado al Final del Mes</h3>
                    <div className="monthly-stats">
                        {reportData.bestMonth && (
                            <div className="monthly-highlight best">
                                <span className="highlight-label">🏆 Mejor Mes:</span>
                                <span className="highlight-value">
                                    {reportData.bestMonth.month}
                                    <span className="positive">
                                        {' '}+€{reportData.bestMonth.gain.toFixed(2)}
                                        ({reportData.bestMonth.growthRate.toFixed(1)}%)
                                    </span>
                                </span>
                            </div>
                        )}
                        {reportData.worstMonth && (!reportData.bestMonth || reportData.bestMonth.month !== reportData.worstMonth.month) && (
                            <div className="monthly-highlight worst">
                                <span className="highlight-label">📉 Peor Mes:</span>
                                <span className="highlight-value">
                                    {reportData.worstMonth.month}
                                    <span className={reportData.worstMonth.gain >= 0 ? "positive" : "negative"}>
                                        {' '}{reportData.worstMonth.gain >= 0 ? '+' : ''}€{reportData.worstMonth.gain.toFixed(2)}
                                        ({reportData.worstMonth.growthRate.toFixed(1)}%)
                                    </span>
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Gráfico simple de ganancias por mes */}
                    <div className="monthly-chart">
                        {reportData.monthlyGains.map((month, index) => {
                            const maxGain = Math.max(...reportData.monthlyGains.map(m => Math.abs(m.gain)));
                            const height = Math.abs(month.gain) / maxGain * 100;

                            return (
                                <div key={index} className="month-bar-container">
                                    <div className="month-label">{month.month.split('-')[1]}</div>
                                    <div className="month-bar-wrapper">
                                        <div
                                            className={`month-bar ${month.gain >= 0 ? 'positive' : 'negative'}`}
                                            style={{ height: `${height}%` }}
                                            title={`${month.month}: PnL total €${month.gain.toFixed(2)}`}
                                        >
                                        </div>
                                    </div>
                                    <div className={`month-value ${month.gain >= 0 ? 'positive' : 'negative'}`}>
                                        {month.gain >= 0 ? '+' : '-'}€{Math.abs(month.gain).toFixed(0)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Análisis Mensual - PnL Realizado (Cerrado) */}
            {reportData.realizedMonthlyGains && reportData.realizedMonthlyGains.length > 0 && (
                <div className="monthly-analysis">
                    <h3>💰 PnL Realizado Mensual (Posiciones Cerradas)</h3>
                    <div className="monthly-stats">
                        {(() => {
                            const bestRealized = reportData.realizedMonthlyGains.reduce((max, m) =>
                                m.realizedGain > max.realizedGain ? m : max
                            );
                            const worstRealized = reportData.realizedMonthlyGains.reduce((min, m) =>
                                m.realizedGain < min.realizedGain ? m : min
                            );

                            return (
                                <>
                                    <div className="monthly-highlight best">
                                        <span className="highlight-label">🏆 Mejor Mes:</span>
                                        <span className="highlight-value">
                                            {bestRealized.month}
                                            <span className="positive">
                                                {' '}+€{bestRealized.realizedGain.toFixed(2)}
                                            </span>
                                        </span>
                                    </div>
                                    {bestRealized.month !== worstRealized.month && (
                                        <div className="monthly-highlight worst">
                                            <span className="highlight-label">📉 Peor Mes:</span>
                                            <span className="highlight-value">
                                                {worstRealized.month}
                                                <span className={worstRealized.realizedGain >= 0 ? "positive" : "negative"}>
                                                    {' '}{worstRealized.realizedGain >= 0 ? '+' : ''}€{worstRealized.realizedGain.toFixed(2)}
                                                </span>
                                            </span>
                                        </div>
                                    )}
                                </>
                            );
                        })()}
                    </div>

                    {/* Gráfico de barras de PnL Realizado */}
                    <div className="monthly-chart">
                        {reportData.realizedMonthlyGains.map((month, index) => {
                            const maxGain = Math.max(...reportData.realizedMonthlyGains.map(m => Math.abs(m.realizedGain)));
                            const height = maxGain > 0 ? (Math.abs(month.realizedGain) / maxGain * 100) : 0;

                            return (
                                <div key={index} className="month-bar-container">
                                    <div className="month-label">{month.month.split('-')[1]}</div>
                                    <div className="month-bar-wrapper">
                                        <div
                                            className={`month-bar ${month.realizedGain >= 0 ? 'positive' : 'negative'}`}
                                            style={{ height: `${height}%` }}
                                            title={`${month.month}: €${month.realizedGain.toFixed(2)}`}
                                        >
                                        </div>
                                    </div>
                                    <div className={`month-value ${month.realizedGain >= 0 ? 'positive' : 'negative'}`}>
                                        {month.realizedGain >= 0 ? '+' : '-'}€{Math.abs(month.realizedGain).toFixed(0)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Análisis Avanzado */}
            {reportData.analysis && (
                <div className="advanced-analysis-section">
                    <h3>🧠 Análisis Avanzado</h3>

                    <div className="analysis-grid">
                        {/* Gráfico de Sectores */}
                        <div className="analysis-card sector-chart">
                            <h4>Distribución por Sector</h4>
                            <div className="chart-container" style={{ height: '300px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={Object.entries(reportData.analysis.sectorAllocation).map(([name, value]) => ({ name, value }))}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {Object.entries(reportData.analysis.sectorAllocation).map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'][index % 6]} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            formatter={(value) => `€${value.toFixed(2)}`}
                                            contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                                        />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Métricas de Riesgo */}
                        <div className="analysis-card risk-metrics">
                            <h4>Métricas de Riesgo</h4>
                            <div className="risk-grid">
                                <div className="risk-item">
                                    <span className="risk-label">Beta Ponderada</span>
                                    <span className={`risk-value ${reportData.analysis.riskMetrics.weightedBeta > 1.2 ? 'high-risk' : 'low-risk'}`}>
                                        {reportData.analysis.riskMetrics.weightedBeta.toFixed(2)}
                                    </span>
                                    <span className="risk-desc">
                                        {reportData.analysis.riskMetrics.weightedBeta > 1 ? 'Más volátil que el mercado' : 'Menos volátil que el mercado'}
                                    </span>
                                </div>
                                <div className="risk-item">
                                    <span className="risk-label">Yield Promedio</span>
                                    <span className="risk-value positive">
                                        {reportData.analysis.riskMetrics.weightedDividendYield.toFixed(2)}%
                                    </span>
                                    <span className="risk-desc">Rentabilidad por dividendo estimada</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Análisis de Drawdown */}
            {reportData.drawdownData && reportData.drawdownData.length > 0 && (
                <div className="drawdown-section">
                    <h3>📉 Análisis de Drawdown</h3>
                    <div className="drawdown-stats">
                        <div className="drawdown-highlight">
                            <span className="highlight-label">Caída Máxima:</span>
                            <span className="highlight-value negative">
                                {reportData.maxDrawdown?.toFixed(2)}%
                            </span>
                            {reportData.maxDrawdownDate && (
                                <span className="highlight-date">
                                    {new Date(reportData.maxDrawdownDate).toLocaleDateString('es-ES')}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="chart-container" style={{ height: '250px', marginTop: '20px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={reportData.drawdownData}>
                                <defs>
                                    <linearGradient id="drawdownGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                <XAxis
                                    dataKey="date"
                                    tick={{ fill: '#64748b', fontSize: 12 }}
                                    tickFormatter={(value) => new Date(value).toLocaleDateString('es-ES', { month: 'short' })}
                                />
                                <YAxis
                                    tick={{ fill: '#64748b', fontSize: 12 }}
                                    tickFormatter={(value) => `${value.toFixed(0)}%`}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                                    formatter={(value) => [`${value.toFixed(2)}%`, 'Drawdown']}
                                    labelFormatter={(label) => new Date(label).toLocaleDateString('es-ES')}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="drawdown"
                                    stroke="#ef4444"
                                    fill="url(#drawdownGradient)"
                                    strokeWidth={2}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Mapa de Calor de Rendimiento */}
            {reportData.heatmapData && reportData.heatmapData.length > 0 && (
                <div className="heatmap-section">
                    <h3>🔥 Mapa de Calor de Rendimiento</h3>
                    <p className="section-description">
                        Visualización de rendimiento diario. Verde = Ganancia, Rojo = Pérdida
                    </p>
                    <CalendarHeatmap data={reportData.heatmapData} theme={theme} />
                </div>
            )}

            {/* Top Posiciones */}
            {reportData.topPositions && reportData.topPositions.length > 0 && (
                <div className="top-positions">
                    <h3>🏅 Top Posiciones por Valor</h3>
                    <div className="positions-table">
                        <table>
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Empresa</th>
                                    <th>Acciones</th>
                                    <th>Precio Actual</th>
                                    <th>Valor Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reportData.topPositions.map((pos, index) => (
                                    <tr key={index}>
                                        <td>{index + 1}</td>
                                        <td>
                                            <strong>{pos.company}</strong>
                                            {pos.symbol && <span className="symbol"> ({pos.symbol})</span>}
                                        </td>
                                        <td>{pos.shares.toFixed(2)}</td>
                                        <td>{pos.currency} {pos.currentPrice.toFixed(2)}</td>
                                        <td className="value-cell">€{pos.valueEUR.toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}



            {/* Tabla de Precios Históricos (Último Año) - Eliminada por petición del usuario */}

            {/* Nota al pie */}
            <div className="report-footer">
                <p>
                    <small>
                        ℹ️ Reporte generado: {new Date(reportData.generatedAt).toLocaleString('es-ES')}
                        {' | '}Tipo de cambio EUR/USD: {reportData.exchangeRate.toFixed(4)}
                    </small>
                </p>
            </div>
        </div >
    );
}

export default Reports;
