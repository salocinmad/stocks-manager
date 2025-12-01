import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { operationsAPI, configAPI, positionsAPI, pricesAPI, notesAPI, portfolioAPI, externalButtonsAPI } from './services/api.js';
import { logout, authenticatedFetch } from './services/auth.js';
import ProfilePictureModal from './components/ProfilePictureModal.jsx';
import ExternalButtonsModal from './components/ExternalButtonsModal.jsx';
import NoteModal from './components/NoteModal.jsx';
import DeleteConfirmModal from './components/DeleteConfirmModal.jsx';
import ConfigModal from './components/ConfigModal.jsx';
import SelectPositionModal from './components/SelectPositionModal.jsx';
import Reports from './components/Reports.jsx';
import StockHistoryChart from './components/StockHistoryChart.jsx';
import PnLChart from './components/PnLChart.jsx';
import PositionsList from './components/PositionsList.jsx';
import { usePositionOrder } from './usePositionOrder.jsx';
import { useAuth } from './hooks/useAuth.jsx';
import { useCompanySearch } from './hooks/useCompanySearch.jsx';
import { useEurUsdRate } from './hooks/useEurUsdRate.jsx';
import { useLivePrices } from './hooks/useLivePrices.jsx';
import { useModals } from './hooks/useModals.jsx';
import { usePnlSeries } from './hooks/usePnlSeries.jsx';
import { usePortfolio } from './context/PortfolioContext.jsx';
import { getPriceDecimals, formatPrice, formatCurrency } from './utils/formatters.js';
import { hslColor, generatePalette, gcd, getDispersedIndices, hashString } from './utils/helpers.js';
import { mapExchangeToYahoo } from './utils/marketUtils.js';
import { getPositions as getPositionsUtil, getActivePositions as getActivePositionsUtil, getClosedOperations as getClosedOperationsUtil, getHistoricalProfitLoss as getHistoricalProfitLossUtil, getStats as getStatsUtil } from './utils/portfolio.js';
import { generateFullCSV } from './utils/exporters.js';

