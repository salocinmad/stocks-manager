import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { operationsAPI, configAPI, positionsAPI, pricesAPI, notesAPI, portfolioAPI, profilePicturesAPI, externalButtonsAPI } from '../services/api.js';
import { logout, verifySession, changePassword, authenticatedFetch } from '../services/auth.js';

const DEFAULT_PROFILE_PICTURE_URL = '/defaultpic.jpg';

export const useInitialData = () => {
  const navigate = useNavigate();
  const [theme, setTheme] = useState('dark');
  const [operations, setOperations] = useState([]);
  const [finnhubApiKey, setFinnhubApiKey] = useState('');
  const [currentPrices, setCurrentPrices] = useState({}); // {symbol: priceData}
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [currentEURUSD, setCurrentEURUSD] = useState(null);
  const [currentEURUSDSource, setCurrentEURUSDSource] = useState('');
  const [loadingData, setLoadingData] = useState(true); // Estado de carga de datos
  const [currentUser, setCurrentUser] = useState(null); // Usuario actual loggeado
  const [profilePictureUrl, setProfilePictureUrl] = useState(null); // URL de la imagen de perfil del usuario
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null); // Última sincronización global
  const [portfolios, setPortfolios] = useState([]);
  const [currentPortfolioId, setCurrentPortfolioId] = useState(null);
  const [contributionChartData, setContributionChartData] = useState([]);
  const [contributionDate, setContributionDate] = useState(null);
  const [pnlSeries, setPnlSeries] = useState([]);
  const [dailyCloseLastRun, setDailyCloseLastRun] = useState(null);
  const [externalButtons, setExternalButtons] = useState([]); // Botones externos

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

  const fetchCurrentEURUSD = async () => {
    try {
      const response = await pricesAPI.getEURUSD();
      setCurrentEURUSD(response.price);
      setCurrentEURUSDSource(response.source);
    } catch (error) {
      console.error('Error al obtener el tipo de cambio EUR/USD:', error);
      setCurrentEURUSD(null);
      setCurrentEURUSDSource('');
    }
  };

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

  const getActivePositions = () => {
    const positions = {};
    operations.forEach(op => {
      const key = op.symbol ? `${op.company}|||${op.symbol}` : op.company;
      if (!positions[key]) positions[key] = { shares: 0, company: op.company, symbol: op.symbol || '', currency: op.currency || 'EUR' };
      positions[key].shares += op.type === 'purchase' ? parseInt(op.shares) : -parseInt(op.shares);
      positions[key].currency = op.currency || positions[key].currency;
    });
    return Object.entries(positions)
      .filter(([_, pos]) => pos.shares > 0)
      .reduce((acc, [key, pos]) => {
        acc[key] = pos;
        return acc;
      }, {});
  };

  const computeCurrentNetPnL = () => {
    let totalPnL = 0;
    let activePositionsCount = 0;

    operations.forEach(op => {
      const key = op.symbol ? `${op.company}|||${op.symbol}` : op.company;
      const currentPriceData = currentPrices[key];

      if (currentPriceData && currentPriceData.price) {
        const price = currentPriceData.price;
        let rate = 1;
        if (op.currency === 'USD' && currentEURUSD && currentEURUSD > 0) {
          rate = currentEURUSD;
        }

        const shares = parseInt(op.shares);
        const operationPrice = parseFloat(op.price);
        const commission = parseFloat(op.commission || 0);

        if (op.type === 'purchase') {
          totalPnL += (price * shares - operationPrice * shares - commission) * rate;
        } else if (op.type === 'sale') {
          totalPnL += (operationPrice * shares - price * shares - commission) * rate;
        }
        activePositionsCount++;
      }
    });
    return { net: totalPnL, count: activePositionsCount };
  };

  // Cargar imagen de perfil cuando el usuario cambia
  useEffect(() => {
    fetchProfilePicture();
  }, [currentUser]);

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
          setLoadingPrices(true);
          const res = await pricesAPI.getBulk(positionKeys);
          const newPrices = {};
          let maxUpdatedAt = null;
          Object.entries(res.prices || {}).forEach(([positionKey, p]) => {
            newPrices[positionKey] = {
              price: p.price,
              change: p.change ?? null,
              changePercent: p.changePercent ?? null,
              source: 'api',
              updatedAt: p.updatedAt || null
            };
            if (p.updatedAt) {
              const dt = new Date(p.updatedAt);
              if (!isNaN(dt.valueOf())) {
                if (!maxUpdatedAt || dt > maxUpdatedAt) maxUpdatedAt = dt;
              }
            }
          });
          setCurrentPrices(prev => ({ ...prev, ...newPrices }));
          if (maxUpdatedAt) {
            setLastUpdatedAt(maxUpdatedAt);
          }
          setLoadingPrices(false);
        }
      } catch (e) {
        console.error('Error al verificar actualizaciones del scheduler o refrescar precios:', e);
      }
    };

    // Polling cada 30 segundos para detectar actualizaciones del scheduler
    timer = setInterval(checkSchedulerUpdates, 30000);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [operations]); // Depende de operations para recalcular activePositions

  return {
    theme,
    setTheme,
    operations,
    setOperations,
    finnhubApiKey,
    setFinnhubApiKey,
    currentPrices,
    setCurrentPrices,
    loadingPrices,
    setLoadingPrices,
    currentEURUSD,
    setCurrentEURUSD,
    currentEURUSDSource,
    setCurrentEURUSDSource,
    loadingData,
    setLoadingData,
    currentUser,
    setCurrentUser,
    profilePictureUrl,
    setProfilePictureUrl,
    lastUpdatedAt,
    setLastUpdatedAt,
    portfolios,
    setPortfolios,
    currentPortfolioId,
    setCurrentPortfolioId,
    contributionChartData,
    setContributionChartData,
    contributionDate,
    setContributionDate,
    pnlSeries,
    setPnlSeries,
    dailyCloseLastRun,
    setDailyCloseLastRun,
    externalButtons,
    setExternalButtons,
    getUserInitial,
    fetchProfilePicture,
    fetchCurrentEURUSD,
    switchPortfolio,
    markFavorite,
    getActivePositions,
    computeCurrentNetPnL,
  };
};
