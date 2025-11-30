import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { operationsAPI, configAPI, positionsAPI, pricesAPI, notesAPI, portfolioAPI, profilePicturesAPI, externalButtonsAPI } from './services/api.js';
import { logout, verifySession, changePassword, authenticatedFetch } from './services/auth.js';
import ProfilePictureModal from './components/ProfilePictureModal.jsx';
import ExternalButtonsModal from './components/ExternalButtonsModal.jsx';
import Reports from './components/Reports.jsx';
import StockHistoryChart from './components/StockHistoryChart.jsx';
import PnLChart from './components/PnLChart.jsx';
import { usePositionOrder } from './usePositionOrder.jsx';
import { useInitialData } from './hooks/useInitialData.jsx';

function App() {
  const navigate = useNavigate();

  const {
    theme, setTheme,
    operations, setOperations,
    finnhubApiKey, setFinnhubApiKey,
    currentPrices, setCurrentPrices,
    loadingPrices, setLoadingPrices,
    currentEURUSD, setCurrentEURUSD,
    currentEURUSDSource, setCurrentEURUSDSource,
    loadingData, setLoadingData,
    currentUser, setCurrentUser,
    profilePictureUrl, setProfilePictureUrl,
    lastUpdatedAt, setLastUpdatedAt,
    portfolios, setPortfolios,
    currentPortfolioId, setCurrentPortfolioId,
    contributionChartData, setContributionChartData,
    contributionDate, setContributionDate,
    pnlSeries, setPnlSeries,
    dailyCloseLastRun, setDailyCloseLastRun,
    externalButtons, setExternalButtons,
    getUserInitial,
    fetchProfilePicture,
    fetchCurrentEURUSD,
    switchPortfolio,
    markFavorite,
    getActivePositions,
    computeCurrentNetPnL,
  } = useInitialData();
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showReports, setShowReports] = useState(false); // Estado para mostrar reportes
  const [editingOperation, setEditingOperation] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [tempDeletePassword, setTempDeletePassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [priceError, setPriceError] = useState('');
  const [currentPrice, setCurrentPrice] = useState(null);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [missingApiKeyWarning, setMissingApiKeyWarning] = useState(false); // Warning for missing API key in ConfigModal
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showSelectPositionModal, setShowSelectPositionModal] = useState(false);
  const [showPortfolioMenu, setShowPortfolioMenu] = useState(false);
  const [formData, setFormData] = useState({
    company: '',
    shares: '',
    price: '',
    currency: 'EUR',
    exchangeRate: '1',
    commission: '0',
    date: new Date().toISOString().split('T')[0],
    externalSymbol1: '',
    externalSymbol2: '',
    externalSymbol3: ''
  });

  const [showNoteModal, setShowNoteModal] = useState(false);
  const [notePositionKey, setNotePositionKey] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteOriginalContent, setNoteOriginalContent] = useState(''); // For cancel functionality
  const [noteEditMode, setNoteEditMode] = useState(false); // false = read mode, true = edit mode
  const [showMarkdownHelp, setShowMarkdownHelp] = useState(false); // Markdown help guide
  const [noteLoading, setNoteLoading] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const [notesCache, setNotesCache] = useState({});
  const [showUserMenu, setShowUserMenu] = useState(false); // Nuevo estado para el menú de usuario
  const [showProfilePictureModal, setShowProfilePictureModal] = useState(false); // Nuevo estado para el modal de imagen de perfil
  const [showExternalButtonsModal, setShowExternalButtonsModal] = useState(false);
  const [expandedPositions, setExpandedPositions] = useState({}); // Track which positions are expanded



  // Hook para reordenamiento de posiciones
  const {
    sortPositions,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop,
    draggedPosition
  } = usePositionOrder(operations);



  // Cerrar menú de usuario al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showUserMenu && !event.target.closest('.user-menu-container')) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserMenu]);




















  // Cerrar sugerencias al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showSuggestions && !event.target.closest('.search-container')) {
        setShowSuggestions(false);
      }
    };

    if (showSuggestions) {
      document.addEventListener('click', handleClickOutside);
      return () => {
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [showSuggestions]);











          const finnhubSymbol = finnhubExchange ? `${symbol}.${finnhubExchange}` : symbol;

          const response = await fetch(
            `https://finnhub.io/api/v1/quote?symbol=${finnhubSymbol}&token=${finnhubApiKey}`
          );

          if (response.ok) {
            const data = await response.json();
            if (!data.error && data.c && data.c > 0) {
              priceData = {
                price: data.c,
                change: data.d,
                changePercent: data.dp,
                high: data.h,
                low: data.l,
                open: data.o,
                previousClose: data.pc,
                symbol: finnhubSymbol,
                source: 'finnhub',
                updatedAt: new Date().toISOString()
              };
            }
          }
        } catch (error) {
          console.log('Finnhub falló, intentando Yahoo Finance...');
        }
      }

      // Si Finnhub no funcionó, intentar con Yahoo Finance
      // Usar el exchange correcto para Yahoo (F para Frankfurt, MC para Madrid)
      if (!priceData) {
        try {
          priceData = await fetchPriceFromYahoo(symbolPart, yahooExchange);
          usedYahoo = true;
        } catch (yahooError) {
          throw new Error('No se encontraron datos en Finnhub ni en Yahoo Finance. Verifica el símbolo y exchange.');
        }
      }

      // Actualizar el precio en el formulario
      setFormData(prev => ({
        ...prev,
        price: priceData.price.toString(),
      }));

      setCurrentPrice(priceData);

      if (usedYahoo) {
        setPriceError(''); // Limpiar error si Yahoo funcionó
      }

    } catch (error) {
      setPriceError(error.message || 'Error al consultar el precio');
      console.error('Error fetching price:', error);
    } finally {
      setLoadingPrice(false);
    }
  };

























  // Calcular datos para el gráfico de inversión vs ganancias
  const getInvestmentChartData = () => {
    const activePositions = getActivePositions();
    let totalInvested = 0;
    let totalGained = 0;
    let totalLost = 0;

    // Calcular total invertido (suma de todos los costes)
    Object.values(activePositions).forEach(position => {
      totalInvested += position.totalCost;
    });

    // Calcular total ganado y perdido (suma de ganancias/pérdidas de posiciones con precios actuales)
    Object.entries(activePositions).forEach(([positionKey, position]) => {
      // Filtrar operaciones que coincidan con esta posición específica
      const companyOperations = operations.filter(op => {
        const opKey = op.symbol ? `${op.company}|||${op.symbol}` : op.company;
        return opKey === positionKey;
      });
      const currentPriceData = currentPrices[positionKey];

      if (currentPriceData) {
        const latestOperation = companyOperations.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
        // Usar la moneda de las operaciones de compra (más confiable)
        const purchases = companyOperations.filter(op => op.type === 'purchase');
        let currency = latestOperation?.currency || 'EUR';
        if (purchases.length > 0) {
          // Usar la moneda de la compra más reciente
          const latestPurchase = purchases.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
          currency = latestPurchase?.currency || currency;
        }

        const currentValueInBaseCurrency = position.shares * currentPriceData.price;

        // Convertir a EUR usando el tipo de cambio ACTUAL
        let currentValueInEUR;
        if (currency === 'EUR') {
          currentValueInEUR = currentValueInBaseCurrency;
        } else if (currency === 'USD') {
          // Usar el tipo de cambio EUR/USD actual
          // currentEURUSD es cuántos EUR por 1 USD (ej: 0.92)
          // Para convertir USD a EUR: valor en USD × EUR por USD
          const eurPerUsd = currentEURUSD || 0.92; // Fallback si no está disponible (aprox 0.92)
          currentValueInEUR = currentValueInBaseCurrency * eurPerUsd;
        } else {
          // Para otras monedas, calcular el tipo de cambio promedio ponderado de compra como fallback
          const purchases = companyOperations.filter(op => op.type === 'purchase');
          let weightedExchangeRate = 1;
          if (purchases.length > 0) {
            let totalShares = 0;
            let totalExchangeRateWeighted = 0;
            purchases.forEach(purchase => {
              totalShares += purchase.shares;
              totalExchangeRateWeighted += purchase.shares * purchase.exchangeRate;
            });
            weightedExchangeRate = totalShares > 0 ? totalExchangeRateWeighted / totalShares : latestOperation.exchangeRate;
          }
          currentValueInEUR = currentValueInBaseCurrency * weightedExchangeRate;
        }

        const profitLossInEUR = currentValueInEUR - position.totalCost;

        // Sumar ganancias y pérdidas por separado
        if (profitLossInEUR > 0) {
          totalGained += profitLossInEUR;
        } else if (profitLossInEUR < 0) {
          totalLost += Math.abs(profitLossInEUR); // Guardar como valor absoluto para mostrar
        }
      }
    });

    // Calcular resultado neto: ganancias - pérdidas
    const netResult = totalGained - totalLost;

    const data = [];

    // Añadir sección de invertido
    if (totalInvested > 0) {
      data.push({
        name: `Invertido: €${totalInvested.toFixed(2)}`,
        value: totalInvested,
        color: theme === 'dark' ? '#3b82f6' : '#60a5fa'
      });
    }

    // Añadir sección de ganado o perdido según el resultado neto
    if (netResult > 0) {
      // Si el resultado neto es positivo, mostrar como ganancias
      data.push({
        name: `Ganado: €${netResult.toFixed(2)}`,
        value: netResult,
        color: theme === 'dark' ? '#10b981' : '#34d399'
      });
    } else if (netResult < 0) {
      // Si el resultado neto es negativo, mostrar como pérdidas
      data.push({
        name: `Perdido: €${Math.abs(netResult).toFixed(2)}`,
        value: Math.abs(netResult),
        color: theme === 'dark' ? '#ef4444' : '#f87171'
      });
    }

    // Si no hay datos, mostrar mensaje
    if (data.length === 0) {
      data.push({
        name: 'Sin datos',
        value: 1,
        color: '#94a3b8'
      });
    }

    return data;
  };

  const computeCurrentNetPnL = () => {
    const activePositions = getActivePositions();
    let netSum = 0;
    let usedCount = 0;

    Object.entries(activePositions).forEach(([positionKey, position]) => {
      const companyOperations = operations.filter(op => {
        const opKey = op.symbol ? `${op.company}|||${op.symbol}` : op.company;
        return opKey === positionKey;
      });
      const currentPriceData = currentPrices[positionKey];
      if (!currentPriceData) return;

      const purchases = companyOperations.filter(op => op.type === 'purchase');
      let currency = purchases.length > 0 ? (purchases.sort((a, b) => new Date(b.date) - new Date(a.date))[0].currency || 'EUR') : 'EUR';

      const currentValueInBaseCurrency = position.shares * currentPriceData.price;
      let rate = 1;
      if (currency === 'USD') {
        const eurPerUsd = currentEURUSD || 0.92;
        rate = eurPerUsd;
      } else if (currency !== 'EUR') {
        let totalShares = 0;
        let totalExchangeRateWeighted = 0;
        purchases.forEach(purchase => {
          totalShares += purchase.shares;
          totalExchangeRateWeighted += purchase.shares * (purchase.exchangeRate || 1);
        });
        rate = totalShares > 0 ? (totalExchangeRateWeighted / totalShares) : (purchases[0]?.exchangeRate || 1);
      }

      const currentValueInEUR = currentValueInBaseCurrency * rate;
      const costEUR = Number.isFinite(position.totalCost) ? position.totalCost : 0;
      const profitLossInEUR = currentValueInEUR - costEUR;
      netSum += profitLossInEUR;
      usedCount += 1;
    });

    return { net: netSum, count: usedCount };
  };

  const stats = getStats();
  const activePositions = getActivePositions();
  const closedOperations = getClosedOperations();
  const chartData = getInvestmentChartData();

  // Mostrar indicador de carga mientras se cargan los datos
  if (loadingData) {
    return (
      <div className="container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>⏳</div>
          <div style={{ fontSize: '18px', color: theme === 'dark' ? '#888' : '#64748b' }}>Cargando datos...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      {/* Header */}
      <div className="header" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        {/* Primera fila: Logo + Nombre */}
        <h1>
          <img
            src="/logo64.png"
            alt="Logo"
            style={{
              width: '48px',
              height: '48px',
              marginRight: '10px',
              verticalAlign: 'middle'
            }}
          />
          Stocks Manager
        </h1>
        {/* Segunda fila: Botones */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Selector de Portafolio */}
            <span style={{ marginRight: '8px', position: 'relative' }}>
              <select
                value={currentPortfolioId || ''}
                onChange={(e) => switchPortfolio(e.target.value)}
                style={{ padding: '6px', borderRadius: '4px', marginRight: '6px' }}
              >
                <option value="" disabled>Selecciona Portafolio</option>
                {portfolios.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}{currentUser?.favoritePortfolioId === p.id ? ' ⭐' : ''}
                  </option>
                ))}
              </select>
              <button
                className="button"
                onClick={() => setShowPortfolioMenu(v => !v)}
              >
                ⚙️ Portafolios
              </button>
              {showPortfolioMenu && (
                <div className="user-dropdown-menu" style={{ position: 'absolute', top: '36px', left: '0' }}>
                  <button
                    className="dropdown-item"
                    onClick={async () => {
                      const name = window.prompt('Nombre del nuevo portafolio:');
                      if (name && name.trim()) {
                        const r = await portfolioAPI.create(name.trim());
                        if (r?.item) {
                          setPortfolios(prev => [...prev, r.item]);
                          switchPortfolio(r.item.id);
                        }
                      }
                      setShowPortfolioMenu(false);
                    }}
                  >➕ Crear</button>
                  <button
                    className="dropdown-item"
                    onClick={async () => {
                      if (!currentPortfolioId) { setShowPortfolioMenu(false); return; }
                      const cur = portfolios.find(p => p.id === currentPortfolioId);
                      const name = window.prompt('Nuevo nombre del portafolio:', cur?.name || '');
                      if (name && name.trim()) {
                        await portfolioAPI.rename(currentPortfolioId, name.trim());
                        setPortfolios(prev => prev.map(p => p.id === currentPortfolioId ? { ...p, name: name.trim() } : p));
                      }
                      setShowPortfolioMenu(false);
                    }}
                  >✏️ Renombrar</button>
                  <button
                    className="dropdown-item"
                    onClick={async () => {
                      if (!currentPortfolioId) { setShowPortfolioMenu(false); return; }
                      if (window.confirm('¿Eliminar portafolio actual? Se eliminarán también sus operaciones y datos asociados.')) {
                        await portfolioAPI.remove(currentPortfolioId);
                        const rem = portfolios.filter(p => p.id !== currentPortfolioId);
                        setPortfolios(rem);
                        const next = rem[0]?.id || null;
                        switchPortfolio(next);
                      }
                      setShowPortfolioMenu(false);
                    }}
                  >🗑️ Eliminar</button>
                  <button
                    className="dropdown-item"
                    onClick={async () => {
                      if (!currentPortfolioId) { setShowPortfolioMenu(false); return; }
                      await markFavorite(currentPortfolioId);
                      setShowPortfolioMenu(false);
                    }}
                  >⭐ Marcar favorito</button>
                </div>
              )}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button className="theme-toggle" onClick={toggleTheme}>
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button className="button" onClick={() => {
              setShowReports(!showReports);
              if (!showReports) setShowHistory(false); // Si abrimos reportes, cerramos histórico
            }}>
              {showReports ? '🏠 Portada' : '📊 Análisis'}
            </button>
            <button className="button" onClick={() => {
              setShowHistory(!showHistory);
              if (!showHistory) setShowReports(false); // Si abrimos histórico, cerramos reportes
            }}>
              {showHistory ? '🏠 Portada' : '📜 Histórico'}
            </button>
            {currentUser?.isAdmin && (
              <button className="button" onClick={() => navigate('/admin')} title="Panel de Administración">
                🛠️ Admin
              </button>
            )}


            <button className="button success" onClick={() => openModal('purchase')}>
              ➕ Comprar
            </button>
            <button className="button danger" onClick={() => {
              const activePositions = getActivePositions();
              if (Object.keys(activePositions).length === 0) {
                alert('No tienes posiciones activas para vender');
                return;
              }
              setShowSelectPositionModal(true);
            }}>
              ➖ Vender
            </button>
            <div className="user-menu-container">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="user-initial-button"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: '20px' }}
              >
                {profilePictureUrl ? (
                  <img
                    src={profilePictureUrl}
                    alt="Profile"
                    style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#404040', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', fontSize: '14px' }}>
                    {getUserInitial()}
                  </div>
                )}
                {currentUser && (
                  <span style={{ fontSize: '14px' }}>
                    {currentUser.username}
                  </span>
                )}
              </button>
              {showUserMenu && (
                <div className="user-dropdown-menu">
                  <button onClick={generateFullCSV} className="dropdown-item">📊 Exportar CSV</button>
                  <button onClick={() => {
                    setShowConfigModal(true);
                    setShowUserMenu(false);
                  }} className="dropdown-item">⚙️ Config</button>
                  <button onClick={() => {
                    setShowExternalButtonsModal(true);
                    setShowUserMenu(false);
                  }} className="dropdown-item">🔗 Botones Externos</button>
                  <button onClick={() => {
                    setShowProfilePictureModal(true);
                    setShowUserMenu(false);
                  }} className="dropdown-item">👤 Perfil</button>
                  <button onClick={() => {
                    logout();
                    navigate('/login');
                    setShowUserMenu(false);
                  }} className="dropdown-item">🚪 Salir</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showReports ? (
        <Reports
          operations={operations.filter(op => op.portfolioId === currentPortfolioId)}
          currentPrices={currentPrices}
          currentEURUSD={currentEURUSD}
          portfolioId={currentPortfolioId}
          theme={theme}
        />
      ) : !showHistory ? (
        <>
          {/* Estadísticas */}
          <div className="stats">
            <div className="stat-item">
              <div className="stat-value">€{stats.totalValue.toFixed(2)}</div>
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
                    <span>💱 1 USD = {currentEURUSD.toFixed(4)} EUR</span>
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
            {Object.keys(activePositions).length === 0 ? (
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
                  {Object.entries(activePositions).map(([positionKey, position]) => {
                    // Extraer nombre de empresa y símbolo de la clave
                    const company = position.company || positionKey.split('|||')[0];
                    const symbol = position.symbol || '';

                    // Filtrar operaciones que coincidan con empresa Y símbolo
                    const companyOperations = operations.filter(op => {
                      const opKey = op.symbol ? `${op.company}|||${op.symbol}` : op.company;
                      return opKey === positionKey;
                    });

                    const currentPriceData = currentPrices[positionKey];
                    const avgCostPerShare = position.shares > 0 ? position.totalOriginalCost / position.shares : 0;

                    // Obtener la moneda de las operaciones de compra (más confiable que inferir del exchange)
                    // Usar la moneda de la última operación, o calcular promedio ponderado si hay múltiples compras
                    const latestOperation = companyOperations.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
                    let currency = latestOperation?.currency || 'EUR';

                    // Si hay múltiples compras, usar la moneda más común (o la de la última si todas son iguales)
                    const purchases = companyOperations.filter(op => op.type === 'purchase');
                    if (purchases.length > 0) {
                      // Usar la moneda de la compra más reciente
                      const latestPurchase = purchases.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
                      currency = latestPurchase?.currency || currency;
                    }

                    // Calcular tipo de cambio promedio ponderado para operaciones de compra (usado para el coste histórico)
                    let weightedExchangeRatePurchase = 1;
                    if (currency !== 'EUR') {
                      const purchases = companyOperations.filter(op => op.type === 'purchase');
                      if (purchases.length > 0) {
                        let totalShares = 0;
                        let totalExchangeRateWeighted = 0;
                        purchases.forEach(purchase => {
                          totalShares += purchase.shares;
                          totalExchangeRateWeighted += purchase.shares * purchase.exchangeRate;
                        });
                        weightedExchangeRatePurchase = totalShares > 0 ? totalExchangeRateWeighted / totalShares : latestOperation.exchangeRate;
                      } else {
                        weightedExchangeRatePurchase = latestOperation?.exchangeRate || 1;
                      }
                    }

                    // Calcular valores
                    let currentValueInBaseCurrency = null;
                    let currentValueInEUR = null;
                    let profitLossInEUR = null;
                    let profitLossPercent = null;

                    if (currentPriceData) {
                      // Precio actual está en la moneda de la acción (ej: USD para acciones de NASDAQ)
                      // Calcular valor actual en la moneda base
                      currentValueInBaseCurrency = position.shares * currentPriceData.price;

                      // Convertir a EUR usando el tipo de cambio ACTUAL (no el histórico)
                      // Si la moneda es EUR, no hay conversión
                      // Si es USD u otra moneda, usar el tipo de cambio EUR/USD actual
                      if (currency === 'EUR') {
                        currentValueInEUR = currentValueInBaseCurrency;
                      } else if (currency === 'USD') {
                        // Usar el tipo de cambio EUR/USD actual
                        // currentEURUSD es cuántos EUR por 1 USD (ej: 0.92)
                        // Para convertir USD a EUR: valor en USD × EUR por USD
                        const eurPerUsd = currentEURUSD || 0.92; // Fallback si no está disponible (aprox 0.92)
                        currentValueInEUR = currentValueInBaseCurrency * eurPerUsd;
                      } else {
                        // Para otras monedas, usar el tipo de cambio promedio ponderado como fallback
                        currentValueInEUR = currentValueInBaseCurrency * weightedExchangeRatePurchase;
                      }

                      // Ganancia/pérdida = Valor actual en EUR (con tipo de cambio actual) - Coste total en EUR (con tipo de cambio de compra + comisiones)
                      // position.totalCost ya incluye todas las comisiones de las compras
                      profitLossInEUR = currentValueInEUR - position.totalCost;

                      // Porcentaje de ganancia/pérdida
                      profitLossPercent = position.totalCost > 0
                        ? (profitLossInEUR / position.totalCost) * 100
                        : 0;
                    }

                    return (
                      <React.Fragment key={positionKey}>
                        <tr
                          draggable="true"
                          onDragStart={(e) => handleDragStart(e, positionKey)}
                          onDragEnd={handleDragEnd}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, positionKey, Object.keys(activePositions))}
                          className={`position-row ${draggedPosition === positionKey ? 'dragging' : ''}`}
                        >
                          <td>
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedPositions(prev => ({
                                  ...prev,
                                  [positionKey]: !prev[positionKey]
                                }));
                              }}
                              style={{
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                userSelect: 'none'
                              }}
                            >
                              <span style={{
                                display: 'inline-block',
                                width: '0',
                                height: '0',
                                borderLeft: '5px solid transparent',
                                borderRight: '5px solid transparent',
                                borderTop: '6px solid currentColor',
                                transform: expandedPositions[positionKey] ? 'rotate(0deg)' : 'rotate(-90deg)',
                                transition: 'transform 0.2s ease',
                                opacity: 0.7
                              }}></span>
                              <span style={{ fontWeight: 'bold' }}>{company}</span>
                            </div>
                            {symbol && (
                              <div style={{ fontSize: '11px', color: '#888' }}>{symbol}</div>
                            )}
                          </td>
                          <td>{position.shares}</td>
                          <td>€{position.totalCost.toFixed(2)}</td>
                          <td>{formatCurrency(avgCostPerShare, position.currency)}</td>
                          <td>
                            {currentPriceData ? (
                              <div>
                                <div style={{ fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                  <span>{currency === 'EUR' ? '€' : '$'}{formatPrice(currentPriceData.price)}</span>
                                  {(() => {
                                    const src = currentPriceData.source;
                                    const url = src === 'finnhub' ? 'https://finnhub.io/static/img/webp/finnhub-logo.webp' : (src === 'yahoo' ? 'https://raw.githubusercontent.com/edent/SuperTinyIcons/1ee09df265d2f3764c28b1404dd0d7264c37472d/images/svg/yahoo.svg' : null);
                                    const title = src ? `${src.toUpperCase()}${currentPriceData.updatedAt ? ` • ${new Date(currentPriceData.updatedAt).toLocaleString('es-ES', { hour12: false })}` : ''}` : '';
                                    if (url) {
                                      return (
                                        <img src={url} alt={src} title={title} referrerPolicy="no-referrer" loading="lazy" style={{ width: '16px', height: '16px', verticalAlign: 'middle' }} />
                                      );
                                    }
                                    return null;
                                  })()}
                                </div>
                                {currentPriceData.change !== null && (
                                  <div style={{
                                    fontSize: '11px',
                                    color: currentPriceData.change >= 0 ? '#10b981' : '#ef4444'
                                  }}>
                                    {currentPriceData.change >= 0 ? '+' : ''}{formatPrice(currentPriceData.change)}
                                    {' '}({currentPriceData.changePercent >= 0 ? '+' : ''}{currentPriceData.changePercent.toFixed(2)}%)
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: '#888', fontSize: '12px' }}>
                                {'Sin datos'}
                              </span>
                            )}
                          </td>
                          <td>
                            {currentValueInEUR !== null ? (
                              `€${currentValueInEUR.toFixed(2)}`
                            ) : (
                              <span style={{ color: '#888' }}>-</span>
                            )}
                          </td>
                          <td>
                            {profitLossInEUR !== null ? (
                              <div style={{
                                color: profitLossInEUR >= 0 ? '#10b981' : '#ef4444',
                                fontWeight: 'bold'
                              }}>
                                {profitLossInEUR >= 0 ? '+' : ''}€{profitLossInEUR.toFixed(2)}
                                {profitLossPercent !== null && (
                                  <div style={{ fontSize: '11px' }}>
                                    ({profitLossPercent >= 0 ? '+' : ''}{profitLossPercent.toFixed(2)}%)
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: '#888' }}>-</span>
                            )}
                          </td>
                          <td>
                            {(() => {
                              const purchases = companyOperations.filter(op => op.type === 'purchase');
                              if (purchases.length === 0) return <span style={{ color: '#888' }}>-</span>;

                              const latestPurchase = purchases.sort((a, b) => new Date(b.date) - new Date(a.date))[0];

                              if (latestPurchase.targetPrice) {
                                return (
                                  <div style={{ fontWeight: 'bold', color: '#3b82f6' }}>
                                    {currency === 'EUR' ? '€' : '$'}{formatPrice(latestPurchase.targetPrice)}
                                  </div>
                                );
                              }
                              return <span style={{ color: '#888' }}>-</span>;
                            })()}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                              {externalButtons.sort((a, b) => a.displayOrder - b.displayOrder).map(button => {
                                // Buscar si hay algún símbolo configurado para este botón en alguna operación de esta empresa
                                const symbolForButton = (() => {
                                  // Buscar en las operaciones de esta empresa
                                  const op = companyOperations.find(o => o[`externalSymbol${button.displayOrder}`]);
                                  return op ? op[`externalSymbol${button.displayOrder}`] : null;
                                })();

                                if (!symbolForButton) return null;

                                return (
                                  <a
                                    key={button.id}
                                    href={`${button.baseUrl}${symbolForButton}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title={`${button.name}: ${symbolForButton}`}
                                    style={{ display: 'block' }}
                                  >
                                    <img
                                      src={button.imageUrl}
                                      alt={button.name}
                                      style={{ width: '20px', height: '20px', borderRadius: '4px', objectFit: 'cover' }}
                                    />
                                  </a>
                                );
                              })}
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '5px' }}>
                              {companyOperations.map((operation) => (
                                <button
                                  key={operation.id}
                                  className="button"
                                  onClick={() => openModal(operation.type, operation)}
                                  style={{ fontSize: '12px', padding: '5px 8px' }}
                                  title={`Editar ${operation.type === 'purchase' ? 'compra' : 'venta'}`}
                                >
                                  ✏️ {operation.type === 'purchase' ? 'C' : 'V'}
                                </button>
                              ))}
                              <button
                                className="button"
                                onClick={async () => {
                                  const pk = positionKey;
                                  setNotePositionKey(pk);
                                  setShowNoteModal(true);
                                  setNoteLoading(true);
                                  try {
                                    const r = await notesAPI.get(pk);
                                    const content = r?.content || '';
                                    setNoteContent(content);
                                    setNoteOriginalContent(content);
                                    // If note is empty, start in edit mode; otherwise start in read mode
                                    setNoteEditMode(!content || content.trim() === '');
                                    setNotesCache(prev => ({ ...prev, [pk]: !!content }));
                                  } catch (e) {
                                    setNoteContent('');
                                    setNoteOriginalContent('');
                                    setNoteEditMode(true); // Empty note, start in edit mode
                                  } finally {
                                    setNoteLoading(false);
                                  }
                                }}
                                style={{ fontSize: '12px', padding: '5px 8px' }}
                                title="Nota"
                              >
                                📝 Nota
                              </button>
                            </div>
                          </td>
                        </tr>
                        {/* Expandable row for stock history chart */}
                        {
                          expandedPositions[positionKey] && (
                            <tr className="expanded-chart-row">
                              <td colSpan="10" style={{ padding: 0, backgroundColor: theme === 'dark' ? '#1a1a1a' : '#f9fafb' }}>
                                <StockHistoryChart
                                  positionKey={positionKey}
                                  userId={currentUser?.id}
                                  portfolioId={currentPortfolioId}
                                  theme={theme}
                                />
                              </td>
                            </tr>
                          )
                        }
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table >
            )
            }
          </div >

          {/* Gráfico de Inversión vs Ganancias */}
          {
            Object.keys(activePositions).length > 0 && chartData.length > 0 && (
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
            )
          }

          {/* Operaciones Recientes */}
          {
            pnlSeries.length > 0 && (
              <div className="card" style={{ marginTop: '16px' }}>
                <h2 style={{ fontSize: '20px', marginBottom: '10px' }}>📈 Ganancias/Pérdidas (últimos 30 días)</h2>
                <p style={{ fontSize: '12px', color: theme === 'dark' ? '#888' : '#64748b', marginBottom: '10px' }}>
                  Evolución diaria del PnL total (EUR)
                </p>
                                <PnLChart data={pnlSeries} theme={theme} />
              </div>
            )
          }
          <div className="card">
            <h2>Operaciones Recientes</h2>
            {operations.length === 0 ? (
              <p>No hay operaciones registradas</p>
            ) : (
              <div>
                {operations.slice(-5).reverse().map((operation) => (
                  <div key={operation.id} style={{
                    padding: '10px',
                    margin: '5px 0',
                    border: '1px solid #404040',
                    borderRadius: '4px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <strong>{operation.type === 'purchase' ? 'Compra' : 'Venta'} - {operation.company}</strong>
                      <br />
                      {operation.shares} acciones a {formatPrice(operation.price)} {operation.currency}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div>€{operation.totalCost.toFixed(2)}</div>
                      <div style={{ fontSize: '12px', color: '#888' }}>
                        {new Date(operation.date).toLocaleDateString('es-ES')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        /* Histórico de Operaciones Cerradas */
        <div className="card">
          <h2>📜 Histórico de Operaciones Cerradas</h2>

          {/* Resumen de Ganancias/Pérdidas */}
          {closedOperations.length > 0 && (
            <div className="stats" style={{ marginBottom: '20px' }}>
              <div className="stat-item">
                <div className={`stat-value ${getHistoricalProfitLoss() >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  €{getHistoricalProfitLoss().toFixed(2)}
                </div>
                <div className="stat-label">
                  {getHistoricalProfitLoss() >= 0 ? 'Ganancias Totales' : 'Pérdidas Totales'}
                </div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{closedOperations.filter(op => op.type === 'sale').length}</div>
                <div className="stat-label">Ventas Realizadas</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{closedOperations.filter(op => op.type === 'purchase').length}</div>
                <div className="stat-label">Compras Realizadas</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{new Set(closedOperations.map(op => op.company)).size}</div>
                <div className="stat-label">Empresas Cerradas</div>
              </div>
            </div>
          )}

          {closedOperations.length === 0 ? (
            <p>No hay operaciones cerradas en el historial</p>
          ) : (
            <div>
              {closedOperations
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .map((operation) => (
                  <div key={operation.id} style={{
                    padding: '10px',
                    margin: '5px 0',
                    border: '1px solid #404040',
                    borderRadius: '4px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <strong>{operation.type === 'purchase' ? 'Compra' : 'Venta'} - {operation.company}</strong>
                      <br />
                      {operation.shares} acciones a {formatPrice(operation.price)} {operation.currency}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div>€{operation.totalCost.toFixed(2)}</div>
                      <div style={{ fontSize: '12px', color: '#888' }}>
                        {new Date(operation.date).toLocaleDateString('es-ES')}
                      </div>
                      <button
                        className="button"
                        onClick={() => openModal(operation.type, operation)}
                        style={{ fontSize: '12px', padding: '5px 8px', marginTop: '5px' }}
                        title={`Editar ${operation.type === 'purchase' ? 'compra' : 'venta'}`}
                      >
                        ✏️ Editar
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )
      }

      {/* Modal */}
      {
        showModal && (
          <div className="modal">
            <div className="modal-content">
              <h2>{editingOperation ? `Editar ${modalType === 'purchase' ? 'Compra' : 'Venta'}` : `${modalType === 'purchase' ? 'Nueva Compra' : 'Nueva Venta'}`}</h2>
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>Buscar Empresa por Nombre:</label>
                  <div className="search-container" style={{ position: 'relative' }}>
                    <input
                      type="text"
                      className="input"
                      placeholder="Busca por nombre (ej: Apple, Microsoft, AMD, NXT...)"
                      value={searchQuery}
                      onChange={(e) => {
                        const query = e.target.value;
                        setSearchQuery(query);
                        if (query.length >= 2) {
                          searchCompanies(query);
                        } else {
                          setSearchResults([]);
                          setShowSuggestions(false);
                        }
                      }}
                      onFocus={() => {
                        if (searchResults.length > 0) {
                          setShowSuggestions(true);
                        }
                      }}
                    />
                    {loadingSearch && (
                      <span style={{ position: 'absolute', right: '10px', top: '10px' }}>⏳</span>
                    )}

                    {/* Dropdown de sugerencias */}
                    {showSuggestions && searchResults.length > 0 && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        backgroundColor: theme === 'dark' ? '#2d2d2d' : '#ffffff',
                        border: `1px solid ${theme === 'dark' ? '#404040' : '#d0d0d0'}`,
                        borderRadius: '4px',
                        marginTop: '5px',
                        maxHeight: '300px',
                        overflowY: 'auto',
                        zIndex: 1000,
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                      }}>
                        {searchResults.map((company, index) => (
                          <div
                            key={index}
                            onClick={() => selectCompany(company)}
                            style={{
                              padding: '10px',
                              cursor: 'pointer',
                              borderBottom: `1px solid ${theme === 'dark' ? '#404040' : '#e0e0e0'}`,
                              transition: 'background-color 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.backgroundColor = theme === 'dark' ? '#404040' : '#f0f0f0';
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.backgroundColor = 'transparent';
                            }}
                          >
                            <div style={{ fontWeight: 'bold' }}>
                              {company.description || company.symbol.split('.')[0] || company.symbol}
                            </div>
                            <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>
                              <strong>{company.symbol.includes('.') ? company.symbol.replace('.', ':') : company.symbol}</strong>
                              {company.exchange && company.exchange !== company.symbol.split('.')[1] && ` · ${company.exchange}`}
                              {company.type && ` · ${company.type}`}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <p style={{ fontSize: '12px', color: '#888', marginTop: '5px' }}>
                    O ingresa directamente el símbolo con exchange: AMD:FRA, NXT:BME, MSFT:NASDAQ, etc.
                  </p>
                </div>

                <div className="form-row">
                  <div className="form-group" style={{ flex: 2 }}>
                    <label>Empresa:</label>
                    <input
                      type="text"
                      name="company"
                      value={formData.company}
                      onChange={handleInputChange}
                      className="input"
                      placeholder="Nombre de la empresa"
                      required
                    />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Símbolo (Ticker):</label>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <input
                        type="text"
                        id="ticker-symbol"
                        className="input"
                        placeholder="AAPL, MSFT:NASDAQ, AMD:FRA..."
                        style={{ flex: 1 }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const symbol = e.target.value;
                            if (symbol) fetchCurrentPrice(symbol);
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="button primary"
                        onClick={() => {
                          const symbol = document.getElementById('ticker-symbol')?.value;
                          if (symbol) fetchCurrentPrice(symbol);
                        }}
                        disabled={loadingPrice}
                        style={{ whiteSpace: 'nowrap' }}
                        title="Consultar precio actual desde Finnhub"
                      >
                        {loadingPrice ? '⏳' : '🔍'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Mostrar información del precio consultado solo si se consulta manualmente */}
                {currentPrice && !editingOperation && (
                  <div style={{
                    padding: '10px',
                    marginBottom: '10px',
                    backgroundColor: '#28a745',
                    borderRadius: '4px',
                    color: 'white'
                  }}>
                    <strong>Precio actual consultado:</strong> ${formatPrice(currentPrice.price)}
                    {currentPrice.change !== null && (
                      <span style={{ marginLeft: '10px' }}>
                        ({currentPrice.change >= 0 ? '+' : ''}{formatPrice(currentPrice.change)}
                        {' '}({currentPrice.changePercent >= 0 ? '+' : ''}{currentPrice.changePercent.toFixed(2)}%))
                      </span>
                    )}
                  </div>
                )}

                {/* Mostrar error si hay */}
                {priceError && (
                  <div style={{
                    padding: '10px',
                    marginBottom: '10px',
                    backgroundColor: '#dc3545',
                    borderRadius: '4px',
                    color: 'white'
                  }}>
                    <strong>Error:</strong> {priceError}
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label>Número de Títulos:</label>
                    {modalType === 'sale' && formData.company && (() => {
                      const positions = getPositions();
                      const availableShares = positions[formData.company]?.shares || 0;
                      return (
                        <div style={{ marginBottom: '5px', fontSize: '12px', color: '#888' }}>
                          Acciones disponibles: <strong>{availableShares}</strong>
                          {availableShares > 0 && (
                            <span style={{ marginLeft: '10px', color: '#007bff' }}>
                              (Puedes vender menos acciones)
                            </span>
                          )}
                        </div>
                      );
                    })()}
                    <input
                      type="number"
                      name="shares"
                      value={formData.shares}
                      onChange={handleInputChange}
                      className="input"
                      min="1"
                      max={modalType === 'sale' && formData.company ? (() => {
                        const positions = getPositions();
                        const tickerSymbol = document.getElementById('ticker-symbol')?.value || '';
                        const positionKey = tickerSymbol ? `${formData.company}|||${tickerSymbol}` : formData.company;
                        return positions[positionKey]?.shares || 0;
                      })() : undefined}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Precio por Acción:</label>
                    <input
                      type="number"
                      name="price"
                      value={formData.price}
                      onChange={handleInputChange}
                      className="input"
                      step="0.00000001"
                      min="0"
                      required
                      placeholder={currentPrice ? `Precio consultado: ${formatPrice(currentPrice.price)}` : ''}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Moneda:</label>
                    <select
                      name="currency"
                      value={formData.currency}
                      onChange={handleInputChange}
                      className="input"
                    >
                      <option value="EUR">EUR</option>
                      <option value="USD">USD</option>
                      <option value="GBP">GBP</option>
                      <option value="CAD">CAD</option>
                      <option value="JPY">JPY</option>
                    </select>
                  </div>
                  {formData.currency !== 'EUR' && (
                    <div className="form-group">
                      <label>Tipo de Cambio (EUR/{formData.currency}):</label>
                      <input
                        type="number"
                        name="exchangeRate"
                        value={formData.exchangeRate}
                        onChange={handleInputChange}
                        className="input"
                        step="0.00000001"
                        min="0"
                        required
                      />
                    </div>
                  )}
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Comisiones:</label>
                    <input
                      type="number"
                      name="commission"
                      value={formData.commission}
                      onChange={handleInputChange}
                      className="input"
                      step="0.00000001"
                      min="0"
                    />
                  </div>
                  <div className="form-group">
                    <label>Fecha:</label>
                    <input
                      type="date"
                      name="date"
                      value={formData.date}
                      onChange={handleInputChange}
                      className="input"
                      required
                    />
                  </div>
                </div>

                {/* Campos dinámicos para botones externos */}
                {externalButtons.length > 0 && (
                  <div className="form-row">
                    {externalButtons.sort((a, b) => a.displayOrder - b.displayOrder).map(button => (
                      <div key={button.id} className="form-group" style={{ flex: 1 }}>
                        <label>{button.name}:</label>
                        <input
                          type="text"
                          name={`externalSymbol${button.displayOrder}`}
                          value={formData[`externalSymbol${button.displayOrder}`] || ''}
                          onChange={handleInputChange}
                          className="input"
                          placeholder="Símbolo"
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div className="form-group">
                  <label>Precio Objetivo (Opcional):</label>
                  <input
                    type="number"
                    name="targetPrice"
                    value={formData.targetPrice}
                    onChange={handleInputChange}
                    className="input"
                    step="0.00000001"
                    min="0"
                    placeholder="Precio al que esperas vender"
                  />
                  <p style={{ fontSize: '12px', color: '#888', marginTop: '5px' }}>
                    Ingresa el precio objetivo al que planeas vender esta acción
                  </p>
                </div>

                <div style={{ marginTop: '20px' }}>
                  <button type="submit" className={`button ${modalType === 'purchase' ? 'success' : 'danger'}`}>
                    {editingOperation ? 'Guardar Cambios' : (modalType === 'purchase' ? 'Comprar' : 'Vender')}
                  </button>
                  <button type="button" className="button" onClick={closeModal}>
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* Modal de Confirmación de Borrado con Contraseña */}
      {
        showDeleteConfirm && (
          <div className="modal">
            <div className="modal-content">
              <h2>⚠️ Confirmar Borrado de Datos</h2>
              <p style={{ marginBottom: '20px', color: '#dc3545', fontWeight: 'bold' }}>
                Esta acción borrará TODAS las operaciones guardadas. Esta acción NO se puede deshacer.
              </p>
              <div className="form-group">
                <label>Ingresa la contraseña para confirmar el borrado:</label>
                <input
                  type="password"
                  value={tempDeletePassword}
                  onChange={(e) => setTempDeletePassword(e.target.value)}
                  className="input"
                  placeholder="Escribe tu contraseña para confirmar"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      confirmDeleteWithPassword();
                    }
                  }}
                />
              </div>
              <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="button danger"
                  onClick={confirmDeleteWithPassword}
                  disabled={!tempDeletePassword}
                >
                  🗑️ Confirmar Borrado
                </button>
                <button type="button" className="button" onClick={cancelDelete}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Modal de Selección de Posición para Vender */}
      {
        showSelectPositionModal && (
          <div className="modal">
            <div className="modal-content">
              <h2>📊 Seleccionar Posición para Vender</h2>
              <p style={{ marginBottom: '20px', fontSize: '14px', color: '#888' }}>
                Selecciona una posición activa para vender acciones. Puedes vender una cantidad parcial.
              </p>
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {Object.keys(getActivePositions()).length === 0 ? (
                  <p>No hay posiciones activas disponibles</p>
                ) : (
                  <div>
                    {Object.entries(getActivePositions()).map(([positionKey, position]) => {
                      const company = position.company || positionKey.split('|||')[0];
                      const symbol = position.symbol || '';

                      // Filtrar operaciones que coincidan con esta posición
                      const companyOperations = operations.filter(op => {
                        const opKey = op.symbol ? `${op.company}|||${op.symbol}` : op.company;
                        return opKey === positionKey;
                      });

                      const avgCostPerShare = position.shares > 0 ? position.totalOriginalCost / position.shares : 0;
                      const currentPriceData = currentPrices[positionKey];

                      return (
                        <div
                          key={positionKey}
                          onClick={() => selectPositionForSale(positionKey, position.shares)}
                          style={{
                            padding: '15px',
                            margin: '10px 0',
                            border: `2px solid ${theme === 'dark' ? '#404040' : '#d0d0d0'}`,
                            borderRadius: '8px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            backgroundColor: theme === 'dark' ? '#2d2d2d' : '#ffffff'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = '#007bff';
                            e.currentTarget.style.backgroundColor = theme === 'dark' ? '#404040' : '#f0f0f0';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = theme === 'dark' ? '#404040' : '#d0d0d0';
                            e.currentTarget.style.backgroundColor = theme === 'dark' ? '#2d2d2d' : '#ffffff';
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '5px' }}>
                                {company}
                              </div>
                              {symbol && (
                                <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>
                                  {symbol}
                                </div>
                              )}
                              <div style={{ display: 'flex', gap: '15px', fontSize: '14px' }}>
                                <div>
                                  <strong>Acciones disponibles:</strong> {position.shares}
                                </div>
                                <div>
                                  <strong>Coste promedio:</strong> {formatCurrency(avgCostPerShare, position.currency)}
                                </div>
                                <div>
                                  <strong>Coste total:</strong> €{position.totalCost.toFixed(2)}
                                </div>
                              </div>
                              {currentPriceData && (() => {
                                // Usar la moneda de las operaciones de compra
                                const purchases = companyOperations.filter(op => op.type === 'purchase');
                                let positionCurrency = 'EUR';
                                if (purchases.length > 0) {
                                  const latestPurchase = purchases.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
                                  positionCurrency = latestPurchase?.currency || 'EUR';
                                }
                                return (
                                  <div style={{ marginTop: '8px', fontSize: '13px', color: '#888' }}>
                                    Precio actual: <strong style={{ color: currentPriceData.change >= 0 ? '#10b981' : '#ef4444' }}>
                                      {positionCurrency === 'EUR' ? '€' : '$'}{formatPrice(currentPriceData.price)}
                                    </strong>
                                    {' '}({currentPriceData.change >= 0 ? '+' : ''}{currentPriceData.changePercent.toFixed(2)}%)
                                  </div>
                                );
                              })()}
                            </div>
                            <div style={{ marginLeft: '15px', fontSize: '24px' }}>
                              →
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="button"
                  onClick={() => setShowSelectPositionModal(false)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )
      }

      {
        showNoteModal && (
          <div className="modal">
            <div className="modal-content" style={{ maxWidth: '900px', width: '100%' }}>
              <h2>📝 Nota</h2>

              {noteEditMode ? (
                // Edit Mode: Show only textarea (no preview to avoid multiple scrollbars)
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Markdown</label>
                  <textarea
                    className="input"
                    style={{ minHeight: '300px', width: '100%', resize: 'vertical' }}
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    disabled={noteLoading || noteSaving}
                    placeholder="# Título\n\nEscribe tu nota en Markdown..."
                  />
                </div>
              ) : (
                // Read Mode: Show only preview (use modal's scrollbar, not card's)
                <div className="card" style={{ width: '100%' }}>
                  <div dangerouslySetInnerHTML={{ __html: markdownToHtml(noteContent || '') }} />
                </div>
              )}

              <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
                {noteEditMode ? (
                  // Edit mode buttons: Save, Cancel, and Help
                  <>
                    <button
                      className="button primary"
                      disabled={noteLoading || noteSaving}
                      onClick={async () => {
                        try {
                          setNoteSaving(true);
                          await notesAPI.upsert(notePositionKey, noteContent || '');
                          setNotesCache(prev => ({ ...prev, [notePositionKey]: !!(noteContent) }));
                          setNoteOriginalContent(noteContent);
                          setNoteEditMode(false); // Switch to read mode to see the result
                        } catch (e) {
                          alert('Error guardando nota');
                        } finally {
                          setNoteSaving(false);
                        }
                      }}
                    >
                      Guardar
                    </button>
                    <button
                      className="button"
                      onClick={() => {
                        setNoteContent(noteOriginalContent);
                        if (noteOriginalContent && noteOriginalContent.trim()) {
                          setNoteEditMode(false); // Return to read mode if there was content
                        } else {
                          setShowNoteModal(false); // Close if it was empty
                        }
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      className="button"
                      onClick={() => setShowMarkdownHelp(true)}
                      style={{ marginLeft: 'auto' }}
                      title="Guía de Markdown"
                    >
                      ❓ Ayuda
                    </button>
                  </>
                ) : (
                  // Read mode buttons: Edit and Close
                  <>
                    <button
                      className="button primary"
                      onClick={() => setNoteEditMode(true)}
                    >
                      Editar
                    </button>
                    <button className="button" onClick={() => setShowNoteModal(false)}>Cerrar</button>
                  </>
                )}
              </div>
            </div>
          </div>
        )
      }

      {/* Markdown Help Modal */}
      {
        showMarkdownHelp && (
          <div className="modal" style={{ zIndex: 10001 }}>
            <div className="modal-content" style={{ maxWidth: '700px', width: '100%' }}>
              <h2>📖 Guía Rápida de Markdown</h2>
              <div className="card" style={{ marginBottom: '12px' }}>
                <h3 style={{ fontSize: '18px', marginTop: 0 }}>Encabezados</h3>
                <pre style={{ background: theme === 'dark' ? '#2a2a2a' : '#f5f5f5', color: theme === 'dark' ? '#e8e8e8' : '#333', padding: '10px', borderRadius: '4px', fontSize: '13px', overflowX: 'auto' }}>{`# Título Principal (H1)\n## Título Secundario (H2)\n### Título Terciario (H3)\n#### Subtítulo (H4)`}</pre>
              </div>

              <div className="card" style={{ marginBottom: '12px' }}>
                <h3 style={{ fontSize: '18px', marginTop: 0 }}>Énfasis</h3>
                <pre style={{ background: theme === 'dark' ? '#2a2a2a' : '#f5f5f5', color: theme === 'dark' ? '#e8e8e8' : '#333', padding: '10px', borderRadius: '4px', fontSize: '13px', overflowX: 'auto' }}>{`**Texto en negrita**\n*Texto en cursiva*`}</pre>
                <div style={{ marginTop: '8px', fontSize: '14px' }}>
                  <strong>Texto en negrita</strong><br />
                  <em>Texto en cursiva</em>
                </div>
              </div>

              <div className="card" style={{ marginBottom: '12px' }}>
                <h3 style={{ fontSize: '18px', marginTop: 0 }}>Listas</h3>
                <pre style={{ background: theme === 'dark' ? '#2a2a2a' : '#f5f5f5', color: theme === 'dark' ? '#e8e8e8' : '#333', padding: '10px', borderRadius: '4px', fontSize: '13px', overflowX: 'auto' }}>{`- Elemento 1\n- Elemento 2\n- Elemento 3`}</pre>
                <div style={{ marginTop: '8px', fontSize: '14px' }}>
                  <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>
                    <li>Elemento 1</li>
                    <li>Elemento 2</li>
                    <li>Elemento 3</li>
                  </ul>
                </div>
              </div>

              <div className="card" style={{ marginBottom: '12px' }}>
                <h3 style={{ fontSize: '18px', marginTop: 0 }}>Enlaces</h3>
                <pre style={{ background: theme === 'dark' ? '#2a2a2a' : '#f5f5f5', color: theme === 'dark' ? '#e8e8e8' : '#333', padding: '10px', borderRadius: '4px', fontSize: '13px', overflowX: 'auto' }}>[Texto del enlace](https://ejemplo.com)</pre>
                <div style={{ marginTop: '8px', fontSize: '14px' }}>
                  <a href="https://ejemplo.com" target="_blank" rel="noopener noreferrer">Texto del enlace</a>
                </div>
              </div>

              <div className="card" style={{ marginBottom: '12px' }}>
                <h3 style={{ fontSize: '18px', marginTop: 0 }}>Código</h3>
                <pre style={{ background: theme === 'dark' ? '#2a2a2a' : '#f5f5f5', color: theme === 'dark' ? '#e8e8e8' : '#333', padding: '10px', borderRadius: '4px', fontSize: '13px', overflowX: 'auto' }}>{`Código inline: \`código aquí\`\n\nBloque de código:\n\`\`\`\nfunción ejemplo() {\n  return "Hola";\n}\n\`\`\``}</pre>
              </div>

              <div className="card" style={{ marginBottom: '12px' }}>
                <h3 style={{ fontSize: '18px', marginTop: 0 }}>Línea Horizontal</h3>
                <pre style={{ background: theme === 'dark' ? '#2a2a2a' : '#f5f5f5', color: theme === 'dark' ? '#e8e8e8' : '#333', padding: '10px', borderRadius: '4px', fontSize: '13px', overflowX: 'auto' }}>---</pre>
                <hr style={{ margin: '8px 0' }} />
              </div>

              <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                <button className="button primary" onClick={() => setShowMarkdownHelp(false)}>
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )
      }



      {/* Modal de Imagen de Perfil */}
      {
        showProfilePictureModal && (
          <ProfilePictureModal
            show={true}
            onClose={() => setShowProfilePictureModal(false)}
            onUploadSuccess={() => {
              setShowProfilePictureModal(false);
            }}
            onDeleteSuccess={() => {
              setShowProfilePictureModal(false);
            }}
            currentProfilePictureUrl={profilePictureUrl}
            fetchProfilePicture={fetchProfilePicture}
          />
        )
      }

      {/* Modal de Configuración */}
      {
        showConfigModal && (
          <div className="modal">
            <div className="modal-content" style={{ maxWidth: '550px' }}>
              <h2 style={{ marginBottom: '20px', fontSize: '20px' }}>⚙️ Configuración</h2>

              {/* Sección API Key */}
              <div style={{ marginBottom: '20px', paddingBottom: '15px', borderBottom: `1px solid ${theme === 'dark' ? '#404040' : '#e0e0e0'}` }}>
                <h3 style={{ marginBottom: '8px', fontSize: '16px' }}>🔑 Finnhub API Key</h3>
                {missingApiKeyWarning && (
                  <div style={{
                    backgroundColor: 'rgba(255, 193, 7, 0.1)',
                    border: '1px solid #ffc107',
                    color: '#ffc107',
                    padding: '10px',
                    borderRadius: '4px',
                    marginBottom: '10px',
                    fontSize: '13px'
                  }}>
                    ⚠️ Necesitas configurar una API Key de Finnhub para buscar empresas.
                  </div>
                )}
                <div className="form-group" style={{ marginBottom: '10px' }}>
                  <label style={{ fontSize: '13px', marginBottom: '4px' }}>API Key:</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      value={finnhubApiKey}
                      onChange={(e) => setFinnhubApiKey(e.target.value)}
                      className="input"
                      placeholder="Introduce tu API Key de Finnhub"
                      style={{ fontSize: '14px', padding: '8px', flex: 1 }}
                    />
                    <button
                      type="button"
                      className="button primary"
                      onClick={async () => {
                        try {
                          const response = await authenticatedFetch('/api/admin/finnhub-api-key', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ value: finnhubApiKey })
                          });
                          if (response.ok) {
                            alert('✅ API Key guardada correctamente');
                            setMissingApiKeyWarning(false);
                          } else {
                            alert('❌ Error al guardar API Key');
                          }
                        } catch (e) {
                          console.error(e);
                          alert('❌ Error al guardar API Key');
                        }
                      }}
                      style={{ padding: '8px 16px', fontSize: '13px', whiteSpace: 'nowrap' }}
                    >
                      💾 Guardar
                    </button>
                  </div>
                  <p style={{ fontSize: '11px', color: '#888', marginTop: '5px' }}>
                    Obtén tu clave gratuita en <a href="https://finnhub.io/" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>finnhub.io</a>
                  </p>
                </div>
              </div>

              {/* Sección Cambiar Contraseña */}
              <div style={{ marginBottom: '20px', paddingBottom: '15px', borderBottom: `1px solid ${theme === 'dark' ? '#404040' : '#e0e0e0'}` }}>
                <h3 style={{ marginBottom: '8px', fontSize: '16px' }}>🔒 Cambiar Contraseña</h3>
                <div className="form-group" style={{ marginBottom: '10px' }}>
                  <label style={{ fontSize: '13px', marginBottom: '4px' }}>Contraseña Actual:</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="input"
                    placeholder="Contraseña actual"
                    style={{ fontSize: '14px', padding: '8px' }}
                    autoComplete="current-password"
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '10px' }}>
                  <label style={{ fontSize: '13px', marginBottom: '4px' }}>Nueva Contraseña:</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="input"
                    placeholder="Nueva contraseña (mín. 6 caracteres)"
                    style={{ fontSize: '14px', padding: '8px' }}
                    autoComplete="new-password"
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '0', display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '13px', marginBottom: '4px' }}>Confirmar Nueva:</label>
                    <input
                      type="password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      className="input"
                      placeholder="Confirma la nueva contraseña"
                      style={{ fontSize: '14px', padding: '8px' }}
                      autoComplete="new-password"
                    />
                  </div>
                  <button
                    type="button"
                    className="button primary"
                    onClick={handleChangePassword}
                    style={{ padding: '8px 16px', fontSize: '13px', whiteSpace: 'nowrap' }}
                  >
                    💾 Cambiar
                  </button>
                </div>
              </div>

              {/* Sección Borrar Datos */}
              <div style={{ marginBottom: '0' }}>
                <h3 style={{ marginBottom: '8px', fontSize: '16px' }}>🗑️ Borrar Todas las Operaciones</h3>
                <p style={{ marginBottom: '10px', fontSize: '12px', color: '#dc3545', fontWeight: 'bold' }}>
                  ⚠️ Esta acción borrará TODAS las operaciones. NO se puede deshacer.
                </p>
                <button
                  type="button"
                  className="button danger"
                  onClick={clearAllOperations}
                  style={{ fontSize: '14px', padding: '8px 16px' }}
                >
                  🗑️ Borrar Todas las Operaciones
                </button>
              </div>

              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="button"
                  onClick={() => {
                    setShowConfigModal(false);
                    setMissingApiKeyWarning(false);
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmNewPassword('');
                  }}
                  style={{ fontSize: '14px', padding: '8px 16px' }}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )
      }

      <ExternalButtonsModal
        show={showExternalButtonsModal}
        onClose={() => setShowExternalButtonsModal(false)}
        externalButtons={externalButtons}
        setExternalButtons={setExternalButtons}
      />

      <ProfilePictureModal
        show={showProfilePictureModal}
        onClose={() => setShowProfilePictureModal(false)}
        currentUser={currentUser}
        onUpdate={(url) => {
          setProfilePictureUrl(url);
          // Actualizar también el usuario actual para reflejar el cambio si es necesario
          if (currentUser) {
            setCurrentUser({ ...currentUser });
          }
        }}
      />
    </div >
  );
}

export default App;