function App() {
  const navigate = useNavigate();
  const [theme, setTheme] = useState('dark');
  const [operations, setOperations] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showReports, setShowReports] = useState(false); // Estado para mostrar reportes
  const [editingOperation, setEditingOperation] = useState(null);
  // Estados de modales/menús gestionados por useModals
  const [finnhubApiKey, setFinnhubApiKey] = useState('');

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
  const [showSuggestions, setShowSuggestions] = useState(false);
  // Estados de precios gestionados por useLivePrices

  const { currentEURUSD, source: currentEURUSDSource, refresh: refreshEURUSD } = useEurUsdRate({ autoLoad: true });
  const [loadingData, setLoadingData] = useState(true); // Estado de carga de datos
  // Última sincronización gestionada por useLivePrices
  const { portfolios, currentPortfolioId, switchPortfolio, markFavorite } = usePortfolio();

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


  const [notePositionKey, setNotePositionKey] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteOriginalContent, setNoteOriginalContent] = useState(''); // For cancel functionality
  const [noteEditMode, setNoteEditMode] = useState(false); // false = read mode, true = edit mode
  const [showMarkdownHelp, setShowMarkdownHelp] = useState(false); // Markdown help guide
  const [noteLoading, setNoteLoading] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const [notesCache, setNotesCache] = useState({});
  const [contributionChartData, setContributionChartData] = useState([]);
  const [contributionDate, setContributionDate] = useState(null);

  const [dailyCloseLastRun, setDailyCloseLastRun] = useState(null);

  const [externalButtons, setExternalButtons] = useState([]); // Botones externos

  const {
    showConfigModal, setShowConfigModal,
    showDeleteConfirm, setShowDeleteConfirm,
    showSelectPositionModal, setShowSelectPositionModal,
    showNoteModal, setShowNoteModal,
    showExternalButtonsModal, setShowExternalButtonsModal,
    showProfilePictureModal, setShowProfilePictureModal,
    showUserMenu, setShowUserMenu,
    showPortfolioMenu, setShowPortfolioMenu
  } = useModals();


  // Hook para autenticación
  const {
    currentUser,
    setCurrentUser,
    profilePictureUrl,
    setProfilePictureUrl,
    getUserInitial,
    fetchProfilePicture,
    handleChangePassword,
    verifyPassword,
    DEFAULT_PROFILE_PICTURE_URL
  } = useAuth();



  // Hook para reordenamiento de posiciones
  const {
    sortPositions,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop,
    draggedPosition
  } = usePositionOrder(operations);

  const { currentPrices, setCurrentPrices, lastUpdatedAt, setLastUpdatedAt, loadingPrices, refreshPrices } = useLivePrices({
    finnhubApiKey,
    getActivePositions: () => getActivePositionsUtil(operations, sortPositions),
    fetchPriceFromYahoo
  });





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


  // Cargar datos al iniciar
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoadingData(true);

        // Cargar tema desde localStorage (preferencia del navegador)
        const savedTheme = localStorage.getItem('portfolio-theme') || 'dark';
        setTheme(savedTheme);
        document.body.className = savedTheme;

        // El usuario ya se carga automáticamente en el hook useAuth
        const user = currentUser;

        // Portafolios gestionados por PortfolioContext

        // Cargar operaciones desde API
        const operations = await operationsAPI.getAll();
        // Convertir id a id para compatibilidad
        const operationsWithId = operations.map(op => ({
          ...op,
          id: op.id || op.id,
          date: op.date ? (typeof op.date === 'string' ? op.date : new Date(op.date).toISOString().split('T')[0]) : new Date().toISOString().split('T')[0]
        }));
        setOperations(operationsWithId);

        // Prefill de precios desde caché persistida
        try {
          const active = (() => {
            const positions = {};
            operationsWithId.forEach(op => {
              const key = op.symbol ? `${op.company}|||${op.symbol}` : op.company;
              if (!positions[key]) positions[key] = { shares: 0 };
              positions[key].shares += op.type === 'purchase' ? parseInt(op.shares) : -parseInt(op.shares);
            });
            return Object.entries(positions)
              .filter(([_, pos]) => pos.shares > 0)
              .map(([key]) => key);
          })();
          if (active.length > 0) {
            const res = await pricesAPI.getBulk(active);
            const cachePrices = {};
            let maxUpdatedAt = null;
            Object.entries(res.prices || {}).forEach(([positionKey, p]) => {
              cachePrices[positionKey] = {
                price: p.price,
                change: p.change ?? null,
                changePercent: p.changePercent ?? null,
                source: 'cache',
                updatedAt: p.updatedAt || null
              };
              if (p.updatedAt) {
                const dt = new Date(p.updatedAt);
                if (!isNaN(dt.valueOf())) {
                  if (!maxUpdatedAt || dt > maxUpdatedAt) maxUpdatedAt = dt;
                }
              }
            });
            if (Object.keys(cachePrices).length > 0) {
              setCurrentPrices(prev => ({ ...cachePrices, ...prev }));
            }
            // Fallback: si Config no tiene fecha, usar el máximo updatedAt de caché
            if (!lastUpdatedAt && maxUpdatedAt) {
              setLastUpdatedAt(maxUpdatedAt);
            }
          }
        } catch (e) {
          console.log('No se pudieron precargar precios desde caché');
        }

        // Cargar API key global (configurada por admin)
        try {
          const apiKeyResponse = await authenticatedFetch('/api/admin/finnhub-api-key');
          if (apiKeyResponse.ok) {
            const apiKeyData = await apiKeyResponse.json();
            const apiKey = apiKeyData.value || '';
            setFinnhubApiKey(apiKey);
          }
        } catch (error) {
          console.log('No se pudo cargar la API key global (solo admin puede configurarla)');
        }

        // Cargar última sincronización global desde Config
        try {
          const lastSync = await configAPI.get('last_prices_sync_at');
          if (lastSync && lastSync.value) {
            setLastUpdatedAt(new Date(lastSync.value));
          }
        } catch (e) {
          console.log('No se pudo cargar last_prices_sync_at');
        }

        // Cargar última ejecución de cierre diario
        try {
          const dclr = await configAPI.get('daily_close_last_run');
          if (dclr && dclr.value) {
            setDailyCloseLastRun(dclr.value);
          }
        } catch (e) {
          console.log('No se pudo cargar daily_close_last_run');
        }

        // Cargar tipo de cambio EUR/USD al iniciar
        fetchCurrentEURUSD();

        // Cargar contribución por empresa (último cierre)
        try {
          const r = await portfolioAPI.contribution({});
          if (r && r.items) {
            setContributionDate(r.date || null);
            const colors = ['#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#14b8a6'];
            const data = r.items.map((it, i) => ({ name: it.name, value: it.valueEUR, color: colors[i % colors.length] }));
            setContributionChartData(data);
          }
        } catch (e) {
          console.log('No se pudo cargar contribución');
        }

        // Cargar botones externos configurados
        try {
          const buttons = await externalButtonsAPI.getAll();
          setExternalButtons(buttons || []);
        } catch (e) {
          console.log('No se pudieron cargar botones externos');
        }

        // Cargar serie de PnL histórico (viene de DailyPort folioStats)
        try {
          const ts = await portfolioAPI.timeseries({ days: 30 });
          // El backend ahora retorna pnlEUR directamente como totalValueEUR
          let series = (ts.items || []).map(d => ({ date: d.date, pnlEUR: parseFloat(d.totalValueEUR || 0) }));
          // Don't compute real-time PnL here during initial load - the useEffect 
          // at line 398 will update it once currentPrices are loaded
          setPnlSeries(series);
        } catch (e) {
          console.log('No se pudo cargar la serie de PnL');
        }
      } catch (error) {
        console.error('Error cargando datos:', error);
        alert('Error al cargar datos del servidor. Verifica que el backend esté corriendo.');
      } finally {
        setLoadingData(false);
      }
    };

    loadData();
  }, []);

  // Re-fetch al cambiar de portafolio
  useEffect(() => {
    const reloadForPortfolio = async () => {
      if (!currentUser || !currentPortfolioId) return;
      try {
        const ops = await operationsAPI.getAll();
        const opsWithId = ops.map(op => ({
          ...op,
          id: op.id || op.id,
          date: op.date ? (typeof op.date === 'string' ? op.date : new Date(op.date).toISOString().split('T')[0]) : new Date().toISOString().split('T')[0]
        }));
        setOperations(opsWithId);
        const contrib = await portfolioAPI.contribution({});
        if (contrib && contrib.items) {
          setContributionDate(contrib.date || null);
          const colors = ['#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#14b8a6'];
          const data = contrib.items.map((it, i) => ({ name: it.name, value: it.valueEUR, color: colors[i % colors.length] }));
          setContributionChartData(data);
        }
        const ts = await portfolioAPI.timeseries({ days: 30 });
        let series = (ts.items || []).map(d => ({ date: d.date, pnlEUR: parseFloat(d.totalValueEUR || 0) }));
        // Don't override with real-time PnL here - let the useEffect at line 398 handle it
        // after operations state has been updated
        setPnlSeries(series);
      } catch (e) {
        console.log('Error recargando datos por cambio de portafolio');
      }
    };
    reloadForPortfolio();
  }, [currentPortfolioId]);



  // Recalcular contribución con valor actual (EUR) para que coincida con la tabla
  useEffect(() => {
    try {
      const positions = {};
      operations.forEach(op => {
        const key = op.symbol ? `${op.company}|||${op.symbol}` : op.company;
        if (!positions[key]) positions[key] = { shares: 0, company: op.company, symbol: op.symbol || '', currency: op.currency || 'EUR' };
        positions[key].shares += op.type === 'purchase' ? parseInt(op.shares) : -parseInt(op.shares);
        // mantener última moneda vista (normalmente consistente por empresa)
        positions[key].currency = op.currency || positions[key].currency;
      });
      const colors = ['#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#14b8a6'];
      const items = Object.entries(positions)
        .filter(([_, pos]) => pos.shares > 0)
        .map(([key, pos], i) => {
          const cp = currentPrices[key]?.price || 0;
          let rate = 1;
          if (pos.currency === 'USD' && currentEURUSD && currentEURUSD > 0) {
            rate = currentEURUSD;
          }
          const valueEUR = cp * pos.shares * rate;
          return { name: pos.company, value: valueEUR, color: colors[i % colors.length] };
        })
        .filter(d => d.value > 0);
      if (items.length > 0) setContributionChartData(items);
    } catch { }
  }, [operations, currentPrices, currentEURUSD]);

  const [pnlDays, setPnlDays] = useState(30);
  const { pnlSeries, setPnlSeries, refreshSeries } = usePnlSeries({ days: pnlDays, computeCurrentNetPnL });






  // Re-fetch de la serie cuando cambia daily_close_last_run
  useEffect(() => {
    let timer;
    const refreshTimeseries = async () => {
      try {
        await refreshSeries();
        await fetchCurrentEURUSD();
      } catch { }
    };

    if (dailyCloseLastRun) {
      refreshTimeseries();
    }

    timer = setInterval(async () => {
      try {
        const dclr = await configAPI.get('daily_close_last_run');
        if (dclr && dclr.value && dclr.value !== dailyCloseLastRun) {
          setDailyCloseLastRun(dclr.value);
          await refreshTimeseries();
        }
      } catch { }
    }, 60000);

    return () => { if (timer) clearInterval(timer); };
  }, [dailyCloseLastRun]);



  // Actualizaciones del scheduler gestionadas por useLivePrices

  // Actualizar tiempo relativo cada 30s
  useEffect(() => {
    const timer = setInterval(() => {
      if (lastUpdatedAt) {
        // Forzar re-render para actualizar "hace X min"
        setLastUpdatedAt(new Date(lastUpdatedAt));
      }
    }, 30000);

    return () => clearInterval(timer);
  }, [lastUpdatedAt]);

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

  // Cambiar tema
  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    document.body.className = newTheme;
    localStorage.setItem('portfolio-theme', newTheme);
  };











  const contributionColorsMap = useMemo(() => {
    const items = contributionChartData || [];
    const count = Math.min(15, items.length || 0);
    const palette = generatePalette(Math.max(count, 1), theme);
    const order = getDispersedIndices(Math.max(count, 1));
    const map = {};
    items.forEach((item, i) => {
      const idx = i < order.length ? order[i] : (i % palette.length);
      map[item.name] = palette[idx];
    });
    return map;
  }, [contributionChartData, theme]);



  // Borrar todas las operaciones (limpiar base de datos)
  const clearAllOperations = () => {
    if (window.confirm('¿Estás seguro de que quieres borrar TODAS las operaciones? Esta acción no se puede deshacer.')) {
      setTempDeletePassword('');
      setShowDeleteConfirm(true);
    }
  };

  // Confirmar borrado con contraseña del usuario
  const confirmDeleteWithPassword = async () => {
    if (!tempDeletePassword) {
      alert('❌ Por favor, ingresa tu contraseña');
      return;
    }

    try {
      // Verificar contraseña usando el hook useAuth
      if (!currentUser) {
        alert('❌ Sesión expirada. Por favor, inicia sesión de nuevo.');
        navigate('/login');
        return;
      }

      const isValid = await verifyPassword(currentUser.username, tempDeletePassword);

      if (!isValid) {
        alert('❌ Contraseña incorrecta. No se han borrado las operaciones.');
        setTempDeletePassword('');
        return;
      }

      // Si la contraseña es correcta, borrar operaciones
      await operationsAPI.deleteAll();
      setOperations([]);
      setShowDeleteConfirm(false);
      setTempDeletePassword('');
      alert('✅ Todas las operaciones han sido borradas. El portfolio está limpio.');
    } catch (error) {
      console.error('Error borrando operaciones:', error);
      alert('❌ Error al borrar las operaciones. Intenta de nuevo.');
    }
  };

  // Cerrar modal de confirmación de borrado
  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setTempDeletePassword('');
  };


  // Guardar contraseña de borrado
  // Cambiar contraseña del usuario - Wrapper para usar el hook useAuth
  const handleChangePasswordWrapper = async () => {
    try {
      await handleChangePassword(currentPassword, newPassword, confirmNewPassword);
      alert('✅ Contraseña actualizada correctamente');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (error) {
      alert(`❌ ${error.message || 'Error al cambiar contraseña'}`);
    }
  };

  const { searchResults, setSearchResults, loadingSearch, searchCompanies } = useCompanySearch({
    finnhubApiKey,
    setMissingApiKeyWarning,
    setShowConfigModal
  });



  function fetchCurrentEURUSD() {
    return refreshEURUSD();
  }

  // Consultar precio desde Yahoo Finance
  async function fetchPriceFromYahoo(symbol, exchange = '') {
    try {
      // Construir símbolo para Yahoo Finance
      let yahooSymbol = symbol.toUpperCase();

      // Preparar exchange para Yahoo (MC o BME ambos se convierten a MC para Yahoo)
      let yahooExchange = '';
      if (exchange) {
        const exchangeUpper = exchange.toUpperCase();
        // Para Yahoo, MC y BME ambos se usan como MC
        if (exchangeUpper === 'MC' || exchangeUpper === 'BME') {
          yahooExchange = 'MC';
        } else {
          yahooExchange = mapExchangeToYahoo(exchange);
        }

        // Si el exchange mapea a cadena vacía (NASDAQ, NYSE), usar solo el símbolo
        if (yahooExchange === '') {
          yahooSymbol = symbol.toUpperCase();
        } else {
          yahooSymbol = `${symbol.toUpperCase()}.${yahooExchange}`;
        }
      }



      // Usar el backend para evitar problemas de CORS
      const response = await authenticatedFetch(`/api/yahoo/quote/${yahooSymbol}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error al consultar Yahoo Finance: ${response.status}`);
      }

      const data = await response.json();

      // Remover 'source' para mantener consistencia
      if (data.source) {
        delete data.source;
      }

      return data;
    } catch (error) {
      console.error('Error fetching from Yahoo Finance:', error);
      throw error;
    }
  }



  // Consultar precio actual desde Finnhub (soporta formato SYMBOL:EXCHANGE)
  // Si falla, intenta con Yahoo Finance
  const fetchCurrentPrice = async (symbolInput) => {
    if (!symbolInput || symbolInput.trim() === '') {
      setPriceError('Por favor, ingresa el símbolo de la acción (ej: AAPL, MSFT:NASDAQ, AMD:FRA, NXT:BME)');
      return;
    }

    setLoadingPrice(true);
    setPriceError('');
    setCurrentPrice(null);

    try {
      // Formato: SYMBOL:EXCHANGE o solo SYMBOL
      let symbol = symbolInput.toUpperCase().trim();
      let exchange = '';

      if (symbol.includes(':')) {
        const parts = symbol.split(':');
        symbol = parts[0];
        exchange = parts[1]; // Guardar el exchange original
      }

      let priceData = null;
      let usedYahoo = false;

      // Preparar exchange para Finnhub (convertir MC a BME, F a FRA)
      let finnhubExchange = exchange;
      if (finnhubExchange) {
        const exchangeUpper = finnhubExchange.toUpperCase();
        if (exchangeUpper === 'MC' || exchangeUpper === 'BME') {
          finnhubExchange = 'BME';
        } else if (exchangeUpper === 'F' || exchangeUpper === 'FRA') {
          finnhubExchange = 'FRA';
        }
      }

      // Preparar exchange para Yahoo (F para Frankfurt, MC para Madrid)
      let yahooExchange = exchange;
      if (yahooExchange) {
        const exchangeUpper = yahooExchange.toUpperCase();
        if (exchangeUpper === 'FRA') {
          yahooExchange = 'F';
        } else if (exchangeUpper === 'BME') {
          yahooExchange = 'MC';
        }
      }

      // Intentar primero con Finnhub si hay API key
      if (finnhubApiKey) {
        try {
          // Construir el símbolo completo para Finnhub
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

  // Normalizar exchange para guardado interno (mantener MC o BME como está)
  // Para Finnhub usamos BME, para Yahoo usamos MC
  const normalizeExchange = (exchange) => {
    if (!exchange) return exchange;
    // Mantener el exchange como está para guardarlo
    // La conversión se hace específicamente cuando se consulta cada API
    return exchange;
  };

  // Seleccionar una empresa de los resultados de búsqueda
  const selectCompany = (company) => {
    // Finnhub devuelve el símbolo en formato SYMBOL.EXCHANGE o solo SYMBOL
    let symbolWithExchange = '';

    if (company.symbol.includes('.')) {
      // Formato SYMBOL.EXCHANGE -> convertir a SYMBOL:EXCHANGE
      const parts = company.symbol.split('.');
      const symbolPart = parts[0];
      const exchangePart = normalizeExchange(parts[1]);
      symbolWithExchange = exchangePart ? `${symbolPart}:${exchangePart}` : symbolPart;
    } else if (company.exchange) {
      // Si tiene exchange separado, combinarlos y normalizar
      const normalizedExchange = normalizeExchange(company.exchange);
      symbolWithExchange = `${company.symbol}:${normalizedExchange}`;
    } else {
      // Solo símbolo, intentar sin exchange primero
      symbolWithExchange = company.symbol;
    }

    // Obtener nombre de la empresa (sin el exchange si está en el símbolo)
    const companyName = company.description || company.symbol.split('.')[0] || company.symbol;

    setFormData(prev => ({
      ...prev,
      company: companyName
    }));

    // Llenar el campo de símbolo
    const tickerInput = document.getElementById('ticker-symbol');
    if (tickerInput) {
      tickerInput.value = symbolWithExchange;
    }

    setShowSuggestions(false);
    setSearchResults([]);
    setSearchQuery('');

    // NO consultar precio automáticamente - el usuario lo hará manualmente si quiere
  };

  const getPositions = () => getPositionsUtil(operations);
  const getActivePositions = () => getActivePositionsUtil(operations, sortPositions);

  // Consultar precios actuales de todas las posiciones activas
  const fetchAllCurrentPrices = async () => {
    await refreshPrices();
  };

  // Efecto para cargar precios cuando cambian las operaciones o se configura la API key
  useEffect(() => {
    if (finnhubApiKey && operations.length > 0) {
      const timer = setTimeout(async () => {
        // Primero obtener el tipo de cambio EUR/USD actual
        await fetchCurrentEURUSD();
        // Luego obtener los precios de las acciones
        fetchAllCurrentPrices();
      }, 1000); // Esperar 1 segundo después de cambios para evitar demasiadas llamadas
      return () => clearTimeout(timer);
    }
  }, [operations.length, finnhubApiKey]); // Solo dependencias necesarias

  const getClosedOperations = () => getClosedOperationsUtil(operations);

  const getHistoricalProfitLoss = () => getHistoricalProfitLossUtil(operations);

  const getStats = () => getStatsUtil(operations, currentPrices, currentEURUSD, sortPositions);

  // Seleccionar posición para vender
  const selectPositionForSale = (positionKey, availableShares) => {
    // Extraer empresa y símbolo de la clave
    const parts = positionKey.split('|||');
    const company = parts[0];
    const symbol = parts.length > 1 ? parts[1] : '';

    // Filtrar operaciones que coincidan con esta posición
    const companyOperations = operations.filter(op => {
      const opKey = op.symbol ? `${op.company}|||${op.symbol}` : op.company;
      return opKey === positionKey;
    });

    const latestOperation = companyOperations.sort((a, b) => new Date(b.date) - new Date(a.date))[0];

    // Obtener precio actual de la posición
    const currentPriceData = currentPrices[positionKey];
    let currentPrice = '';
    if (currentPriceData && currentPriceData.price) {
      // Usar el precio actual, formateado según el número de decimales
      currentPrice = currentPriceData.price.toString();
    }

    // Cerrar modal de selección primero
    setShowSelectPositionModal(false);

    // Pre-llenar el formulario con los datos de la posición
    const preFilledCurrency = latestOperation?.currency || 'EUR';
    // Si la moneda es EUR, el exchangeRate debe ser 1
    const preFilledExchangeRate = preFilledCurrency === 'EUR' ? '1' : (latestOperation?.exchangeRate?.toString() || '1');

    const preFilledData = {
      company: company,
      shares: availableShares.toString(), // Pre-llenar con todas las acciones disponibles
      price: currentPrice, // Pre-llenar con el precio actual si está disponible
      currency: preFilledCurrency,
      exchangeRate: preFilledExchangeRate,
      commission: '0',
      date: new Date().toISOString().split('T')[0]
    };

    // Abrir modal de venta con los datos pre-llenados
    setModalType('sale');
    setEditingOperation(null);
    setShowModal(true);
    setCurrentPrice(null);
    setPriceError('');
    setSearchQuery('');
    setSearchResults([]);
    setShowSuggestions(false);
    setFormData(preFilledData);

    // Llenar el campo de símbolo después de que el modal se renderice
    // Usar un delay más largo para asegurar que el DOM esté completamente renderizado
    setTimeout(() => {
      const tickerInput = document.getElementById('ticker-symbol');
      if (tickerInput && symbol) {
        tickerInput.value = symbol;
        // Disparar evento change para asegurar que React detecte el cambio si es necesario
        tickerInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, 300);
  };

  // Abrir modal
  const openModal = (type, operation = null) => {
    setModalType(type);
    setEditingOperation(operation);
    setShowModal(true);
    setCurrentPrice(null);
    setPriceError('');
    setSearchQuery('');
    setSearchResults([]);
    setShowSuggestions(false);

    if (operation) {
      // Modo edición
      // Formatear la fecha correctamente para el input date (YYYY-MM-DD)
      let formattedDate = '';
      if (operation.date) {
        const dateObj = typeof operation.date === 'string' ? new Date(operation.date) : operation.date;
        formattedDate = dateObj.toISOString().split('T')[0];
      } else {
        formattedDate = new Date().toISOString().split('T')[0];
      }

      // Si la moneda es EUR, el exchangeRate debe ser 1
      const editExchangeRate = operation.currency === 'EUR' ? '1' : operation.exchangeRate.toString();

      setFormData({
        company: operation.company,
        shares: operation.shares.toString(),
        price: operation.price.toString(),
        currency: operation.currency,
        exchangeRate: editExchangeRate,
        commission: operation.commission.toString(),
        targetPrice: operation.targetPrice ? operation.targetPrice.toString() : '',
        date: formattedDate,
        externalSymbol1: operation.externalSymbol1 || '',
        externalSymbol2: operation.externalSymbol2 || '',
        externalSymbol3: operation.externalSymbol3 || ''
      });

      // Llenar el campo de símbolo si existe
      setTimeout(() => {
        const tickerInput = document.getElementById('ticker-symbol');
        if (tickerInput && operation.symbol) {
          tickerInput.value = operation.symbol;
        }
      }, 100);
    } else {
      // Limpiar el campo de símbolo en modo creación
      setTimeout(() => {
        const tickerInput = document.getElementById('ticker-symbol');
        if (tickerInput) tickerInput.value = '';
      }, 100);

      // Modo creación
      setFormData({
        company: '',
        shares: '',
        price: '',
        currency: 'EUR',
        exchangeRate: '1',
        commission: '0',
        targetPrice: '',
        date: new Date().toISOString().split('T')[0],
        externalSymbol1: '',
        externalSymbol2: '',
        externalSymbol3: ''
      });
    }
  };

  // Cerrar modal
  const closeModal = () => {
    setShowModal(false);
    setModalType('');
    setEditingOperation(null);
    setCurrentPrice(null);
    setPriceError('');
    setSearchQuery('');
    setSearchResults([]);
    setShowSuggestions(false);
  };

  // Manejar cambio de formulario
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Enviar formulario
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Calcular coste total
    // Si la moneda es EUR, no hay conversión
    // Si es otra moneda (ej: USD), convertir el precio a EUR
    const shares = parseFloat(formData.shares);
    const price = parseFloat(formData.price);
    const exchangeRate = parseFloat(formData.exchangeRate);
    const currency = formData.currency;

    let totalCost;
    if (currency === 'EUR') {
      totalCost = shares * price;
    } else {
      totalCost = shares * price * exchangeRate;
    }

    const tickerSymbol = document.getElementById('ticker-symbol')?.value || '';

    // Validar venta
    if (modalType === 'sale') {
      const positions = getPositions();
      const positionKey = tickerSymbol ? `${formData.company}|||${tickerSymbol}` : formData.company;
      const availableShares = positions[positionKey]?.shares || 0;
      const sharesToSell = parseInt(formData.shares);

      if (!positions[positionKey] || availableShares === 0) {
        alert(`No tienes acciones de ${formData.company}${tickerSymbol ? ` (${tickerSymbol})` : ''} para vender`);
        return;
      }

      if (sharesToSell > availableShares) {
        alert(`No puedes vender más acciones de las que tienes.\nAcciones disponibles: ${availableShares}\nAcciones a vender: ${sharesToSell}`);
        return;
      }

      if (sharesToSell <= 0) {
        alert('Debes vender al menos 1 acción');
        return;
      }
    }

    try {
      // Convertir la fecha a formato Date para MongoDB
      const operationDate = formData.date ? new Date(formData.date) : new Date();

      // Si la moneda es EUR, el exchangeRate debe ser 1
      const finalExchangeRate = currency === 'EUR' ? 1 : parseFloat(formData.exchangeRate);

      const operationData = {
        type: modalType,
        company: formData.company,
        symbol: tickerSymbol,
        shares: parseInt(formData.shares),
        price: parseFloat(formData.price),
        currency: formData.currency,
        exchangeRate: finalExchangeRate,
        commission: parseFloat(formData.commission) || 0,
        targetPrice: formData.targetPrice ? parseFloat(formData.targetPrice) : null,
        date: operationDate,
        totalCost: totalCost,
        externalSymbol1: formData.externalSymbol1 || null,
        externalSymbol2: formData.externalSymbol2 || null,
        externalSymbol3: formData.externalSymbol3 || null
      };

      if (editingOperation) {
        // Modo edición - actualizar operación existente
        const updatedOperation = await operationsAPI.update(editingOperation.id, operationData);
        // Actualizar estado local
        const updatedOperations = operations.map(op =>
          op.id === editingOperation.id ? { ...updatedOperation, id: updatedOperation.id || updatedOperation.id } : op
        );
        setOperations(updatedOperations);
      } else {
        // Modo creación - nueva operación
        const newOperation = await operationsAPI.create(operationData);
        // Convertir id a id para compatibilidad
        const operationWithId = { ...newOperation, id: newOperation.id || newOperation.id };
        setOperations([...operations, operationWithId]);
      }

      closeModal();
    } catch (error) {
      console.error('Error guardando operación:', error);
      alert('❌ Error al guardar la operación. Intenta de nuevo.');
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

  function computeCurrentNetPnL() {
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
  }

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
                  <button onClick={() => generateFullCSV(operations)} className="dropdown-item">📊 Exportar CSV</button>
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
              <PositionsList
                activePositions={activePositions}
                currentPrices={currentPrices}
                operations={operations}
                theme={theme}
                formatPrice={formatPrice}
                formatCurrency={formatCurrency}
                openModal={openModal}
                currentEURUSD={currentEURUSD}
                currentPortfolioId={currentPortfolioId}
                userId={currentUser?.id}
                externalButtons={externalButtons}
                handleDragStart={handleDragStart}
                handleDragEnd={handleDragEnd}
                handleDragOver={handleDragOver}
                handleDrop={handleDrop}
                draggedPosition={draggedPosition}
                setNotePositionKey={setNotePositionKey}
                setShowNoteModal={setShowNoteModal}
                setNoteLoading={setNoteLoading}
                setNoteContent={setNoteContent}
                setNoteOriginalContent={setNoteOriginalContent}
                setNoteEditMode={setNoteEditMode}
                setNotesCache={setNotesCache}
              />
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
                <h2 style={{ fontSize: '20px', marginBottom: '10px' }}>📈 Ganancias/Pérdidas</h2>
                <p style={{ fontSize: '12px', color: theme === 'dark' ? '#888' : '#64748b', marginBottom: '10px' }}>
                  Evolución diaria del PnL total (EUR)
                </p>
                <PnLChart data={pnlSeries} theme={theme} onTimePeriodChange={setPnlDays} />
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
          <DeleteConfirmModal
            isOpen={showDeleteConfirm}
            tempPassword={tempDeletePassword}
            setTempPassword={setTempDeletePassword}
            onConfirm={confirmDeleteWithPassword}
            onCancel={cancelDelete}
          />
        )
      }

      {/* Modal de Selección de Posición para Vender */}
      {
        showSelectPositionModal && (
          <SelectPositionModal
            isOpen={showSelectPositionModal}
            onClose={() => setShowSelectPositionModal(false)}
            onSelectPosition={selectPositionForSale}
            positions={getActivePositions()}
            currentPrices={currentPrices}
            operations={operations}
            theme={theme}
          />
        )
      }

      {
        showNoteModal && (
          <NoteModal
            isOpen={showNoteModal}
            onClose={() => setShowNoteModal(false)}
            positionKey={notePositionKey}
            theme={theme}
            notesCache={notesCache}
            setNotesCache={setNotesCache}
          />
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
            onUploadSuccess={async () => {
              setShowProfilePictureModal(false);
              await fetchProfilePicture(); // Asegurarse de que la URL se actualice antes de cerrar el modal
              console.log('App: onUploadSuccess called. profilePictureUrl after fetch:', profilePictureUrl); // Re-fetch the profile picture after successful upload
            }}
            onDeleteSuccess={async () => {
              setShowProfilePictureModal(false);
              await fetchProfilePicture(); // Re-fetch the profile picture after successful deletion
            }}
            currentProfilePictureUrl={profilePictureUrl}
            fetchProfilePicture={fetchProfilePicture}
          />
        )
      }

      {/* Modal de Configuración */}
      {
        showConfigModal && (
          <ConfigModal
            isOpen={showConfigModal}
            theme={theme}
            finnhubApiKey={finnhubApiKey}
            setFinnhubApiKey={setFinnhubApiKey}
            missingApiKeyWarning={missingApiKeyWarning}
            setMissingApiKeyWarning={setMissingApiKeyWarning}
            currentPassword={currentPassword}
            setCurrentPassword={setCurrentPassword}
            newPassword={newPassword}
            setNewPassword={setNewPassword}
            confirmNewPassword={confirmNewPassword}
            setConfirmNewPassword={setConfirmNewPassword}
            onChangePassword={handleChangePasswordWrapper}
            onClearAll={clearAllOperations}
            onClose={() => {
              setShowConfigModal(false);
              setMissingApiKeyWarning(false);
              setCurrentPassword('');
              setNewPassword('');
              setConfirmNewPassword('');
            }}
          />
        )
      }

      <ExternalButtonsModal
        show={showExternalButtonsModal}
        onClose={() => setShowExternalButtonsModal(false)}
        externalButtons={externalButtons}
        setExternalButtons={setExternalButtons}
      />


    </div >
  );
}

export default App;






