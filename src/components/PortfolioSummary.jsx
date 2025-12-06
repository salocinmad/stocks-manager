import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import ExpandablePositionRow from './ExpandablePositionRow.jsx';

/**
 * Componente que muestra el resumen completo del portafolio:
 * - Estadísticas (valor total, empresas, operaciones, acciones)
 * - Posiciones activas con tabla expandible
 * - Gráficos (Inversión vs Ganancias, Contribución por Empresa, PnL 30 días)
 */
function PortfolioSummary({
    stats,
    chartData,
    contributionChartData,
    contributionColorsMap,
    contributionDate,
    pnlSeries,
    theme,
    activePositions,
    currentEURUSD,
    currentEURUSDSource,
    lastUpdatedAt,
    loadingPrices,
    fetchCurrentEURUSD,
    fetchAllCurrentPrices,
    operations,
    currentPrices,
    currentPortfolioId,
    formatPrice,
    formatCurrency,
    openModal,
    expandedPositions,
    setExpandedPositions,
    historicalDataCache,
    setHistoricalDataCache,
    externalButtons,
    handleNoteClick,
    notesCache,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop,
    draggedPosition,
    sortPositions,
    getActivePositions
}) {
    return (
        <>
            {/* Estadísticas */}
            <div className="stats">
                <div className="stat-item">
                    <div className="stat-value">€{(stats?.totalValue || 0).toFixed(2)}</div>
                    <div className="stat-label">Valor Total</div>
                </div>
                <div className="stat-item">
                    <div className="stat-value">{stats.companiesCount}</div>
                    <div className="stat-label">Empresas</div>
                </div>
                <div className="stat-item">
                    <div className="stat-value">{stats.totalOperations}</div>
                    <div className="stat-label">Operaciones Abiertas</div>
                </div>
                <div className="stat-item">
                    <div className="stat-value">{stats.totalShares}</div>
                    <div className="stat-label">Acciones</div>
                </div>
            </div>

            {/* Posiciones Activas */}
            <div className="card">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                    <div>
                        <h2 style={{ margin: 0 }}>Posiciones Activas</h2>
                        {currentEURUSD && (
                            <div style={{ fontSize: '12px', color: '#888', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span>💱 1 USD = {(currentEURUSD || 0).toFixed(4)} EUR</span>
                                {(() => {
                                    const src = currentEURUSDSource;
                                    if (src === 'finnhub') {
                                        return <img src="https://finnhub.io/static/img/webp/finnhub-logo.webp" alt="Finnhub" title="Finnhub" style={{ width: '14px', height: '14px' }} />
                                    } else if (src === 'yahoo') {
                                        return <img src="https://raw.githubusercontent.com/edent/SuperTinyIcons/1ee09df265d2f3764c28b1404dd0d7264c37472d/images/svg/yahoo.svg" alt="Yahoo" title="Yahoo" style={{ width: '14px', height: '14px' }} />
                                    }
                                    return null;
                                })()}
                            </div>
                        )}
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        {lastUpdatedAt ? (
                            <div style={{ fontSize: '12px', color: '#888' }}>
                                🕒 Últ. act.: {lastUpdatedAt.toLocaleString('es-ES', { hour12: false })} ({(() => {
                                    const diffMs = Date.now() - lastUpdatedAt.getTime();
                                    const diffMin = Math.floor(diffMs / 60000);
                                    if (diffMin < 1) return 'hace <1 min';
                                    if (diffMin < 60) return `hace ${diffMin} min`;
                                    const diffH = Math.floor(diffMin / 60);
                                    if (diffH < 24) return `hace ${diffH} h`;
                                    const diffD = Math.floor(diffH / 24);
                                    return `hace ${diffD} d`;
                                })()})
                            </div>
                        ) : (
                            <div style={{ fontSize: '12px', color: '#888' }}>🕒 Últ. act.: -</div>
                        )}
                        <div style={{ fontSize: '12px', color: '#666', marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <img src="https://finnhub.io/static/img/webp/finnhub-logo.webp" alt="Finnhub" style={{ width: '14px', height: '14px' }} /> Finnhub
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <img src="https://raw.githubusercontent.com/edent/SuperTinyIcons/1ee09df265d2f3764c28b1404dd0d7264c37472d/images/svg/yahoo.svg" alt="Yahoo" style={{ width: '14px', height: '14px' }} /> Yahoo
                            </span>
                        </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <button
                            className="button primary"
                            onClick={async () => {
                                await fetchCurrentEURUSD();
                                fetchAllCurrentPrices();
                            }}
                            disabled={loadingPrices}
                            style={{ fontSize: '14px' }}
                        >
                            {loadingPrices ? '⏳ Actualizando...' : '🔄 Actualizar Precios'}
                        </button>
                    </div>
                </div>
                {
                    Object.keys(activePositions).length === 0 ? (
                        <p>No hay posiciones activas disponibles</p>
                    ) : (
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Empresa</th>
                                    <th>Acciones</th>
                                    <th>Coste Total (EUR)</th>
                                    <th>Coste Promedio</th>
                                    <th>Precio Actual</th>
                                    <th>Valor Actual (EUR)</th>
                                    <th>Ganancia pérdida</th>
                                    <th>Precio Objetivo</th>
                                    <th>Info</th>
                                    <th>Editar</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(sortPositions(activePositions)).map(([positionKey, position]) => {
                                    return (
                                        <ExpandablePositionRow
                                            key={positionKey}
                                            positionKey={positionKey}
                                            position={position}
                                            currentPrices={currentPrices}
                                            operations={operations}
                                            theme={theme}
                                            formatPrice={formatPrice}
                                            formatCurrency={formatCurrency}
                                            openModal={openModal}
                                            expandedPositions={expandedPositions}
                                            setExpandedPositions={setExpandedPositions}
                                            historicalDataCache={historicalDataCache}
                                            setHistoricalDataCache={setHistoricalDataCache}
                                            currentEURUSD={currentEURUSD}
                                            currentPortfolioId={currentPortfolioId}
                                            externalButtons={externalButtons}
                                            handleNoteClick={handleNoteClick}
                                            notesCache={notesCache}
                                            onDragStart={handleDragStart}
                                            onDragEnd={handleDragEnd}
                                            onDragOver={handleDragOver}
                                            onDrop={handleDrop}
                                            draggedPosition={draggedPosition}
                                            allPositionKeys={Object.keys(activePositions)}
                                        />
                                    );
                                })}
                            </tbody>
                        </table>
                    )
                }
            </div>

            {/* Gráfico de Inversión vs Ganancias */}
            {Object.keys(activePositions).length > 0 && chartData.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="card">
                        <h2 style={{ fontSize: '20px', marginBottom: '10px' }}>📊 Inversión vs Ganancias</h2>
                        <p style={{ fontSize: '12px', color: theme === 'dark' ? '#888' : '#64748b', marginBottom: '10px' }}>
                            Distribución del dinero invertido y ganancias obtenidas
                        </p>
                        <div style={{ width: '100%', height: '300px', marginTop: '10px' }}>
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie data={chartData} cx="50%" cy="50%" labelLine={true} label={({ name, value, percent }) => `${name}\n${(percent * 100).toFixed(1)}%`} outerRadius={90} fill="#8884d8" dataKey="value">
                                        {chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(value, name) => { const total = chartData.reduce((sum, d) => sum + d.value, 0); const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0'; return [`€${Number(value).toFixed(2)} (${percentage}%)`, name.split(':')[0]]; }}
                                        contentStyle={{ backgroundColor: theme === 'dark' ? '#2d2d2d' : '#f8fafc', border: `1px solid ${theme === 'dark' ? '#404040' : '#cbd5e1'}`, borderRadius: '4px', color: theme === 'dark' ? '#ffffff' : '#1f2937', fontSize: '12px' }}
                                        itemStyle={{ color: theme === 'dark' ? '#ffffff' : '#1f2937' }}
                                        labelStyle={{ color: theme === 'dark' ? '#ffffff' : '#1f2937' }}
                                    />
                                    <Legend formatter={(value) => value.split(':')[0]} wrapperStyle={{ paddingTop: '15px', fontSize: '12px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        {chartData.length === 1 && chartData[0].name === 'Sin datos' && (
                            <p style={{ textAlign: 'center', color: '#888', marginTop: '10px', fontSize: '12px' }}>Actualiza los precios para ver las ganancias</p>
                        )}
                    </div>

                    <div className="card">
                        <h2 style={{ fontSize: '20px', marginBottom: '10px' }}>🏷️ Contribución por Empresa</h2>
                        <p style={{ fontSize: '12px', color: theme === 'dark' ? '#888' : '#64748b', marginBottom: '10px' }}>
                            Participación de cada empresa en el valor total (último cierre)
                        </p>
                        <div style={{ width: '100%', height: '300px', marginTop: '10px' }}>
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie data={contributionChartData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" stroke={theme === 'dark' ? '#1f2937' : '#ffffff'} strokeWidth={1}>
                                        {contributionChartData.map((entry, index) => (
                                            <Cell key={`c-cell-${index}`} fill={contributionColorsMap[entry.name] || entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(value, name) => { const total = contributionChartData.reduce((sum, d) => sum + d.value, 0); const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0'; return [`€${Number(value).toFixed(2)} (${percentage}%)`, name]; }}
                                        contentStyle={{ backgroundColor: theme === 'dark' ? '#2d2d2d' : '#f8fafc', border: `1px solid ${theme === 'dark' ? '#404040' : '#cbd5e1'}`, borderRadius: '4px', color: theme === 'dark' ? '#ffffff' : '#1f2937', fontSize: '12px' }}
                                        itemStyle={{ color: theme === 'dark' ? '#ffffff' : '#1f2937' }}
                                        labelStyle={{ color: theme === 'dark' ? '#ffffff' : '#1f2937' }}
                                    />
                                    <Legend wrapperStyle={{ paddingTop: '15px', fontSize: '12px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div style={{ fontSize: '12px', color: theme === 'dark' ? '#888' : '#64748b', marginTop: '8px' }}>Fecha: {contributionDate || '—'}</div>
                    </div>
                </div>
            )}

            {/* Gráfico PnL 30 días */}
            {pnlSeries.length > 0 && (
                <div className="card" style={{ marginTop: '16px' }}>
                    <h2 style={{ fontSize: '20px', marginBottom: '10px' }}>📈 Ganancias/Pérdidas (últimos 30 días)</h2>
                    <p style={{ fontSize: '12px', color: theme === 'dark' ? '#888' : '#64748b', marginBottom: '10px' }}>
                        Evolución diaria del PnL total (EUR)
                    </p>
                    <div style={{ width: '100%', height: '300px', marginTop: '10px' }}>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={pnlSeries} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                                <CartesianGrid stroke={theme === 'dark' ? '#1f2937' : '#e5e7eb'} strokeDasharray="3 3" />
                                <XAxis dataKey="date" tick={{ fill: theme === 'dark' ? '#9ca3af' : '#475569', fontSize: 12 }} />
                                <YAxis tick={{ fill: theme === 'dark' ? '#9ca3af' : '#475569', fontSize: 12 }} />
                                <Tooltip contentStyle={{ backgroundColor: theme === 'dark' ? '#2d2d2d' : '#f8fafc', border: `1px solid ${theme === 'dark' ? '#404040' : '#cbd5e1'}`, borderRadius: '4px', color: theme === 'dark' ? '#ffffff' : '#1f2937', fontSize: '12px' }} itemStyle={{ color: theme === 'dark' ? '#ffffff' : '#1f2937' }} labelStyle={{ color: theme === 'dark' ? '#ffffff' : '#1f2937' }} formatter={(value) => [`€${Number(value).toFixed(2)}`, 'PnL']} />
                                <Line type="monotone" dataKey="pnlEUR" stroke="#60a5fa" dot={false} strokeWidth={2} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}
        </>
    );
}

export default PortfolioSummary;
