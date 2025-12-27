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

    // Form state
    const [newEvent, setNewEvent] = useState({
        title: '',
        event_type: 'custom',
        event_date: new Date().toISOString().split('T')[0],
        ticker: '',
        description: ''
    });

    const fetchEvents = useCallback(async () => {
        try {
            setLoading(true);
            const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
            const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

            const response = await api.get(`/calendar/events?from=${startOfMonth.toISOString().split('T')[0]}&to=${endOfMonth.toISOString().split('T')[0]}`);

            // Handle potential error responses
            if (response.data && Array.isArray(response.data)) {
                setEvents(response.data as CalendarEvent[]);
            } else {
                setEvents([]);
            }
        } catch (err: any) {
            console.error('Error fetching events:', err);
            // Don't crash - just show empty events
            setEvents([]);
        } finally {
            setLoading(false);
        }
    }, [currentMonth]); // Remove api from deps to prevent re-fetch loops

    useEffect(() => {
        // Only fetch if component is mounted
        let isMounted = true;

        const doFetch = async () => {
            if (isMounted) {
                await fetchEvents();
            }
        };

        doFetch();

        return () => {
            isMounted = false;
        };
    }, [fetchEvents]);

    const handleSync = async () => {
        setSyncing(true);
        try {
            await api.post('/calendar/sync');
            await fetchEvents();
            alert('Eventos sincronizados correctamente');
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
            setNewEvent({ title: '', event_type: 'custom', event_date: new Date().toISOString().split('T')[0], ticker: '', description: '' });
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
        const dateStr = date.toISOString().split('T')[0];
        return events.filter(e => e.event_date === dateStr);
    };

    const formatMonth = (date: Date) => {
        const month = date.toLocaleDateString('es-ES', { month: 'long' });
        const year = date.getFullYear();
        return `${month.charAt(0).toUpperCase() + month.slice(1)} ${year}`;
    };

    const days = getDaysInMonth(currentMonth);
    const selectedDateStr = selectedDate.toISOString().split('T')[0];
    const selectedEvents = events.filter(e => e.event_date === selectedDateStr);

    return (
        <main className="flex-1 flex flex-col h-full bg-background-light dark:bg-background-dark overflow-hidden">
            <Header title="Calendario Financiero" />
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
                            const isSelected = day && day.toISOString().split('T')[0] === selectedDateStr;
                            const isToday = day && day.toDateString() === new Date().toDateString();

                            return (
                                <div
                                    key={idx}
                                    onClick={() => day && setSelectedDate(day)}
                                    className={`
                                        min-h-[60px] p-1 rounded-xl border transition-all cursor-pointer
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
                                            <div className="flex flex-wrap gap-0.5">
                                                {dayEvents.slice(0, 3).map((e, i) => (
                                                    <div
                                                        key={i}
                                                        className={`w-2 h-2 rounded-full ${EVENT_COLORS[e.event_type]?.text || 'text-gray-500'}`}
                                                        style={{ backgroundColor: 'currentColor' }}
                                                        title={e.title}
                                                    />
                                                ))}
                                                {dayEvents.length > 3 && (
                                                    <span className="text-[8px] text-text-secondary-light">+{dayEvents.length - 3}</span>
                                                )}
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
                    <div className="flex gap-2 mb-6">
                        <button
                            onClick={handleSync}
                            disabled={syncing}
                            className="flex-1 py-3 rounded-xl bg-primary/10 text-primary font-bold text-sm hover:bg-primary/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            <span className="material-symbols-outlined text-lg">sync</span>
                            {syncing ? 'Sincronizando...' : 'Sincronizar'}
                        </button>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="flex-1 py-3 rounded-xl bg-primary text-black font-bold text-sm hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                        >
                            <span className="material-symbols-outlined text-lg">add</span>
                            Nuevo
                        </button>
                    </div>

                    {/* Selected date info */}
                    <h3 className="text-lg font-bold mb-4">
                        {selectedDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </h3>

                    {/* Events list */}
                    <div className="flex-1 overflow-y-auto flex flex-col gap-3">
                        {loading ? (
                            <p className="text-center text-text-secondary-light py-8">Cargando...</p>
                        ) : selectedEvents.length === 0 ? (
                            <p className="text-center text-text-secondary-light py-8">No hay eventos para este día</p>
                        ) : (
                            selectedEvents.map(event => {
                                const colors = EVENT_COLORS[event.event_type] || EVENT_COLORS.custom;
                                return (
                                    <div key={event.id} className={`p-4 rounded-2xl border ${colors.bg} flex flex-col gap-2`}>
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <span className={`text-xs font-bold uppercase ${colors.text}`}>{colors.label}</span>
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
