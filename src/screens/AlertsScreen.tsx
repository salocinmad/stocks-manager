
import React, { useEffect, useState } from 'react';
import { Header } from '../components/Header';
import { useAuth } from '../context/AuthContext';
import { MOCK_ALERTS } from '../constants'; // Optional, likely unused now

interface Alert {
  id: string;
  ticker: string;
  condition: 'above' | 'below';
  target_price: string;
  is_active: boolean;
  current_price?: number;
  conditionLabel?: string;
  triggered?: boolean;
  companyName?: string;
}

export const AlertsScreen: React.FC = () => {
  const { api } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);

  // Form State
  const [ticker, setTicker] = useState('');
  const [condition, setCondition] = useState<'above' | 'below'>('below');
  const [targetPrice, setTargetPrice] = useState('');
  const [creating, setCreating] = useState(false);

  const notifiedIdsRef = React.useRef<Set<string>>(new Set());
  const browserNotificationRef = React.useRef<boolean>(true); // Default true if permission granted

  // Request Notification Permission on mount and start polling
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Check global browser notification setting
    api.get('/notifications/channels').then(({ data }) => {
      const browserChannel = (data as any[]).find(c => c.channel_type === 'browser');
      if (browserChannel) {
        browserNotificationRef.current = browserChannel.is_active;
      }
    }).catch(e => console.error('Failed to fetch notification settings', e));

    fetchAlerts(); // First fetch

    const interval = setInterval(fetchAlerts, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchAlerts = async () => {
    // Silent loading for polling logic is tricky with stale closures on 'alerts' state, 
    // but for spinner we can just check if we have data locally or assume silent update.
    // We'll skip setLoading(true) for polling to avoid flashing, only set on first load normally.

    try {
      const { data } = await api.get<Alert[]>('/alerts');

      // Check for new triggers
      data.forEach(alert => {
        if (alert.triggered && !notifiedIdsRef.current.has(alert.id)) {
          // Browser Notification Condition
          if (Notification.permission === 'granted' && browserNotificationRef.current) {
            new Notification(`🔔 Alerta Stocks Manager: ${alert.ticker}`, {
              body: `El precio ha ${alert.condition === 'above' ? 'superado' : 'caído por debajo de'} ${alert.target_price}`,
              icon: '/vite.svg'
            });
          }
          // Add to notified set
          notifiedIdsRef.current.add(alert.id);
        }
      });

      setAlerts(data);
    } catch (err) {
      console.error('Error fetching alerts:', err);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker || !targetPrice) return;

    setCreating(true);
    try {
      await api.post('/alerts', {
        ticker,
        condition,
        target_price: parseFloat(targetPrice)
      });
      // Reset form and reload
      setTicker('');
      setTargetPrice('');
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

  return (
    <main className="flex-1 flex flex-col h-full bg-background-light dark:bg-background-dark overflow-y-auto">
      <Header title="Alertas de Precio" />
      <div className="max-w-[1400px] mx-auto w-full px-6 py-10 flex flex-col xl:flex-row gap-8">

        {/* Formulario */}
        <div className="w-full xl:w-1/3 p-8 rounded-3xl bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-sm h-fit">
          <h3 className="text-xl font-bold mb-6">Nueva Alerta</h3>
          <form onSubmit={handleCreate} className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase text-text-secondary-light">Símbolo</label>
              <input
                value={ticker}
                onChange={e => setTicker(e.target.value.toUpperCase())}
                className="w-full rounded-2xl bg-background-light dark:bg-background-dark border-none p-4 text-sm font-bold focus:ring-2 focus:ring-primary uppercase"
                placeholder="Ej: AAPL"
                required
              />
            </div>
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
              <label className="text-xs font-bold uppercase text-text-secondary-light">Valor objetivo (€)</label>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {alerts.map((alert) => (
                <div key={alert.id} className={`flex flex-col gap-4 p-5 rounded-2xl bg-background-light dark:bg-background-dark border border-transparent hover:border-primary transition-all group ${!alert.is_active ? 'opacity-60 grayscale' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {alert.ticker}
                      </div>
                      <div>
                        <h4 className="font-bold text-lg truncate max-w-[200px]" title={alert.companyName || alert.ticker}>{alert.companyName || alert.ticker}</h4>
                        <p className="text-xs text-text-secondary-light">
                          {alert.current_price ? `Actual: ${alert.current_price.toFixed(2)} €` : 'Precio n/a'}
                        </p>
                      </div>
                    </div>
                    <div
                      title={alert.is_active ? 'Activa' : 'Inactiva / Disparada'}
                      className={`size-3 rounded-full ${alert.is_active ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}
                    ></div>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="material-symbols-outlined text-sm">{alert.condition === 'below' ? 'trending_down' : 'trending_up'}</span>
                    <span className="font-medium">{alert.condition === 'below' ? 'Menor que' : 'Mayor que'}</span>
                    <span className="font-bold text-primary">{Number(alert.target_price).toFixed(2)} €</span>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => handleDelete(alert.id)}
                      className="flex-1 py-2 rounded-xl bg-gray-200 dark:bg-surface-dark-elevated text-xs font-bold hover:bg-red-500/20 hover:text-red-500 transition-colors"
                    >
                      Eliminar
                    </button>
                    {/* Future: Edit button */}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
};
