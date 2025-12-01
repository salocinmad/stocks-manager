import React, { useState, useEffect, useRef } from 'react';
import { authenticatedFetch } from '../services/auth.js';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
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
                    `/api/reports/current?portfolioId=${portfolioId}&eurUsd=${currentEURUSD}`
                );

                if (!response.ok) {
                    throw new Error('Error al obtener el reporte');
                }

                const data = await response.json();
                console.log('DEBUG: Datos del reporte recibidos:', data.data);
                setReportData(data.data);
            } catch (err) {
                console.error('Error fetching report:', err);
                setError(err.message || 'Error al cargar el reporte');
            } finally {
                setLoading(false);
            }
        };

        fetchReport();
    }, [portfolioId, currentEURUSD]);

    // Handle PDF download
    const handleDownloadPDF = async () => {
        if (!reportRef.current || !reportData) return;

        try {
            setGeneratingPDF(true);

            // Capture the report container as canvas
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

    // Helper para formatear fechas
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
            <div className="financial-summary">
                <div className="summary-item">
                    <span className="summary-label">Total Invertido:</span>
                    <span className="summary-value">€{reportData.totalInvestedEUR.toFixed(2)}</span>
                </div>
                <div className="summary-item">
                    <span className="summary-label">Valor Actual:</span>
                    <span className="summary-value">€{reportData.totalValueEUR.toFixed(2)}</span>
                </div>
                <div className="summary-item">
                    <span className="summary-label">PnL Total:</span>
                    <span className={`summary-value ${reportData.pnlEUR >= 0 ? 'positive' : 'negative'}`}>
                        {reportData.pnlEUR >= 0 ? '+' : ''}€{reportData.pnlEUR.toFixed(2)}
                    </span>
                </div>
                {reportData.dailyChangeEUR !== undefined && (
                    <div className="summary-item">
                        <span className="summary-label">Cambio Hoy:</span>
                        <span className={`summary-value ${reportData.dailyChangeEUR >= 0 ? 'positive' : 'negative'}`}>
                            {reportData.dailyChangeEUR >= 0 ? '+' : ''}€{reportData.dailyChangeEUR.toFixed(2)}
                        </span>
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
                    <h3>📅 Análisis Mensual</h3>
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
                                            title={`${month.month}: €${month.gain.toFixed(2)}`}
                                        >
                                        </div>
                                    </div>
                                    <div className="month-value">
                                        {month.gain >= 0 ? '+' : ''}€{Math.abs(month.gain).toFixed(0)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
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
        </div>
    );
}

export default Reports;
