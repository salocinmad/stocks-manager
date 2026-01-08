import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '../components/Header';
import { useAuth } from '../context/AuthContext';

interface CalendarEvent {
    id: string;
    ticker: string | null;
    event_type: string;
    event_date: string;
    title: string;
    description: string | null;
    is_custom: boolean;
    estimated_eps?: number;
    dividend_amount?: number;
    status?: string; // 'estimated', 'confirmed'
}

const EVENT_COLORS: Record<string, { bg: string; text: string; label: string }> = {
    earnings: { bg: 'bg-blue-500/10 border-blue-500/30', text: 'text-blue-500', label: 'Resultados' },
    ex_dividend: { bg: 'bg-green-500/10 border-green-500/30', text: 'text-green-500', label: 'Ex-Dividendo' },
    fed_meeting: { bg: 'bg-yellow-500/10 border-yellow-500/30', text: 'text-yellow-500', label: 'Fed' },
    bce_meeting: { bg: 'bg-yellow-500/10 border-yellow-500/30', text: 'text-yellow-500', label: 'BCE' },
    custom: { bg: 'bg-purple-500/10 border-purple-500/30', text: 'text-purple-500', label: 'Personalizado' }
};

export const CalendarScreen: React.FC = () => {
    const { api } = useAuth();
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [showCreateModal, setShowCreateModal] = useState(false);

    // View Mode: 'portfolio' (Mis Acciones) | 'market' (Mercado)
    const [viewMode, setViewMode] = useState<'portfolio' | 'market'>('portfolio');

    // Form state
    const [newEvent, setNewEvent] = useState({
        title: '',
        event_type: 'custom',
        event_date: new Date().toISOString().split('T')[0],
        ticker: '',
        description: ''
    });

    // Helper to format date as YYYY-MM-DD in local time
    const formatDateLocal = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const fetchEvents = useCallback(async () => {
        try {
            setLoading(true);

            let data: CalendarEvent[] = [];

            if (viewMode === 'portfolio') {
                // Determine start and end of month in LOCAL time logic
                const year = currentMonth.getFullYear();
                const month = currentMonth.getMonth(); // 0-indexed

                const startOfMonth = new Date(year, month, 1);
                const endOfMonth = new Date(year, month + 1, 0); // Last day of current month

                const fromStr = formatDateLocal(startOfMonth);
                const toStr = formatDateLocal(endOfMonth);

                console.log(`[Calendar] Fetching portfolio events: ${fromStr} to ${toStr}`);

                const response = await api.get(`/calendar/events?from=${fromStr}&to=${toStr}`);
                if (response.data && Array.isArray(response.data)) {
                    data = response.data;
                }
            } else {
                // Market Mode: Fetch general events
                const response = await api.get('/calendar/market?days=45');
                if (response.data && Array.isArray(response.data)) {
                    data = response.data;
                }
            }
            setEvents(data);
        } catch (err: any) {
            console.error('Error fetching events:', err);
            setEvents([]);
        } finally {
            setLoading(false);
        }
    }, [currentMonth, viewMode]); // Re-fetch when month OR mode changes

    useEffect(() => {
        let isMounted = true;
        const doFetch = async () => {
            if (isMounted) await fetchEvents();
        };
        doFetch();
        return () => { isMounted = false; };
    }, [fetchEvents]);

    const handleSync = async () => {
        setSyncing(true);
        try {
            await api.post('/calendar/sync');
            await fetchEvents();
            alert('Sincronización completada con éxito.');
        } catch (err) {
            console.error('Sync error:', err);
            alert('Error al sincronizar');
        } finally {
            setSyncing(false);
        }
    };

    const handleCreateEvent = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post('/calendar/events', {
                ...newEvent,
                ticker: newEvent.ticker || null
            });
            setShowCreateModal(false);
            setNewEvent({ title: '', event_type: 'custom', event_date: formatDateLocal(new Date()), ticker: '', description: '' });
            fetchEvents();
        } catch (err) {
            console.error('Create error:', err);
            alert('Error al crear evento');
        }
    };

    const handleDeleteEvent = async (id: string) => {
        if (!confirm('¿Eliminar este evento?')) return;
        try {
            await api.delete(`/calendar/events/${id}`);
            fetchEvents();
        } catch (err) {
            console.error('Delete error:', err);
        }
    };

    // Calendar grid generation
    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const days: (Date | null)[] = [];

        // Add empty days for start of week
        for (let i = 0; i < firstDay.getDay(); i++) {
            days.push(null);
        }

        // Add actual days
        for (let i = 1; i <= lastDay.getDate(); i++) {
            days.push(new Date(year, month, i));
        }

        return days;
    };

    const getEventsForDay = (date: Date | null) => {
        if (!date) return [];
        const dateStr = formatDateLocal(date);
        return events.filter(e => e.event_date === dateStr);
    };

    const formatMonth = (date: Date) => {
        const month = date.toLocaleDateString('es-ES', { month: 'long' });
        const year = date.getFullYear();
        return `${month.charAt(0).toUpperCase() + month.slice(1)} ${year}`;
    };

    const days = getDaysInMonth(currentMonth);
    // Get today's date string in local format for filtering upcoming events
    const todayStr = formatDateLocal(new Date());
    // Show all upcoming events from today onwards, sorted by date
    const upcomingEvents = events
        .filter(e => e.event_date >= todayStr)
        .sort((a, b) => a.event_date.localeCompare(b.event_date));

    return (
        <main className="flex-1 flex flex-col h-full bg-background-light dark:bg-background-dark overflow-hidden">

            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden p-6 gap-6">
                {/* Calendar Grid */}
                <div className="flex-1 flex flex-col bg-white dark:bg-surface-dark rounded-3xl border border-border-light dark:border-border-dark p-6 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <button
                            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                            className="p-2 rounded-xl hover:bg-background-light dark:hover:bg-background-dark transition-all"
                        >
                            <span className="material-symbols-outlined">chevron_left</span>
                        </button>
                        <h2 className="text-xl font-bold capitalize">{formatMonth(currentMonth)}</h2>
                        <button
                            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                            className="p-2 rounded-xl hover:bg-background-light dark:hover:bg-background-dark transition-all"
                        >
                            <span className="material-symbols-outlined">chevron_right</span>
                        </button>
                    </div>

                    {/* Day names */}
                    <div className="grid grid-cols-7 gap-1 mb-2">
                        {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
                            <div key={day} className="text-center text-xs font-bold text-text-secondary-light uppercase py-2">{day}</div>
                        ))}
                    </div>

                    {/* Calendar days */}
                    <div className="grid grid-cols-7 gap-1 flex-1">
                        {days.map((day, idx) => {
                            const dayEvents = getEventsForDay(day);
                            const isSelected = day && formatDateLocal(day) === formatDateLocal(selectedDate);
                            const isToday = day && day.toDateString() === new Date().toDateString();

                            return (
                                <div
                                    key={idx}
                                    onClick={() => day && setSelectedDate(day)}
                                    className={`
                                        h-32 p-1.5 rounded-md border transition-all cursor-pointer flex flex-col
                                        ${day ? 'hover:border-primary' : ''}
                                        ${isSelected ? 'border-primary bg-primary/5' : 'border-transparent'}
                                        ${isToday ? 'bg-primary/10' : ''}
                                    `}
                                >
                                    {day && (
                                        <>
                                            <div className={`text-sm font-bold mb-1 ${isToday ? 'text-primary' : ''}`}>
                                                {day.getDate()}
                                            </div>
                                            <div className="flex flex-col gap-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700">
                                                {dayEvents.map((e, i) => {
                                                    const colors = EVENT_COLORS[e.event_type] || EVENT_COLORS.custom;
                                                    const isConfirmed = e.status === 'confirmed';
                                                    return (
                                                        <div
                                                            key={i}
                                                            className={`text-[9px] leading-tight rounded-md p-1 ${colors.bg} border shrink-0`}
                                                            title={e.description || e.title}
                                                        >
                                                            <div className="flex items-center gap-1">
                                                                <div
                                                                    className={`w-2 h-2 rounded-full flex-shrink-0 ${isConfirmed ? 'bg-green-500' : 'bg-yellow-500'}`}
                                                                    title={isConfirmed ? 'Confirmado' : 'Estimado'}
                                                                />
                                                                <span className="font-bold truncate">{e.ticker}</span>
                                                                <span className={`${colors.text} truncate`}>{colors.label}</span>
                                                            </div>
                                                            {e.description && (
                                                                <div className="text-[8px] text-yellow-600 dark:text-yellow-400/70 truncate mt-0.5">
                                                                    {e.description}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Sidebar with events */}
                <aside className="w-full lg:w-[380px] bg-white dark:bg-surface-dark rounded-3xl border border-border-light dark:border-border-dark p-6 flex flex-col overflow-hidden">
                    {/* Actions */}
                    <div className="flex bg-gray-100 dark:bg-background-dark/50 p-1 rounded-xl mb-4">
                        <button
                            onClick={() => setViewMode('portfolio')}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${viewMode === 'portfolio'
                                ? 'bg-white dark:bg-surface-dark-elevated shadow-sm text-primary'
                                : 'text-text-secondary-light hover:text-text-primary-light'
                                }`}
                        >
                            Mis Eventos
                        </button>
                        <button
                            onClick={() => setViewMode('market')}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${viewMode === 'market'
                                ? 'bg-white dark:bg-surface-dark-elevated shadow-sm text-primary'
                                : 'text-text-secondary-light hover:text-text-primary-light'
                                }`}
                        >
                            Mercado
                        </button>
                    </div>

                    <div className="flex gap-2 mb-6">
                        {viewMode === 'portfolio' && (
                            <button
                                onClick={handleSync}
                                disabled={syncing}
                                className="flex-1 py-3 rounded-xl bg-primary/10 text-primary font-bold text-sm hover:bg-primary/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined text-lg">sync</span>
                                {syncing ? 'Sincronizando...' : 'Sincronizar'}
                            </button>
                        )}
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="flex-1 py-3 rounded-xl bg-primary text-black font-bold text-sm hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                        >
                            <span className="material-symbols-outlined text-lg">add</span>
                            Nuevo
                        </button>
                    </div>

                    {/* Upcoming events header */}
                    <h3 className="text-lg font-bold mb-4">
                        Próximos Eventos
                    </h3>

                    {/* Events list */}
                    <div className="flex-1 overflow-y-auto flex flex-col gap-3">
                        {loading ? (
                            <p className="text-center text-text-secondary-light py-8">Cargando...</p>
                        ) : upcomingEvents.length === 0 ? (
                            <p className="text-center text-text-secondary-light py-8">No hay próximos eventos</p>
                        ) : (
                            upcomingEvents.map(event => {
                                const colors = EVENT_COLORS[event.event_type] || EVENT_COLORS.custom;
                                // Format the event date for display
                                const eventDateObj = new Date(event.event_date + 'T00:00:00');
                                const formattedDate = eventDateObj.toLocaleDateString('es-ES', {
                                    weekday: 'short',
                                    day: 'numeric',
                                    month: 'short'
                                });
                                return (
                                    <div key={event.id} className={`p-4 rounded-2xl border ${colors.bg} flex flex-col gap-2`}>
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`text-xs font-bold uppercase ${colors.text}`}>{colors.label}</span>
                                                    <span className="text-xs text-text-secondary-light">• {formattedDate}</span>
                                                </div>
                                                <h4 className="font-bold">{event.title}</h4>
                                                {event.ticker && <p className="text-xs text-text-secondary-light">{event.ticker}</p>}
                                            </div>
                                            {event.is_custom && (
                                                <button
                                                    onClick={() => handleDeleteEvent(event.id)}
                                                    className="p-1 rounded-lg hover:bg-red-500/20 text-text-secondary-light hover:text-red-500 transition-all"
                                                >
                                                    <span className="material-symbols-outlined text-sm">delete</span>
                                                </button>
                                            )}
                                        </div>
                                        {event.description && <p className="text-sm text-text-secondary-light">{event.description}</p>}

                                        {/* Financial Data */}
                                        {(event.estimated_eps != null || event.dividend_amount != null) && (
                                            <div className="flex gap-4 mt-2 pt-2 border-t border-dashed border-border-light dark:border-border-dark">
                                                {event.estimated_eps != null && (
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] text-text-secondary-light uppercase">Est. EPS</span>
                                                        <span className="font-bold text-sm">{Number(event.estimated_eps).toFixed(2)}</span>
                                                    </div>
                                                )}
                                                {event.dividend_amount != null && (
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] text-text-secondary-light uppercase">Dividendo</span>
                                                        <span className="font-bold text-sm text-green-500">${Number(event.dividend_amount).toFixed(2)}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </aside>
            </div>

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-sm bg-black/40">
                    <div className="bg-white dark:bg-surface-dark rounded-3xl p-8 w-full max-w-md shadow-2xl">
                        <h3 className="text-xl font-bold mb-6">Nuevo Evento</h3>
                        <form onSubmit={handleCreateEvent} className="flex flex-col gap-4">
                            <input
                                type="text"
                                placeholder="Título"
                                value={newEvent.title}
                                onChange={e => setNewEvent({ ...newEvent, title: e.target.value })}
                                className="w-full rounded-xl bg-background-light dark:bg-background-dark p-3 text-sm font-medium"
                                required
                            />
                            <input
                                type="date"
                                value={newEvent.event_date}
                                onChange={e => setNewEvent({ ...newEvent, event_date: e.target.value })}
                                className="w-full rounded-xl bg-background-light dark:bg-background-dark p-3 text-sm font-medium"
                                required
                            />
                            <input
                                type="text"
                                placeholder="Ticker (opcional)"
                                value={newEvent.ticker}
                                onChange={e => setNewEvent({ ...newEvent, ticker: e.target.value.toUpperCase() })}
                                className="w-full rounded-xl bg-background-light dark:bg-background-dark p-3 text-sm font-medium uppercase"
                            />
                            <textarea
                                placeholder="Descripción (opcional)"
                                value={newEvent.description}
                                onChange={e => setNewEvent({ ...newEvent, description: e.target.value })}
                                className="w-full rounded-xl bg-background-light dark:bg-background-dark p-3 text-sm font-medium resize-none h-20"
                            />
                            <div className="flex gap-3 mt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="flex-1 py-3 rounded-xl bg-gray-200 dark:bg-surface-dark-elevated font-bold"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-3 rounded-xl bg-primary text-black font-bold"
                                >
                                    Crear
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </main>
    );
};
