import React, { useEffect, useState } from 'react';
import { Header } from '../components/Header';
import { useAuth } from '../context/AuthContext';

interface Alert {
  id: string;
  ticker: string;
  alert_type: 'price' | 'percent_change' | 'volume' | 'any_asset_change_percent';
  condition: 'above' | 'below' | null;
  target_price: string | null;
  percent_threshold: number | null;
  volume_multiplier: number | null;
  is_repeatable: boolean;
  repeat_cooldown_hours: number;
  is_active: boolean;
  current_price?: number;
  triggered?: boolean;
  companyName?: string;
}

const ALERT_TYPE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  price: { label: 'Precio', icon: 'attach_money', color: 'text-blue-500' },
  percent_change: { label: 'Cambio %', icon: 'percent', color: 'text-orange-500' },
  volume: { label: 'Volumen', icon: 'bar_chart', color: 'text-purple-500' },
  any_asset_change_percent: { label: 'Global', icon: 'public', color: 'text-green-500' }
};

export const AlertsScreen: React.FC = () => {
  const { api } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);
  const [portfolios, setPortfolios] = useState<{ id: string; name: string }[]>([]);

  // Form State
  const [alertType, setAlertType] = useState<'price' | 'percent_change' | 'volume' | 'any_asset_change_percent'>('price');
  const [portfolioId, setPortfolioId] = useState('');
  const [ticker, setTicker] = useState('');
  const [tickerDisplay, setTickerDisplay] = useState(''); // For showing selected company name
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [condition, setCondition] = useState<'above' | 'below'>('below');
  const [targetPrice, setTargetPrice] = useState('');
  const [percentThreshold, setPercentThreshold] = useState('5');
  const [volumeMultiplier, setVolumeMultiplier] = useState('2');
  const [isRepeatable, setIsRepeatable] = useState(false);
  const [repeatCooldown, setRepeatCooldown] = useState('24');
  const [creating, setCreating] = useState(false);

  // Edit state
  const [editingAlert, setEditingAlert] = useState<Alert | null>(null);
  const [editTargetPrice, setEditTargetPrice] = useState('');
  const [editPercentThreshold, setEditPercentThreshold] = useState('');
  const [editVolumeMultiplier, setEditVolumeMultiplier] = useState('');
  const [editCondition, setEditCondition] = useState<'above' | 'below'>('below');
  const [editIsRepeatable, setEditIsRepeatable] = useState(false);
  const [editRepeatCooldown, setEditRepeatCooldown] = useState('24');
  const [saving, setSaving] = useState(false);

  const notifiedIdsRef = React.useRef<Set<string>>(new Set());
  const browserNotificationRef = React.useRef<boolean>(true);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    api.get('/notifications/channels').then(({ data }) => {
      const browserChannel = (data as any[]).find(c => c.channel_type === 'browser');
      if (browserChannel) {
        browserNotificationRef.current = browserChannel.is_active;
      }
    }).catch(e => console.error('Failed to fetch notification settings', e));

    // Fetch Portfolios
    api.get('/portfolios').then(({ data }) => setPortfolios(data as any[])).catch(console.error);

    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000);
    return () => clearInterval(interval);
  }, []);

  // Symbol search with debounce
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (tickerDisplay.length > 1 && !ticker) {
        setIsSearching(true);
        try {
          const { data } = await api.get(`/market/search?q=${encodeURIComponent(tickerDisplay)}`);
          setSearchResults(data || []);
        } catch (e) {
          console.error('Search error:', e);
          setSearchResults([]);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 400);
    return () => clearTimeout(delayDebounceFn);
  }, [tickerDisplay, ticker, api]);

  const fetchAlerts = async () => {
    try {
      const { data } = await api.get<Alert[]>('/alerts');
      data.forEach(alert => {
        if (alert.triggered && !notifiedIdsRef.current.has(alert.id)) {
          if (Notification.permission === 'granted' && browserNotificationRef.current) {
            new Notification(`🔔 Alerta: ${alert.ticker}`, {
              body: getAlertDescription(alert),
              icon: '/vite.svg'
            });
          }
          notifiedIdsRef.current.add(alert.id);
        }
      });
      setAlerts(data);
    } catch (err) {
      console.error('Error fetching alerts:', err);
    }
  };

  const getAlertDescription = (alert: Alert): string => {
    if (alert.alert_type === 'price') {
      return `Precio ${alert.condition === 'above' ? 'superó' : 'cayó bajo'} ${alert.target_price}`;
    } else if (alert.alert_type === 'percent_change') {
      return `Cambio superior al ${alert.percent_threshold}%`;
    } else if (alert.alert_type === 'volume') {
      return `Volumen ${alert.volume_multiplier}x superior al promedio`;
    }
    return '';
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker && alertType !== 'any_asset_change_percent') return;

    setCreating(true);
    try {
      const payload: any = {
        ticker,
        alert_type: alertType,
        is_repeatable: isRepeatable,
        repeat_cooldown_hours: parseInt(repeatCooldown)
      };

      if (alertType === 'price') {
        payload.condition = condition;
        payload.target_price = parseFloat(targetPrice);
      } else if (alertType === 'percent_change') {
        payload.percent_threshold = parseFloat(percentThreshold);
      } else if (alertType === 'volume') {
        payload.volume_multiplier = parseFloat(volumeMultiplier);
      } else if (alertType === 'any_asset_change_percent') {
        payload.portfolio_id = portfolioId;
        payload.percent_threshold = parseFloat(percentThreshold);
      }

      await api.post('/alerts', payload);
      setTicker('');
      setTickerDisplay('');
      setTargetPrice('');
      setPercentThreshold('5');
      setVolumeMultiplier('2');
      fetchAlerts();
      alert('Alerta creada correctamente');
    } catch (err) {
      console.error('Error creating alert:', err);
      alert('Error al crear alerta. Verifica el símbolo.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta alerta?')) return;
    try {
      await api.delete(`/alerts/${id}`);
      setAlerts(alerts.filter(a => a.id !== id));
    } catch (err) {
      console.error('Error deleting alert:', err);
    }
  };

  const openEditModal = (alert: Alert) => {
    setEditingAlert(alert);
    setEditTargetPrice(alert.target_price?.toString() || '');
    setEditPercentThreshold(alert.percent_threshold?.toString() || '5');
    setEditVolumeMultiplier(alert.volume_multiplier?.toString() || '2');
    setEditCondition(alert.condition || 'below');
    setEditIsRepeatable(alert.is_repeatable);
    setEditRepeatCooldown(alert.repeat_cooldown_hours?.toString() || '24');
  };

  const handleSaveEdit = async () => {
    if (!editingAlert) return;
    setSaving(true);
    try {
      const payload: any = {
        is_repeatable: editIsRepeatable,
        repeat_cooldown_hours: parseInt(editRepeatCooldown)
      };

      if (editingAlert.alert_type === 'price') {
        payload.target_price = parseFloat(editTargetPrice);
        payload.condition = editCondition;
      } else if (editingAlert.alert_type === 'percent_change') {
        payload.percent_threshold = parseFloat(editPercentThreshold);
      } else if (editingAlert.alert_type === 'volume') {
        payload.volume_multiplier = parseFloat(editVolumeMultiplier);
      }

      await api.put(`/alerts/${editingAlert.id}`, payload);
      setEditingAlert(null);
      fetchAlerts();
      alert('Alerta actualizada correctamente');
    } catch (err) {
      console.error('Error updating alert:', err);
      alert('Error al actualizar alerta');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="flex-1 flex flex-col h-full bg-background-light dark:bg-background-dark overflow-y-auto">

      <div className="w-full px-6 py-10 flex flex-col xl:flex-row gap-8">

        {/* Formulario */}
        <div className="w-full xl:w-1/3 p-8 rounded-3xl bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-sm h-fit">
          <h3 className="text-xl font-bold mb-6">Nueva Alerta</h3>

          {/* Alert Type Tabs */}
          {/* Alert Type Tabs - Redesigned Grid */}
          <div className="grid grid-cols-2 gap-2 mb-5">
            {Object.entries(ALERT_TYPE_LABELS).map(([type, { label, icon, color }]) => {
              const isSelected = alertType === type;
              return (
                <button
                  key={type}
                  onClick={() => setAlertType(type as any)}
                  className={`py-2 px-1 rounded-xl text-[10px] font-bold flex flex-col items-center justify-center gap-0.5 transition-all border-2 ${isSelected
                    ? 'bg-primary border-primary text-black'
                    : 'bg-background-light dark:bg-background-dark border-transparent text-text-secondary hover:border-primary/30'
                    }`}
                >
                  <span className={`material-symbols-outlined text-lg ${isSelected ? 'text-black' : color}`}>
                    {icon}
                  </span>
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          <form onSubmit={handleCreate} className="flex flex-col gap-5">
            {/* Ticker with search */}
            <div className="flex flex-col gap-2 relative z-10">
              <label className="text-xs font-bold uppercase text-text-secondary-light">Símbolo</label>
              <div className="relative">
                <input
                  value={tickerDisplay}
                  onChange={e => {
                    setTickerDisplay(e.target.value.toUpperCase());
                    setTicker(''); // Reset selected ticker when typing
                  }}
                  className="w-full rounded-2xl bg-background-light dark:bg-background-dark border-none p-4 text-sm font-bold focus:ring-2 focus:ring-primary uppercase"
                  placeholder="Busca un símbolo (ej: AAPL)"
                  required={alertType !== 'any_asset_change_percent'}
                  disabled={alertType === 'any_asset_change_percent'}
                />
                {ticker && (
                  <button
                    type="button"
                    onClick={() => { setTicker(''); setTickerDisplay(''); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-red-500/20 rounded-lg transition-all"
                  >
                    <span className="material-symbols-outlined text-sm text-text-secondary-light hover:text-red-500">close</span>
                  </button>
                )}
                {/* Search Results Dropdown */}
                {searchResults.length > 0 && !ticker && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl shadow-2xl overflow-hidden max-h-[250px] overflow-y-auto z-50">
                    {searchResults.map((res, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setTicker(res.symbol);
                          setTickerDisplay(`${res.symbol} - ${res.name || res.description || ''}`);
                          setSearchResults([]);
                        }}
                        className="w-full flex items-center gap-3 p-3 hover:bg-primary/5 border-b border-border-light dark:border-border-dark last:border-none text-left transition-colors"
                      >
                        <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                          {res.symbol?.slice(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate">{res.symbol}</p>
                          <p className="text-xs text-text-secondary-light truncate">{res.name || res.description}</p>
                        </div>
                        <span className="text-[10px] font-bold text-text-secondary-light bg-gray-100 dark:bg-white/10 px-2 py-1 rounded">{res.exchange}</span>
                      </button>
                    ))}
                  </div>
                )}
                {isSearching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <span className="material-symbols-outlined text-sm text-text-secondary-light animate-spin">progress_activity</span>
                  </div>
                )}
              </div>
            </div>

            {/* Global Alert specific inputs */}
            {alertType === 'any_asset_change_percent' && (
              <>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase text-text-secondary-light">Portafolio</label>
                  <select
                    value={portfolioId}
                    onChange={e => setPortfolioId(e.target.value)}
                    className="w-full rounded-2xl bg-background-light dark:bg-background-dark border-none p-4 text-sm font-bold focus:ring-2 focus:ring-primary"
                    required
                  >
                    <option value="">Selecciona un portafolio</option>
                    {portfolios.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase text-text-secondary-light">Umbral de movimiento (%)</label>
                  <input
                    value={percentThreshold}
                    onChange={e => setPercentThreshold(e.target.value)}
                    className="w-full rounded-2xl bg-background-light dark:bg-background-dark border-none p-4 text-sm font-bold focus:ring-2 focus:ring-primary"
                    placeholder="5"
                    type="number"
                    step="0.1"
                    min="0.1"
                    required
                  />
                  <p className="text-xs text-text-secondary-light">Alerta si CUALQUIER activo del portafolio se mueve más de X% (subida o bajada)</p>
                </div>
              </>
            )}

            {/* Price-specific fields */}
            {alertType === 'price' && (
              <>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase text-text-secondary-light">Condición</label>
                  <select
                    value={condition}
                    onChange={e => setCondition(e.target.value as 'above' | 'below')}
                    className="w-full rounded-2xl bg-background-light dark:bg-background-dark border-none p-4 text-sm font-bold focus:ring-2 focus:ring-primary"
                  >
                    <option value="below">Precio menor que</option>
                    <option value="above">Precio mayor que</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase text-text-secondary-light">Valor objetivo</label>
                  <input
                    value={targetPrice}
                    onChange={e => setTargetPrice(e.target.value)}
                    className="w-full rounded-2xl bg-background-light dark:bg-background-dark border-none p-4 text-sm font-bold focus:ring-2 focus:ring-primary"
                    placeholder="0.00"
                    type="number"
                    step="0.01"
                    required
                  />
                </div>
              </>
            )}

            {/* Percent change fields */}
            {alertType === 'percent_change' && (
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase text-text-secondary-light">Umbral de cambio (%)</label>
                <input
                  value={percentThreshold}
                  onChange={e => setPercentThreshold(e.target.value)}
                  className="w-full rounded-2xl bg-background-light dark:bg-background-dark border-none p-4 text-sm font-bold focus:ring-2 focus:ring-primary"
                  placeholder="5"
                  type="number"
                  step="0.1"
                  min="0.1"
                  required
                />
                <p className="text-xs text-text-secondary-light">Alerta si el cambio diario supera este porcentaje (subida o bajada)</p>
              </div>
            )}

            {/* Volume fields */}
            {alertType === 'volume' && (
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase text-text-secondary-light">Multiplicador de volumen</label>
                <input
                  value={volumeMultiplier}
                  onChange={e => setVolumeMultiplier(e.target.value)}
                  className="w-full rounded-2xl bg-background-light dark:bg-background-dark border-none p-4 text-sm font-bold focus:ring-2 focus:ring-primary"
                  placeholder="2"
                  type="number"
                  step="0.5"
                  min="1"
                  required
                />
                <p className="text-xs text-text-secondary-light">Alerta si el volumen es X veces superior al promedio</p>
              </div>
            )}

            {/* Repeatable toggle */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-background-light dark:bg-background-dark">
              <div>
                <p className="text-sm font-bold">Alerta Repetible</p>
                <p className="text-xs text-text-secondary-light">Se reactiva automáticamente tras cada disparo</p>
              </div>
              <button
                type="button"
                onClick={() => setIsRepeatable(!isRepeatable)}
                className={`w-12 h-6 rounded-full transition-all ${isRepeatable ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${isRepeatable ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {/* Cooldown (if repeatable) */}
            {isRepeatable && (
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase text-text-secondary-light">Tiempo de espera (horas)</label>
                <select
                  value={repeatCooldown}
                  onChange={e => setRepeatCooldown(e.target.value)}
                  className="w-full rounded-2xl bg-background-light dark:bg-background-dark border-none p-4 text-sm font-bold focus:ring-2 focus:ring-primary"
                >
                  <option value="1">1 hora</option>
                  <option value="4">4 horas</option>
                  <option value="12">12 horas</option>
                  <option value="24">24 horas</option>
                  <option value="48">48 horas</option>
                </select>
              </div>
            )}

            <button
              disabled={creating}
              type="submit"
              className="mt-4 w-full py-4 rounded-full bg-primary text-black font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
            >
              {creating ? 'Creando...' : 'Crear Alerta'}
            </button>
          </form>
        </div>

        {/* Lista de Alertas */}
        <div className="w-full xl:w-2/3 flex flex-col p-8 rounded-3xl bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xl font-bold">Alertas Activas</h3>
            <button onClick={fetchAlerts} className="text-sm font-bold text-primary hover:underline">Refrescar</button>
          </div>

          {loading ? (
            <p className="text-center opacity-50">Cargando alertas...</p>
          ) : alerts.length === 0 ? (
            <p className="text-center opacity-50 py-10">No tienes alertas configuradas.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
              {alerts.map((alert) => {
                const typeInfo = ALERT_TYPE_LABELS[alert.alert_type] || ALERT_TYPE_LABELS.price;
                return (
                  <div key={alert.id} className={`flex flex-col gap-3 p-4 rounded-2xl bg-background-light dark:bg-background-dark border border-transparent hover:border-primary transition-all group ${!alert.is_active ? 'opacity-60 grayscale' : ''}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`size-10 rounded-xl bg-primary/10 flex items-center justify-center ${typeInfo.color}`}>
                          <span className="material-symbols-outlined text-lg">{typeInfo.icon}</span>
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-base truncate pr-2">{alert.companyName || alert.ticker}</h4>
                          <p className="text-[10px] text-text-secondary-light flex items-center gap-1">
                            <span className={`${typeInfo.color}`}>{typeInfo.label}</span>
                            {alert.is_repeatable && (
                              <span className="ml-1 px-1.5 py-0.5 bg-purple-500/10 text-purple-500 rounded text-[10px] font-bold">REPETIBLE</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div
                        title={alert.is_active ? 'Activa' : 'Inactiva / Disparada'}
                        className={`size-2.5 rounded-full flex-shrink-0 ${alert.is_active ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}
                      ></div>
                    </div>

                    {/* Alert Info & Current Price Row */}
                    <div className="flex items-center justify-between text-xs gap-2">
                      {alert.alert_type === 'price' && (
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-bold text-primary whitespace-nowrap">{Number(alert.target_price).toFixed(2)} €</span>
                        </div>
                      )}
                      {alert.alert_type === 'percent_change' && (
                        <>
                          <span className="material-symbols-outlined text-sm flex-shrink-0">percent</span>
                          <span className="font-medium truncate">Cambio ≥</span>
                          <span className="font-bold text-orange-500 whitespace-nowrap">{alert.percent_threshold}%</span>
                        </>
                      )}
                      {alert.alert_type === 'volume' && (
                        <>
                          <span className="material-symbols-outlined text-sm flex-shrink-0">bar_chart</span>
                          <span className="font-medium truncate">Volumen ≥</span>
                          <span className="font-bold text-purple-500 whitespace-nowrap">{alert.volume_multiplier}x</span>
                        </>
                      )}
                      {alert.alert_type === 'any_asset_change_percent' && (
                        <>
                          <span className="material-symbols-outlined text-sm text-green-500 flex-shrink-0">public</span>
                          <span className="font-medium text-green-500 truncate">Global</span>
                          <span className="font-bold text-green-500 whitespace-nowrap">({alert.percent_threshold}%)</span>
                        </>
                      )}
                    </div>

                    {/* Price Right Aligned */}
                    {alert.current_price && (
                      <div className="text-right flex-shrink-0">
                        <p className="text-[10px] text-text-secondary-light">Actual</p>
                        <p className="font-bold text-xs">{alert.current_price.toFixed(2)} €</p>
                      </div>
                    )}


                    {/* Triggered Status & Reset */}
                    {/* Triggered Status & Reset */}
                    {(alert.triggered || alert.alert_type === 'any_asset_change_percent') && (
                      <div className={`rounded-lg p-2 flex items-center justify-between gap-2 ${alert.triggered ? 'bg-red-500/10 border border-red-500/20' : 'bg-gray-100 dark:bg-white/5 border border-border-light dark:border-border-dark'}`}>
                        {alert.triggered ? (
                          <span className="text-[10px] font-bold text-red-500 flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">warning</span>
                            ¡Disparada!
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-text-secondary-light flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">history</span>
                            Monitorizando
                          </span>
                        )}
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (!confirm(alert.alert_type === 'any_asset_change_percent' ? '¿Reiniciar historial de disparos para todos los activos de este portafolio? Esto permitirá que vuelvan a alertar inmediatamente.' : '¿Restablecer esta alerta para que vuelva a vigilar?')) return;
                            try {
                              await api.put(`/alerts/${alert.id}/reset`);
                              fetchAlerts();
                            } catch (error) {
                              console.error(error);
                              window.alert('Error al restablecer');
                            }
                          }}
                          className={`px-2 py-1 rounded text-[10px] font-bold transition-colors ${alert.triggered ? 'bg-white dark:bg-black/20 hover:bg-red-500 hover:text-white' : 'bg-white dark:bg-black/20 hover:bg-primary hover:text-black'}`}
                        >
                          {alert.alert_type === 'any_asset_change_percent' ? 'Reiniciar' : 'Restablecer'}
                        </button>
                      </div>
                    )}

                    <div className="flex gap-2 mt-auto pt-2 border-t border-border-light/50 dark:border-border-dark/50">
                      <button
                        onClick={() => openEditModal(alert)}
                        className="flex-1 py-1.5 rounded-lg bg-primary/10 text-primary text-[10px] font-bold hover:bg-primary/20 transition-colors"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(alert.id)}
                        className="flex-1 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 text-[10px] font-bold hover:bg-red-500/20 hover:text-red-500 transition-colors"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {
        editingAlert && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-sm bg-black/40">
            <div className="bg-white dark:bg-surface-dark rounded-3xl p-8 w-full max-w-md shadow-2xl">
              <h3 className="text-xl font-bold mb-6">Editar Alerta - {editingAlert.ticker}</h3>
              <div className="flex flex-col gap-4">

                {/* Type-specific fields */}
                {editingAlert.alert_type === 'price' && (
                  <>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold uppercase text-text-secondary-light">Condición</label>
                      <select
                        value={editCondition}
                        onChange={e => setEditCondition(e.target.value as 'above' | 'below')}
                        className="w-full rounded-xl bg-background-light dark:bg-background-dark p-3 text-sm font-bold"
                      >
                        <option value="below">Menor que</option>
                        <option value="above">Mayor que</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold uppercase text-text-secondary-light">Precio Objetivo</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editTargetPrice}
                        onChange={e => setEditTargetPrice(e.target.value)}
                        className="w-full rounded-xl bg-background-light dark:bg-background-dark p-3 text-sm font-bold"
                      />
                    </div>
                  </>
                )}
                {(editingAlert.alert_type === 'percent_change' || editingAlert.alert_type === 'any_asset_change_percent') && (
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold uppercase text-text-secondary-light">
                      {editingAlert.alert_type === 'any_asset_change_percent' ? 'Umbral de Movimiento (%)' : 'Umbral de Cambio (%)'}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={editPercentThreshold}
                      onChange={e => setEditPercentThreshold(e.target.value)}
                      className="w-full rounded-xl bg-background-light dark:bg-background-dark p-3 text-sm font-bold"
                    />
                  </div>
                )}
                {editingAlert.alert_type === 'volume' && (
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold uppercase text-text-secondary-light">Multiplicador de Volumen</label>
                    <input
                      type="number"
                      step="0.5"
                      value={editVolumeMultiplier}
                      onChange={e => setEditVolumeMultiplier(e.target.value)}
                      className="w-full rounded-xl bg-background-light dark:bg-background-dark p-3 text-sm font-bold"
                    />
                  </div>
                )}

                {/* Repeatable toggle */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-background-light dark:bg-background-dark">
                  <div>
                    <p className="text-sm font-bold">Repetible</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditIsRepeatable(!editIsRepeatable)}
                    className={`w-12 h-6 rounded-full transition-all ${editIsRepeatable ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${editIsRepeatable ? 'translate-x-6' : 'translate-x-0.5'}`} />
                  </button>
                </div>

                {editIsRepeatable && (
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold uppercase text-text-secondary-light">Cooldown (horas)</label>
                    <select
                      value={editRepeatCooldown}
                      onChange={e => setEditRepeatCooldown(e.target.value)}
                      className="w-full rounded-xl bg-background-light dark:bg-background-dark p-3 text-sm font-bold"
                    >
                      <option value="1">1 hora</option>
                      <option value="4">4 horas</option>
                      <option value="12">12 horas</option>
                      <option value="24">24 horas</option>
                      <option value="48">48 horas</option>
                    </select>
                  </div>
                )}

                {/* Buttons */}
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => setEditingAlert(null)}
                    className="flex-1 py-3 rounded-xl bg-gray-200 dark:bg-surface-dark-elevated font-bold"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={saving}
                    className="flex-1 py-3 rounded-xl bg-primary text-black font-bold disabled:opacity-50"
                  >
                    {saving ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }
    </main >
  );
};
