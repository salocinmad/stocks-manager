import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { operationsAPI, configAPI, positionsAPI, pricesAPI, notesAPI, portfolioAPI, profilePicturesAPI, externalButtonsAPI } from './services/api.js';
import { logout, verifySession, changePassword, authenticatedFetch } from './services/auth.js';
import ProfilePictureModal from './components/ProfilePictureModal.jsx';
import ExternalButtonsModal from './components/ExternalButtonsModal.jsx';
import Reports from './components/Reports.jsx';
import StockHistoryChart from './components/StockHistoryChart.jsx';
import { usePositionOrder } from './usePositionOrder.jsx';

function App() {
  const navigate = useNavigate();
  const [theme, setTheme] = useState('dark');
  const [operations, setOperations] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showReports, setShowReports] = useState(false); // Estado para mostrar reportes
  const [editingOperation, setEditingOperation] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [finnhubApiKey, setFinnhubApiKey] = useState('');
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
  const [currentPrices, setCurrentPrices] = useState({}); // {symbol: priceData}
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [showSelectPositionModal, setShowSelectPositionModal] = useState(false);
  const [currentEURUSD, setCurrentEURUSD] = useState(null);
  const [currentEURUSDSource, setCurrentEURUSDSource] = useState('');
  const [loadingData, setLoadingData] = useState(true); // Estado de carga de datos
  const [currentUser, setCurrentUser] = useState(null); // Usuario actual logueado
  const [profilePictureUrl, setProfilePictureUrl] = useState(null); // URL de la imagen de perfil del usuario
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null); // Última sincronización global
  const [portfolios, setPortfolios] = useState([]);
  const [currentPortfolioId, setCurrentPortfolioId] = useState(null);
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
  const [contributionChartData, setContributionChartData] = useState([]);
  const [contributionDate, setContributionDate] = useState(null);
  const [pnlSeries, setPnlSeries] = useState([]);
  const [dailyCloseLastRun, setDailyCloseLastRun] = useState(null);
  const [showUserMenu, setShowUserMenu] = useState(false); // Nuevo estado para el menú de usuario
  const [showProfilePictureModal, setShowProfilePictureModal] = useState(false); // Nuevo estado para el modal de imagen de perfil
  const [externalButtons, setExternalButtons] = useState([]); // Botones externos
  const [showExternalButtonsModal, setShowExternalButtonsModal] = useState(false);
  const [expandedPositions, setExpandedPositions] = useState({}); // Track which positions are expanded

  const DEFAULT_PROFILE_PICTURE_URL = '/defaultpic.jpg'; // Imagen de perfil por defecto servida desde el frontend

  // Hook para reordenamiento de posiciones
  const {
    sortPositions,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop,
    draggedPosition
  } = usePositionOrder(operations);

  // Función para obtener la inicial del usuario
  const getUserInitial = () => {
    if (currentUser) {
      if (currentUser.isAdmin) return 'A';
      return currentUser.username ? currentUser.username.charAt(0).toUpperCase() : '';
    }
    return '';
  };

  // Función para cargar la imagen de perfil
  const fetchProfilePicture = async () => {
    if (!currentUser) {
      setProfilePictureUrl(null);
      return;
    }
    try {
      const response = await profilePicturesAPI.get();
      if (response.status === 404) { // No profile picture found
        setProfilePictureUrl(DEFAULT_PROFILE_PICTURE_URL); // Set default Gravatar for 404
        return;
      }
      const blob = await response.blob();
      const imageUrl = URL.createObjectURL(blob);
      setProfilePictureUrl(imageUrl);
    } catch (error) {
      console.error('Error al cargar la imagen de perfil:', error);
      setProfilePictureUrl(DEFAULT_PROFILE_PICTURE_URL); // Usar imagen por defecto en caso de error o no encontrada
    }
  };

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

  // Cargar imagen de perfil cuando el usuario cambia
  useEffect(() => {
    fetchProfilePicture();
  }, [currentUser]); // Depende de currentUser


  // Cargar datos al iniciar
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoadingData(true);

        // Cargar tema desde localStorage (preferencia del navegador)
        const savedTheme = localStorage.getItem('portfolio-theme') || 'dark';
        setTheme(savedTheme);
        document.body.className = savedTheme;

        // Cargar usuario actual
        const user = await verifySession();
        if (user) {
          setCurrentUser(user);
          if (user.favoritePortfolioId) {
            localStorage.setItem('currentUserFavorite', String(user.favoritePortfolioId));
          }
        }

        // Cargar portafolios y resolver el activo
        try {
          const list = await portfolioAPI.list();
          const items = Array.isArray(list?.items) ? list.items : [];
          setPortfolios(items);
          const stored = localStorage.getItem('currentPortfolioId');
          let pid = stored ? parseInt(stored, 10) : null;
          const valid = items.some(p => p.id === pid);
          if (!valid) {
            pid = user?.favoritePortfolioId || (items[0]?.id || null);
          }
          if (!pid && user) {
            const created = await portfolioAPI.create('Principal');
            pid = created?.item?.id || null;
            await portfolioAPI.setFavorite(pid);
          }
          if (pid) {
            localStorage.setItem('currentPortfolioId', String(pid));
            setCurrentPortfolioId(pid);
          }
        } catch (e) {
          console.log('No se pudo cargar portafolios');
        }

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

  const switchPortfolio = async (id) => {
    const pid = parseInt(id, 10);
    const exists = portfolios.some(p => p.id === pid);
    if (!exists) {
      // Fallback: redirigir al favorito o primero
      const fav = currentUser?.favoritePortfolioId;
      const fallback = portfolios.find(p => p.id === fav) || portfolios[0] || null;
      const newId = fallback ? fallback.id : null;
      if (newId) {
        localStorage.setItem('currentPortfolioId', String(newId));
        setCurrentPortfolioId(newId);
      }
      return;
    }
    localStorage.setItem('currentPortfolioId', String(pid));
    setCurrentPortfolioId(pid);
  };

  const markFavorite = async (id) => {
    try {
      await portfolioAPI.setFavorite(id);
      setCurrentUser(prev => prev ? { ...prev, favoritePortfolioId: id } : prev);
      localStorage.setItem('currentUserFavorite', String(id));
    } catch { }
  };

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

  // Sincronizar el último punto del PnL con la suma de Ganancia/Pérdida por posición (en EUR)
  useEffect(() => {
    try {
      const { net, count } = computeCurrentNetPnL();
      if (count === 0) {
        // No active positions, don't update PnL
        return;
      }

      const today = new Date().toISOString().slice(0, 10);

      if (!pnlSeries || pnlSeries.length === 0) {
        // No historical data yet, create today's point
        setPnlSeries([{ date: today, pnlEUR: net }]);
        return;
      }

      const lastPoint = pnlSeries[pnlSeries.length - 1];

      if (lastPoint.date === today) {
        // Update today's point with current real-time PnL
        const adjusted = [...pnlSeries];
        adjusted[adjusted.length - 1] = {
          ...adjusted[adjusted.length - 1],
          pnlEUR: net
        };
        setPnlSeries(adjusted);
      } else {
        // Add today's point if it doesn't exist yet (real-time until 01:00 AM saves it)
        setPnlSeries([...pnlSeries, { date: today, pnlEUR: net }]);
      }
    } catch { }
  }, [currentPrices, operations, currentEURUSD, dailyCloseLastRun]);

  // Re-fetch de la serie cuando cambia daily_close_last_run
  useEffect(() => {
    let timer;
    const refreshTimeseries = async () => {
      try {
        const ts = await portfolioAPI.timeseries({ days: 30 });
        // El backend ahora retorna pnlEUR directamente como totalValueEUR
        const series = (ts.items || []).map(d => ({ date: d.date, pnlEUR: parseFloat(d.totalValueEUR || 0) }));
        setPnlSeries(series);
        await fetchCurrentEURUSD();
      } catch { }
    };

    // Refrescar inmediatamente cuando cambie la última ejecución
    if (dailyCloseLastRun) {
      refreshTimeseries();
    }

    // Y hacer un pequeño polling cada 60s por si se ejecuta desde /admin
    timer = setInterval(async () => {
      try {
        const dclr = await configAPI.get('daily_close_last_run');
        if (dclr && dclr.value && dclr.value !== dailyCloseLastRun) {
          setDailyCloseLastRun(dclr.value);
          await refreshTimeseries();
          await fetchCurrentEURUSD();
        }
      } catch { }
    }, 60000);

    return () => { if (timer) clearInterval(timer); };
  }, [dailyCloseLastRun, operations]);

  // Detectar actualizaciones del scheduler y refrescar precios
  useEffect(() => {
    let timer;

    const checkSchedulerUpdates = async () => {
      try {
        const schedulerLastRun = await configAPI.get('scheduler_last_run');
        const currentLastRun = localStorage.getItem('scheduler_last_run');

        if (schedulerLastRun?.value && schedulerLastRun.value !== currentLastRun) {
          localStorage.setItem('scheduler_last_run', schedulerLastRun.value);

          // Obtener posiciones activas
          const activePositions = getActivePositions();
          const positionKeys = Object.keys(activePositions);

          if (positionKeys.length === 0) return;

          // Actualizar precios desde caché
          const res = await pricesAPI.getBulk(positionKeys);
          const updatedPrices = {};
          let maxUpdatedAt = null;

          Object.entries(res.prices || {}).forEach(([key, p]) => {
            updatedPrices[key] = {
              price: p.price,
              change: p.change ?? null,
              changePercent: p.changePercent ?? null,
              source: p.source || 'cache',
              updatedAt: p.updatedAt
            };

            if (p.updatedAt) {
              const dt = new Date(p.updatedAt);
              if (!isNaN(dt.valueOf()) && (!maxUpdatedAt || dt > maxUpdatedAt)) {
                maxUpdatedAt = dt;
              }
            }
          });

          setCurrentPrices(prev => ({ ...prev, ...updatedPrices }));
          if (maxUpdatedAt) setLastUpdatedAt(maxUpdatedAt);
        }
      } catch (e) {
        console.error('Error checking scheduler updates:', e);
      }
    };

    // Comprobar cada 30s
    timer = setInterval(checkSchedulerUpdates, 30000);

    return () => { if (timer) clearInterval(timer); };
  }, [operations]);

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

  // Guardar operaciones (sincronizar con API)
  const saveOperations = async (newOperations) => {
    setOperations(newOperations);
    // Nota: Las operaciones se guardan individualmente en handleSubmit/delete
    // Esta función solo actualiza el estado local
  };

  // Determinar número de decimales apropiado para un precio
  const getPriceDecimals = (price) => {
    if (!price || price === 0) return 2;

    // Si el precio es menor a 1, usar 4 decimales
    if (price < 1) {
      return 4;
    }
    // Si el precio es menor a 10, usar 3 decimales
    if (price < 10) {
      return 3;
    }
    // Si el precio es menor a 100, usar 2 decimales
    if (price < 100) {
      return 2;
    }
    // Para precios mayores, usar 2 decimales
    return 2;
  };

  // Formatear precio con decimales apropiados
  const formatPrice = (price) => {
    if (price === null || price === undefined) return '-';
    const decimals = getPriceDecimals(price);
    return price.toFixed(decimals);
  };

  // Formatear moneda con símbolo correcto
  const formatCurrency = (value, currencyCode) => {
    if (value === null || value === undefined || isNaN(value)) return '-';
    const formatted = parseFloat(value).toFixed(2);
    const symbol = currencyCode === 'USD' ? '$' : (currencyCode === 'GBP' ? '£' : '€');
    return `${symbol}${formatted}`;
  };

  const hashString = (str) => {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (h << 5) - h + str.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h);
  };

  const hslColor = (hue, s, l) => `hsl(${Math.round(hue % 360)}, ${Math.round(s)}%, ${Math.round(l)}%)`;

  const generatePalette = (n, mode) => {
    const isDark = mode === 'dark';
    const s = isDark ? 72 : 68;
    const l = isDark ? 46 : 56;
    const colors = [];
    for (let i = 0; i < n; i++) {
      const hue = (i * (360 / n)) % 360;
      colors.push(hslColor(hue, s, l));
    }
    return colors;
  };

  const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
  const getDispersedIndices = (n) => {
    if (n <= 1) return [0];
    let step = Math.floor(n / 2) + 1; // co-primo con n para recorrer todo el ciclo
    while (gcd(n, step) !== 1) step++;
    const order = [];
    for (let i = 0; i < n; i++) order.push((i * step) % n);
    return order;
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

  const escapeHtml = (str) => {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  const markdownToHtml = (md) => {
    const text = escapeHtml(md);
    let html = text;
    html = html.replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${code}</code></pre>`);
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/^######\s*(.*)$/gm, '<h6 style="font-size: 14px; font-weight: 600; margin: 12px 0 8px 0;">$1</h6>');
    html = html.replace(/^#####\s*(.*)$/gm, '<h5 style="font-size: 16px; font-weight: 600; margin: 14px 0 8px 0;">$1</h5>');
    html = html.replace(/^####\s*(.*)$/gm, '<h4 style="font-size: 18px; font-weight: 600; margin: 16px 0 10px 0;">$1</h4>');
    html = html.replace(/^###\s*(.*)$/gm, '<h3 style="font-size: 20px; font-weight: 700; margin: 18px 0 10px 0;">$1</h3>');
    html = html.replace(/^##\s*(.*)$/gm, '<h2 style="font-size: 24px; font-weight: 700; margin: 20px 0 12px 0;">$1</h2>');
    html = html.replace(/^#\s*(.*)$/gm, '<h1 style="font-size: 28px; font-weight: 700; margin: 22px 0 14px 0;">$1</h1>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/\n-{3,}\n/g, '<hr/>');
    html = html.replace(/\n\n/g, '<br/><br/>');
    html = html.replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    html = html.replace(/^(?:-\s+.*\n?)+/gm, (block) => {
      const items = block.trim().split(/\n/).map(li => li.replace(/^-\s+/, ''));
      return '<ul>' + items.map(i => `<li>${i}</li>`).join('') + '</ul>';
    });
    return html;
  };

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
      // Verificar contraseña intentando hacer login
      const user = await verifySession();
      if (!user) {
        alert('❌ Sesión expirada. Por favor, inicia sesión de nuevo.');
        navigate('/login');
        return;
      }

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user.username,
          password: tempDeletePassword
        }),
      });

      if (!response.ok) {
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
  // Cambiar contraseña del usuario
  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      alert('❌ Por favor, completa todos los campos');
      return;
    }

    if (newPassword.length < 6) {
      alert('❌ La nueva contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      alert('❌ Las contraseñas no coinciden');
      return;
    }

    try {
      await changePassword(currentPassword, newPassword);
      alert('✅ Contraseña actualizada correctamente');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (error) {
      alert(`❌ ${error.message || 'Error al cambiar contraseña'}`);
    }
  };

  // Buscar empresas por nombre usando Finnhub
  const searchCompanies = async (query) => {
    if (!finnhubApiKey) {
      setMissingApiKeyWarning(true);
      setShowConfigModal(true);
      return;
    }

    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      setShowSuggestions(false);
      return;
    }

    setLoadingSearch(true);
    setShowSuggestions(true);

    try {
      const response = await fetch(
        `https://finnhub.io/api/v1/search?q=${encodeURIComponent(query)}&token=${finnhubApiKey}`
      );

      if (!response.ok) {
        throw new Error('Error al buscar empresas');
      }

      const data = await response.json();

      if (data.result && data.result.length > 0) {
        // Mostrar más resultados para ver diferentes mercados
        setSearchResults(data.result.slice(0, 30)); // Aumentar a 30 resultados para ver más exchanges
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Error searching companies:', error);
      setSearchResults([]);
    } finally {
      setLoadingSearch(false);
    }
  };

  // Mapear exchanges para Yahoo Finance
  const mapExchangeToYahoo = (exchange) => {
    const exchangeMap = {
      'MC': 'MC',       // Bolsa de Madrid - Yahoo usa MC
      'BME': 'MC',      // Bolsa de Madrid - convertir BME a MC para Yahoo
      'NASDAQ': '',     // NASDAQ en Yahoo no necesita sufijo para la mayoría
      'NYSE': '',       // NYSE en Yahoo no necesita sufijo para la mayoría
      'FRA': 'F',       // Frankfurt - Yahoo usa .F (ej: AMD.F)
      'XETR': 'DE',     // XETRA
      'LON': 'L',       // London
      'TSE': 'T',       // Tokyo
      'AMEX': 'AMEX'
    };
    return exchangeMap[exchange.toUpperCase()] !== undefined ? exchangeMap[exchange.toUpperCase()] : exchange;
  };

  // Determinar moneda basándose en el exchange
  const getCurrencyFromExchange = (symbol) => {
    if (!symbol || !symbol.includes(':')) {
      // Si no hay exchange, asumir USD por defecto (NASDAQ/NYSE)
      return 'USD';
    }

    const parts = symbol.split(':');
    const exchange = parts[1].toUpperCase();

    // Exchanges europeos que usan EUR
    const eurExchanges = ['MC', 'BME', 'FRA', 'XETR', 'DE', 'LON', 'L', 'AMS', 'PAR', 'BRU', 'MIL', 'LIS'];

    if (eurExchanges.includes(exchange)) {
      return 'EUR';
    }

    // Exchanges que usan USD
    const usdExchanges = ['NASDAQ', 'NYSE', 'AMEX'];
    if (usdExchanges.includes(exchange)) {
      return 'USD';
    }

    // Por defecto, asumir USD si no se reconoce
    return 'USD';
  };

  // Obtener tipo de cambio EUR/USD actual
  const fetchCurrentEURUSD = async () => {
    try {
      const response = await authenticatedFetch('/api/yahoo/fx/eurusd');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al obtener tipo de cambio');
      }
      const data = await response.json();
      const eurPerUsd = Number(data.eurPerUsd);
      if (!eurPerUsd || eurPerUsd <= 0) throw new Error('Tipo de cambio inválido');
      setCurrentEURUSD(eurPerUsd);
      setCurrentEURUSDSource(String(data.source || ''));
      console.log(`💱 Tipo de cambio EUR/USD actual: ${eurPerUsd.toFixed(4)} (1 USD = ${eurPerUsd.toFixed(4)} EUR)`);
      return eurPerUsd;
    } catch (error) {
      console.error('Error al obtener tipo de cambio EUR/USD:', error);
      const defaultRate = currentEURUSD || 0.92;
      setCurrentEURUSD(defaultRate);
      setCurrentEURUSDSource('cache');
      return defaultRate;
    }
  };

  // Consultar precio desde Yahoo Finance
  const fetchPriceFromYahoo = async (symbol, exchange = '') => {
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

      console.log(`Buscando en Yahoo Finance: ${yahooSymbol}`);

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
  };

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

  // Calcular posiciones - agrupar por empresa + símbolo para diferenciar diferentes exchanges
  const getPositions = () => {
    const positions = {};
    operations.forEach(op => {
      // Crear clave única: empresa + símbolo (para diferenciar diferentes exchanges)
      // Si no hay símbolo, usar solo la empresa
      const positionKey = op.symbol ? `${op.company}|||${op.symbol}` : op.company;

      if (!positions[positionKey]) {
        positions[positionKey] = {
          shares: 0,
          totalCost: 0,
          totalOriginalCost: 0, // Costo en moneda original
          currency: 'EUR', // Moneda de la posición
          company: op.company,
          symbol: op.symbol || ''
        };
      }

      // Actualizar moneda basándose en las operaciones
      if (op.currency) {
        positions[positionKey].currency = op.currency;
      }

      if (op.type === 'purchase') {
        positions[positionKey].shares += parseInt(op.shares);
        positions[positionKey].totalCost += parseFloat(op.totalCost);
        // Sumar costo en moneda original (precio * acciones)
        positions[positionKey].totalOriginalCost += parseFloat(op.price) * parseInt(op.shares);
      } else if (op.type === 'sale') {
        const sharesSold = parseInt(op.shares);
        const currentShares = positions[positionKey].shares;

        // Calcular costo promedio antes de la venta
        const avgCost = currentShares > 0 ? positions[positionKey].totalOriginalCost / currentShares : 0;

        positions[positionKey].shares -= sharesSold;
        positions[positionKey].totalCost -= parseFloat(op.totalCost);
        // Reducir costo original proporcionalmente
        positions[positionKey].totalOriginalCost -= avgCost * sharesSold;
      }
    });
    return positions;
  };

  // Obtener posiciones activas (con acciones > 0)
  const getActivePositions = () => {
    const positions = getPositions();
    const activePositions = Object.fromEntries(
      Object.entries(positions).filter(([company, position]) => position.shares > 0)
    );
    return sortPositions(activePositions);
  };

  // Consultar precios actuales de todas las posiciones activas
  const fetchAllCurrentPrices = async () => {

    const activePositions = getActivePositions();
    const companies = Object.keys(activePositions);

    if (companies.length === 0) {
      setCurrentPrices({});
      return;
    }

    setLoadingPrices(true);
    const prices = {};

    // Extraer símbolos de cada posición (ahora la clave es company|||symbol)
    const positionSymbols = {};
    companies.forEach(positionKey => {
      const position = activePositions[positionKey];
      if (position && position.symbol) {
        positionSymbols[positionKey] = position.symbol;
      }
    });

    console.log('📊 Símbolos a consultar:', Object.entries(positionSymbols).map(([k, s]) => `${k}: ${s}`).join(', '));

    // Consultar precios para cada posición con símbolo
    const pricePromises = companies.map(async (positionKey) => {
      const symbol = positionSymbols[positionKey];
      if (!symbol) {
        return { positionKey, priceData: null };
      }

      const position = activePositions[positionKey];
      const companyName = position?.company || positionKey.split('|||')[0];

      console.log(`[${companyName}] Consultando precio con símbolo: ${symbol}`);

      try {
        let symbolInput = symbol.toUpperCase().trim();
        let symbolPart = symbolInput;
        let exchangePart = '';

        if (symbolInput.includes(':')) {
          const parts = symbolInput.split(':');
          symbolPart = parts[0];
          exchangePart = parts[1]; // Guardar el exchange original
        }

        let priceData = null;

        // Preparar exchange para Finnhub (convertir MC a BME, F a FRA)
        // Para Yahoo, usar el exchange original (F para Frankfurt, MC para Madrid)
        let finnhubExchange = exchangePart;
        if (finnhubExchange) {
          const exchangeUpper = finnhubExchange.toUpperCase();
          if (exchangeUpper === 'MC' || exchangeUpper === 'BME') {
            finnhubExchange = 'BME'; // Finnhub usa BME para Madrid
          } else if (exchangeUpper === 'F' || exchangeUpper === 'FRA') {
            // Frankfurt: Yahoo usa F, pero Finnhub usa FRA
            finnhubExchange = 'FRA';
          }
        }

        // Para Yahoo Finance, usar el exchange original (F para Frankfurt)
        let yahooExchange = exchangePart;
        if (yahooExchange) {
          const exchangeUpper = yahooExchange.toUpperCase();
          if (exchangeUpper === 'FRA') {
            yahooExchange = 'F'; // Yahoo usa F para Frankfurt
          } else if (exchangeUpper === 'BME') {
            yahooExchange = 'MC'; // Yahoo usa MC para Madrid
          }
        }

        // Intentar primero con Finnhub si hay API key
        if (finnhubApiKey) {
          try {
            const finnhubSymbol = finnhubExchange ? `${symbolPart}.${finnhubExchange}` : symbolPart;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // Timeout de 10 segundos

            const response = await fetch(
              `https://finnhub.io/api/v1/quote?symbol=${finnhubSymbol}&token=${finnhubApiKey}`,
              { signal: controller.signal }
            );

            clearTimeout(timeoutId);

            if (response.ok) {
              const data = await response.json();
              if (data.c && data.c > 0) {
                priceData = {
                  price: data.c,
                  change: data.d,
                  changePercent: data.dp,
                  symbol: finnhubSymbol,
                  source: 'finnhub',
                  updatedAt: new Date().toISOString()
                };
                console.log(`[${companyName}] Precio obtenido de Finnhub: $${priceData.price}`);
              }
            }
          } catch (error) {
            if (error.name !== 'AbortError') {
              console.log(`[${companyName}] Finnhub falló, intentando Yahoo Finance...`);
            }
          }
        }

        // Si Finnhub no funcionó, intentar con Yahoo Finance
        // Usar el exchange correcto para Yahoo (F para Frankfurt, MC para Madrid)
        if (!priceData) {
          try {
            // Crear una promesa con timeout para Yahoo Finance
            const yahooPromise = fetchPriceFromYahoo(symbolPart, yahooExchange);
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Timeout después de 15 segundos')), 15000)
            );

            priceData = await Promise.race([yahooPromise, timeoutPromise]);

            // Remover la propiedad 'source' para mantener consistencia
            if (priceData) {
              priceData.source = 'yahoo';
              priceData.updatedAt = new Date().toISOString();
            }

            if (priceData) {
              console.log(`[${companyName}] Precio obtenido de Yahoo: $${priceData.price}`);
            }
          } catch (error) {
            if (error.message.includes('Timeout')) {
              console.error(`[${companyName}] Timeout al obtener precio de Yahoo Finance`);
            } else {
              console.error(`[${companyName}] Error fetching price from Yahoo:`, error.message);
            }
          }
        }

        // Persistir en caché si tenemos datos
        if (priceData && typeof priceData.price === 'number') {
          try {
            await pricesAPI.upsert(positionKey, {
              price: priceData.price,
              change: priceData.change ?? null,
              changePercent: priceData.changePercent ?? null,
              source: priceData.source
            });
          } catch (e) {
            console.log(`[${companyName}] Error guardando precio en caché`);
          }
        }

        return { positionKey, priceData };
      } catch (error) {
        console.error(`[${companyName}] Error general:`, error);
        return { positionKey, priceData: null };
      }
    });

    // Esperar todas las promesas y procesar resultados
    const results = await Promise.allSettled(pricePromises);
    const updated = [];
    const failed = [];

    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) {
        const { positionKey, priceData } = result.value;
        if (priceData) {
          prices[positionKey] = priceData;
          const position = activePositions[positionKey];
          const companyName = position?.company || positionKey.split('|||')[0];
          updated.push(companyName);
        } else {
          const position = activePositions[positionKey];
          const companyName = position?.company || positionKey.split('|||')[0];
          failed.push(companyName);
        }
      } else if (result.status === 'rejected') {
        console.error('Error en promesa:', result.reason);
      }
    });

    console.log(`✅ Precios actualizados: ${updated.length} empresas`);
    if (updated.length > 0) {
      console.log(`   Empresas con precio: ${updated.join(', ')}`);
    }
    if (failed.length > 0) {
      console.log(`⚠️  Empresas sin precio: ${failed.join(', ')}`);
    }

    setCurrentPrices(prices);
    setLoadingPrices(false);

    // Actualizar última sincronización SIEMPRE (hora del intento)
    const nowIso = new Date().toISOString();
    setLastUpdatedAt(new Date(nowIso));
    try {
      await configAPI.set('last_prices_sync_at', nowIso);
    } catch (e) {
      console.log('No se pudo actualizar last_prices_sync_at');
    }
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

  // Obtener historial de operaciones cerradas
  const getClosedOperations = () => {
    const positions = getPositions();
    const closedPositionKeys = Object.keys(positions).filter(positionKey => positions[positionKey].shares === 0);

    return operations.filter(op => {
      const opKey = op.symbol ? `${op.company}|||${op.symbol}` : op.company;
      return closedPositionKeys.includes(opKey);
    });
  };

  // Calcular ganancias/pérdidas del histórico
  const getHistoricalProfitLoss = () => {
    const closedOperations = getClosedOperations();
    const sales = closedOperations.filter(op => op.type === 'sale');

    let totalProfit = 0;

    sales.forEach(sale => {
      const company = sale.company;
      const companyPurchases = operations
        .filter(op => op.company === company && op.type === 'purchase')
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      // Calcular coste de compra (FIFO)
      let remainingShares = sale.shares;
      let totalPurchaseCost = 0;

      for (const purchase of companyPurchases) {
        if (remainingShares <= 0) break;
        const sharesToUse = Math.min(remainingShares, purchase.shares);
        const costPerShare = purchase.totalCost / purchase.shares;
        totalPurchaseCost += sharesToUse * costPerShare;
        remainingShares -= sharesToUse;
      }

      // Calcular ganancia/pérdida
      const saleRevenue = sale.shares * sale.price * sale.exchangeRate;
      const saleCommission = sale.commission * sale.exchangeRate;
      const netSaleRevenue = saleRevenue - saleCommission;

      const profit = netSaleRevenue - totalPurchaseCost;
      totalProfit += profit;
    });

    return totalProfit;
  };

  // Calcular estadísticas
  const getStats = () => {
    const activePositions = getActivePositions();
    // Calcular valor total basado en precios actuales cuando estén disponibles
    let totalValue = 0;
    Object.entries(activePositions).forEach(([positionKey, position]) => {
      const priceData = currentPrices[positionKey];
      if (priceData && priceData.price) {
        // Obtener moneda de las operaciones de compra
        const companyOperations = operations.filter(op => {
          const opKey = op.symbol ? `${op.company}|||${op.symbol}` : op.company;
          return opKey === positionKey;
        });
        const purchases = companyOperations.filter(op => op.type === 'purchase');
        let currency = 'EUR';
        if (purchases.length > 0) {
          const latestPurchase = purchases.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
          currency = latestPurchase?.currency || 'EUR';
        }

        // Calcular valor en moneda base y convertir a EUR
        const valueInBaseCurrency = position.shares * priceData.price;
        let valueInEUR;
        if (currency === 'EUR') {
          valueInEUR = valueInBaseCurrency;
        } else if (currency === 'USD') {
          const eurPerUsd = currentEURUSD || 0.92;
          valueInEUR = valueInBaseCurrency * eurPerUsd;
        } else {
          let weightedExchangeRate = 1;
          if (purchases.length > 0) {
            let totalShares = 0;
            let totalExchangeRateWeighted = 0;
            purchases.forEach(purchase => {
              totalShares += purchase.shares;
              totalExchangeRateWeighted += purchase.shares * purchase.exchangeRate;
            });
            weightedExchangeRate = totalShares > 0 ? totalExchangeRateWeighted / totalShares : 1;
          }
          valueInEUR = valueInBaseCurrency * weightedExchangeRate;
        }
        totalValue += valueInEUR;
      } else {
        // Si no hay precio actual, usar el costo de compra como fallback
        totalValue += position.totalCost;
      }
    });
    const companiesCount = Object.keys(activePositions).length;

    // Contar solo operaciones de empresas con posiciones activas
    // Crear un conjunto de claves de posición activas para comparar
    const activePositionKeys = new Set(Object.keys(activePositions));
    const activeOperations = operations.filter(op => {
      const opKey = op.symbol ? `${op.company}|||${op.symbol}` : op.company;
      return activePositionKeys.has(opKey);
    });
    const totalOperations = activeOperations.length;

    const totalShares = Object.values(activePositions).reduce((sum, pos) => sum + pos.shares, 0);

    return { totalValue, companiesCount, totalOperations, totalShares };
  };

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

  // Generar CSV completo con todas las operaciones
  const generateFullCSV = () => {
    const sales = operations.filter(op => op.type === 'sale');

    if (sales.length === 0) {
      alert('No hay operaciones de venta para generar el CSV');
      return;
    }

    const csvRows = [];

    // Encabezados
    csvRows.push([
      'Empresa',
      'Fecha Com',
      'Fecha Ven',
      'Títulos',
      'Precio com',
      'Precio $ com',
      'Comision com',
      'Precio en € com',
      'Accion ven',
      'Precio Ven',
      'Comision ven',
      'Precio en € ven',
      'Ganancias',
      'Precio $ ve',
      'Ganancia en €',
      'Porcentaje',
      'Rentenciones',
      'Retencion',
      '% Retencio',
      'Ganancia real'
    ]);

    // Procesar cada venta
    sales.forEach(sale => {
      const company = sale.company;
      const symbol = sale.symbol || '';
      // Filtrar compras que coincidan con la empresa Y el símbolo (si existe)
      // Esto asegura que solo se usen compras del mismo mercado/bolsa
      const companyPurchases = operations
        .filter(op => {
          const opMatchesCompany = op.company === company;
          const opMatchesSymbol = symbol ? (op.symbol === symbol) : (!op.symbol || op.symbol === '');
          return opMatchesCompany && opMatchesSymbol && op.type === 'purchase';
        })
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      // Calcular datos de compra (FIFO)
      let remainingShares = sale.shares;
      let totalPurchaseCost = 0;
      let totalPurchaseShares = 0;
      let avgPurchasePrice = 0;
      let totalPurchaseCommission = 0;
      let avgPurchaseExchangeRate = 0;
      let purchaseDates = [];
      let purchaseCurrencies = []; // Guardar todas las monedas de las compras usadas

      for (const purchase of companyPurchases) {
        if (remainingShares <= 0) break;
        const sharesToUse = Math.min(remainingShares, purchase.shares);
        const costPerShare = purchase.totalCost / purchase.shares;
        totalPurchaseCost += sharesToUse * costPerShare;
        totalPurchaseShares += sharesToUse;
        totalPurchaseCommission += (purchase.commission / purchase.shares) * sharesToUse;

        // Guardar la moneda de esta compra (tantas veces como acciones se usen)
        for (let i = 0; i < sharesToUse; i++) {
          purchaseCurrencies.push(purchase.currency || 'EUR');
        }

        // Usar 1 si la compra es en EUR, independientemente del valor guardado
        const purchaseExRate = purchase.currency === 'EUR' ? 1 : purchase.exchangeRate;
        avgPurchaseExchangeRate += purchaseExRate * sharesToUse;

        // Guardar fecha de compra para cada acción
        for (let i = 0; i < sharesToUse; i++) {
          purchaseDates.push(purchase.date);
        }

        remainingShares -= sharesToUse;
      }

      // Determinar la moneda de compra: si todas son EUR, usar EUR; si no, usar la más común
      let purchaseCurrency = 'EUR'; // Por defecto EUR
      if (purchaseCurrencies.length > 0) {
        const eurCount = purchaseCurrencies.filter(c => c === 'EUR').length;
        // Si todas las compras usadas son en EUR, usar EUR
        if (eurCount === purchaseCurrencies.length) {
          purchaseCurrency = 'EUR';
        } else {
          // Si hay mezcla, usar la moneda más común
          const currencyCounts = {};
          purchaseCurrencies.forEach(c => {
            currencyCounts[c] = (currencyCounts[c] || 0) + 1;
          });
          purchaseCurrency = Object.keys(currencyCounts).reduce((a, b) =>
            currencyCounts[a] > currencyCounts[b] ? a : b
          );
        }
      }

      avgPurchasePrice = totalPurchaseShares > 0 ? totalPurchaseCost / totalPurchaseShares : 0;
      avgPurchaseExchangeRate = totalPurchaseShares > 0 ? avgPurchaseExchangeRate / totalPurchaseShares : 0;

      // Si la compra es en EUR, el exchangeRate debe ser 1 (forzar siempre)
      // Usamos únicamente el campo currency guardado en la base de datos
      const purchaseExchangeRate = purchaseCurrency === 'EUR' ? 1 : avgPurchaseExchangeRate;

      // Calcular fecha de compra promedio
      let avgPurchaseDate = '';
      if (purchaseDates.length > 0) {
        const dates = purchaseDates.map(date => new Date(date));
        const avgTimestamp = dates.reduce((sum, date) => sum + date.getTime(), 0) / dates.length;
        const avgDate = new Date(avgTimestamp);
        avgPurchaseDate = `${avgDate.getDate().toString().padStart(2, '0')}/${(avgDate.getMonth() + 1).toString().padStart(2, '0')}/${avgDate.getFullYear()}`;
      }

      // Si la venta es en EUR, el exchangeRate debe ser 1 (forzar siempre, incluso si está guardado incorrectamente)
      const saleExchangeRate = sale.currency === 'EUR' ? 1 : (sale.exchangeRate || 1);

      // Calcular ganancias usando el exchangeRate correcto
      const saleRevenue = sale.shares * sale.price * saleExchangeRate;
      const saleCommission = sale.commission * saleExchangeRate;
      const netSaleRevenue = saleRevenue - saleCommission;

      const grossProfit = netSaleRevenue - totalPurchaseCost;
      const profitPercentage = totalPurchaseCost > 0 ? (grossProfit / totalPurchaseCost) * 100 : 0;

      // Retenciones (19% por defecto)
      const retentionRate = 0.19;
      const retention = grossProfit > 0 ? grossProfit * retentionRate : 0;
      const netProfit = grossProfit - retention;

      // Formatear fecha
      const saleDate = new Date(sale.date);
      const formattedDate = `${saleDate.getDate().toString().padStart(2, '0')}/${(saleDate.getMonth() + 1).toString().padStart(2, '0')}/${saleDate.getFullYear()}`;

      // Formatear exchangeRate: si es 1, mostrar solo "1", si no, mostrar con 8 decimales
      const formatExchangeRate = (rate) => {
        return rate === 1 ? '1' : rate.toFixed(8);
      };

      // Agregar fila
      csvRows.push([
        company,
        avgPurchaseDate,
        formattedDate,
        sale.shares.toString(),
        `${formatPrice(avgPurchasePrice)} ${purchaseCurrency}`,
        formatExchangeRate(purchaseExchangeRate),
        `${totalPurchaseCommission.toFixed(2)} ${purchaseCurrency}`,
        `${totalPurchaseCost.toFixed(2)} EUR`,
        `${formatPrice(sale.price)} ${sale.currency}`,
        `${(sale.shares * sale.price).toFixed(2)} ${sale.currency}`,
        `${sale.commission.toFixed(2)} ${sale.currency}`,
        `${netSaleRevenue.toFixed(2)} EUR`,
        `${(sale.shares * sale.price - sale.commission - (totalPurchaseCost / purchaseExchangeRate)).toFixed(2)} ${sale.currency}`,
        formatExchangeRate(saleExchangeRate),
        `${grossProfit.toFixed(2)} EUR`,
        `${profitPercentage.toFixed(2)}%`,
        'NO',
        `${retention.toFixed(2)} EUR`,
        '19%',
        `${netProfit.toFixed(2)} €`
      ]);
    });

    // Convertir a CSV con formato compatible con Excel
    const csvContent = '\uFEFF' + csvRows.map(row =>
      row.map(cell => {
        // Escapar comillas dobles y envolver en comillas si contiene comas, comillas o saltos de línea
        const escapedCell = cell.toString().replace(/"/g, '""');
        if (escapedCell.includes(',') || escapedCell.includes('"') || escapedCell.includes('\n') || escapedCell.includes('\r')) {
          return `"${escapedCell}"`;
        }
        return escapedCell;
      }).join(';') // Usar punto y coma como separador (estándar europeo)
    ).join('\n');

    // Descargar archivo con BOM para UTF-8
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `operaciones_portfolio_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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






