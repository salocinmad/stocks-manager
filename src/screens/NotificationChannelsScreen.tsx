import React, { useEffect, useState } from 'react';
import { Header } from '../components/Header';
import { useAuth } from '../context/AuthContext';

// Shared content component (used in ProfileScreen and standalone)
export const NotificationChannelsContent: React.FC = () => {
    const { api } = useAuth();
    const [activeTab, setActiveTab] = useState<'telegram' | 'discord' | 'teams' | 'browser' | 'email'>('browser');
    const [channels, setChannels] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchChannels = async () => {
        try {
            const { data } = await api.get('/notifications/channels');
            setChannels(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchChannels();
    }, []);

    const getChannel = (type: string) => channels.find(c => c.channel_type === type);

    return (
        <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Tabs */}
            <div className="flex flex-wrap gap-2 md:gap-4 border-b border-border-light dark:border-border-dark pb-1">
                <button onClick={() => setActiveTab('browser')} className={`px-6 py-3 rounded-t-2xl font-bold transition-all flex items-center gap-2 ${activeTab === 'browser' ? 'bg-[#FF9500] text-white shadow-lg' : 'opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5'}`}>
                    <span className="material-symbols-outlined">desktop_windows</span> Push / Web
                </button>
                <button onClick={() => setActiveTab('email')} className={`px-6 py-3 rounded-t-2xl font-bold transition-all flex items-center gap-2 ${activeTab === 'email' ? 'bg-[#EA4335] text-white shadow-lg' : 'opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5'}`}>
                    <span className="material-symbols-outlined">mail</span> Email
                </button>
                <button onClick={() => setActiveTab('telegram')} className={`px-6 py-3 rounded-t-2xl font-bold transition-all flex items-center gap-2 ${activeTab === 'telegram' ? 'bg-[#2AABEE] text-white shadow-lg' : 'opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5'}`}>
                    <span className="material-symbols-outlined">send</span> Telegram
                </button>
                <button onClick={() => setActiveTab('discord')} className={`px-6 py-3 rounded-t-2xl font-bold transition-all flex items-center gap-2 ${activeTab === 'discord' ? 'bg-[#5865F2] text-white shadow-lg' : 'opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5'}`}>
                    <span className="material-symbols-outlined">discord</span> Discord
                </button>
                <button onClick={() => setActiveTab('teams')} className={`px-6 py-3 rounded-t-2xl font-bold transition-all flex items-center gap-2 ${activeTab === 'teams' ? 'bg-[#6264A7] text-white shadow-lg' : 'opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5'}`}>
                    <span className="material-symbols-outlined">groups</span> Teams
                </button>
            </div>

            {/* Content */}
            <div className="min-h-[400px]">
                {activeTab === 'browser' && <BrowserConfig channel={getChannel('browser')} onRefresh={fetchChannels} api={api} />}
                {activeTab === 'email' && <EmailConfig channel={getChannel('email')} onRefresh={fetchChannels} api={api} />}
                {activeTab === 'telegram' && <TelegramConfig channel={getChannel('telegram')} onRefresh={fetchChannels} api={api} />}
                {activeTab === 'discord' && <WebhookConfig type="discord" title="Discord" color="#5865F2" channel={getChannel('discord')} onRefresh={fetchChannels} api={api} />}
                {activeTab === 'teams' && <WebhookConfig type="teams" title="Microsoft Teams" color="#6264A7" channel={getChannel('teams')} onRefresh={fetchChannels} api={api} />}
            </div>
        </div>
    );
};

// Full screen version (for backwards compatibility if navigated directly)
export const NotificationChannelsScreen: React.FC = () => {
    return (
        <main className="flex-1 overflow-y-auto w-full p-6 md:p-10 lg:px-16 flex flex-col gap-10 bg-background-light dark:bg-background-dark">
            <Header title="Canales de Notificación" />
            <div className="max-w-5xl mx-auto w-full">
                <NotificationChannelsContent />
            </div>
        </main>
    );
};

// --- Subcomponents ---

const BrowserConfig = ({ channel, onRefresh, api }: any) => {
    const [permission, setPermission] = useState(Notification.permission);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);

    // Si no existe registro, asumimos que el usuario quiere notificaciones (True por defecto)
    // Solo mostraremos "Desactivado" si explícitamente viene false de la BD.
    const isActive = channel ? channel.is_active : true;

    const requestPermission = async () => {
        const result = await Notification.requestPermission();
        setPermission(result);
    };

    const handleToggle = async () => {
        setSaving(true);
        try {
            if (!channel) {
                // Si no existe registro, lo creamos primero activo
                // Pero si el usuario está haciendo click en el toggle que visualmente está "On" (por defecto),
                // significa que lo quiere apagar.
                // Espera, si isActive es true (default), el toggle está ON. El click quiere OFF.

                // Crear el canal, pero con el estado opuesto al actual (si era true visualmente, lo creamos false)
                // O más simple: creamos el canal default y luego hacemos toggle.
                await api.post('/notifications/channels', {
                    channel_type: 'browser',
                    config: {}
                });
                // El post crea por defecto active=true. Si queríamos apagarlo, hacemos toggle.
                if (isActive) {
                    await api.put(`/notifications/channels/browser/toggle`);
                }
            } else {
                await api.put(`/notifications/channels/browser/toggle`);
            }
            await onRefresh();
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    const handleTest = async () => {
        setTesting(true);
        try {
            // Usamos la API de test del backend para simular un push real si tenemos SW,
            // pero para "Browser Push" muchas veces es local. Lo haremos local para feedback inmediato.
            if (permission === 'granted') {
                new Notification('Stocks Manager', {
                    body: 'Prueba de notificación visual correcta ✅',
                    icon: '/vite.svg' // o icono de la app
                });
            } else {
                alert('Debes permitir las notificaciones en el navegador primero.');
            }

            // También llamamos al backend para testear el canal si se integrasen WebPush standards reales (VAPID)
            // await api.post('/notifications/test', { channel_type: 'browser', config: {} });
        } catch (e) {
            console.error(e);
        } finally {
            setTesting(false);
        }
    };

    return (
        <div className="flex flex-col xl:flex-row gap-8 animate-fade-in">
            <div className="flex-1 bg-white dark:bg-surface-dark p-8 rounded-3xl border border-border-light dark:border-border-dark">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-[#FF9500]">
                    <span className="material-symbols-outlined">desktop_windows</span>
                    Notificaciones Push
                </h3>
                <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mb-4">
                    Estas notificaciones aparecen en la esquina de tu pantalla cuando la aplicación está abierta en una pestaña del navegador.
                </p>
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between p-4 bg-background-light dark:bg-background-dark rounded-xl">
                        <span className="font-bold text-sm">Estado del Navegador</span>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${permission === 'granted' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {permission === 'granted' ? 'PERMITIDO' : permission === 'denied' ? 'BLOQUEADO' : 'PENDIENTE'}
                        </span>
                    </div>

                    {permission !== 'granted' && (
                        <button onClick={requestPermission} className="py-2 px-4 rounded-xl bg-[#FF9500] text-white font-bold text-sm hover:opacity-90">
                            Solicitar Permiso
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 flex flex-col gap-6 bg-white dark:bg-surface-dark p-8 rounded-3xl border border-border-light dark:border-border-dark h-fit">
                <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold">Configuración</h3>
                    <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${channel?.is_active ? 'text-green-500' : 'text-gray-400'}`}>
                            {channel?.is_active ? 'ACTIVADO' : 'DESACTIVADO'}
                        </span>
                        <button onClick={handleToggle} disabled={saving} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-all">
                            <span className={`material-symbols-outlined text-3xl ${channel?.is_active ? 'text-green-500' : 'text-gray-400'}`}>
                                {channel?.is_active ? 'toggle_on' : 'toggle_off'}
                            </span>
                        </button>
                    </div>
                </div>

                <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                    Activa este interruptor para permitir que Stocks Manager envíe alertas visuales mientras trabajas.
                </p>

                <button
                    onClick={handleTest}
                    className="w-full py-3 rounded-xl border-2 border-[#FF9500] text-[#FF9500] font-bold hover:bg-[#FF9500]/10 transition-all"
                >
                    Enviar Prueba Push
                </button>
            </div>
        </div>
    );
};



const EmailConfig = ({ channel, onRefresh, api }: any) => {
    const [testing, setTesting] = useState(false);
    const [saving, setSaving] = useState(false);

    // Default is ACTIVE if no record exists (or explicit active)
    const isActive = channel ? channel.is_active : true;

    const handleToggle = async () => {
        setSaving(true);
        try {
            if (!channel) {
                // Create record then toggle (to disable)
                await api.post('/notifications/channels', {
                    channel_type: 'email',
                    config: {}
                });
                await api.put(`/notifications/channels/email/toggle`);
            } else {
                await api.put(`/notifications/channels/email/toggle`);
            }
            await onRefresh();
        } catch (e) { console.error(e); }
        finally { setSaving(false); }
    };

    const handleTest = async () => {
        setTesting(true);
        try {
            await api.post('/notifications/test', {
                channel_type: 'email',
                config: {}
            });
            alert('Correo de prueba enviado. Revisa tu bandeja de entrada.');
        } catch (e) {
            alert('Error enviando correo de prueba.');
            console.error(e);
        } finally {
            setTesting(false);
        }
    };

    return (
        <div className="flex flex-col xl:flex-row gap-8 animate-fade-in">
            <div className="flex-1 bg-white dark:bg-surface-dark p-8 rounded-3xl border border-border-light dark:border-border-dark">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-[#EA4335]">
                    <span className="material-symbols-outlined">mail</span>
                    Notificaciones por Email
                </h3>
                <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mb-4">
                    Stocks Manager envía alertas a tu dirección de correo electrónico registrada por defecto.
                </p>
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 text-xs rounded-xl border border-yellow-200 dark:border-yellow-700">
                    <span className="font-bold block mb-1">Nota:</span>
                    Asegúrate de tener configurado el servidor SMTP en <strong className="underline cursor-pointer">Ajustes &gt; Sistema</strong> para que esto funcione.
                </div>
            </div>

            <div className="flex-1 flex flex-col gap-6 bg-white dark:bg-surface-dark p-8 rounded-3xl border border-border-light dark:border-border-dark h-fit">
                <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold">Configuración</h3>
                    <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${isActive ? 'text-green-500' : 'text-gray-400'}`}>
                            {isActive ? 'ACTIVADO' : 'DESACTIVADO'}
                        </span>
                        <button onClick={handleToggle} disabled={saving} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-all">
                            <span className={`material-symbols-outlined text-3xl ${isActive ? 'text-green-500' : 'text-gray-400'}`}>
                                {isActive ? 'toggle_on' : 'toggle_off'}
                            </span>
                        </button>
                    </div>
                </div>

                <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                    Desactiva este interruptor si prefieres recibir alertas solo por otros canales (Push, Telegram, etc).
                </p>

                <button
                    onClick={handleTest}
                    disabled={testing}
                    className="w-full py-3 rounded-xl border-2 border-[#EA4335] text-[#EA4335] font-bold hover:bg-[#EA4335]/10 transition-all disabled:opacity-50"
                >
                    {testing ? 'Enviando...' : 'Enviar Prueba Email'}
                </button>
            </div>
        </div>
    );
};


const TelegramConfig = ({ channel, onRefresh, api }: any) => {
    const [botToken, setBotToken] = useState(channel?.config?.botToken || '');
    const [chatId, setChatId] = useState(channel?.config?.chatId || '');
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);

    useEffect(() => {
        if (channel) {
            setBotToken(channel.config.botToken || '');
            setChatId(channel.config.chatId || '');
        }
    }, [channel]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.post('/notifications/channels', {
                channel_type: 'telegram',
                config: { botToken, chatId }
            });
            await onRefresh();
            alert('Configuración guardada correctamente.');
        } catch (e) {
            alert('Error al guardar configuración.');
        } finally {
            setSaving(false);
        }
    };

    const handleTest = async () => {
        setTesting(true);
        try {
            await api.post('/notifications/test', {
                channel_type: 'telegram',
                config: { botToken, chatId }
            });
            alert('¡Prueba enviada! Revisa tu Telegram.');
        } catch (e) {
            alert('Error en la prueba. Verifica tus credenciales.');
            console.error(e);
        } finally {
            setTesting(false);
        }
    };

    const handleToggle = async () => {
        if (!channel) return;
        await api.put(`/notifications/channels/telegram/toggle`);
        onRefresh();
    };

    return (
        <div className="flex flex-col xl:flex-row gap-8 animate-fade-in">
            {/* Guide */}
            <div className="flex-1 bg-white dark:bg-surface-dark p-8 rounded-3xl border border-border-light dark:border-border-dark">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#2AABEE]">info</span>
                    ¿Cómo configurarlo?
                </h3>
                <ol className="list-decimal list-inside space-y-4 text-sm text-text-secondary-light dark:text-text-secondary-dark">
                    <li>Abre Telegram y busca <strong>@BotFather</strong>.</li>
                    <li>Envía el comando <code>/newbot</code> y sigue las instrucciones para crear un bot.</li>
                    <li>Copia el <strong>HTTP API Token</strong> que te da BotFather y pégalo en el campo <em>Bot Token</em>.</li>
                    <li>Busca tu nuevo bot en Telegram y pulsa <strong>Iniciar</strong>.</li>
                    <li>Para obtener tu <strong>Chat ID</strong>, busca <strong>@userinfobot</strong> y púlsalo, te dirá tu ID numérico.</li>
                    <li>Pega ese número en el campo <em>Chat ID</em>.</li>
                </ol>
            </div>

            {/* Form */}
            <div className="flex-1 flex flex-col gap-6 bg-white dark:bg-surface-dark p-8 rounded-3xl border border-border-light dark:border-border-dark h-fit">
                <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold">Configuración Telegram</h3>
                    {channel && (
                        <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold ${channel.is_active ? 'text-green-500' : 'text-red-500'}`}>
                                {channel.is_active ? 'ACTIVO' : 'INACTIVO'}
                            </span>
                            <button onClick={handleToggle} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10">
                                <span className="material-symbols-outlined">{channel.is_active ? 'toggle_on' : 'toggle_off'}</span>
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold uppercase text-text-secondary-light">Bot Token</label>
                    <input
                        type="password"
                        value={botToken}
                        onChange={e => setBotToken(e.target.value)}
                        className="w-full rounded-2xl bg-background-light dark:bg-background-dark border-none p-4 text-sm font-mono focus:ring-2 focus:ring-[#2AABEE]"
                        placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                    />
                </div>

                <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold uppercase text-text-secondary-light">Chat ID</label>
                    <input
                        type="text"
                        value={chatId}
                        onChange={e => setChatId(e.target.value)}
                        className="w-full rounded-2xl bg-background-light dark:bg-background-dark border-none p-4 text-sm font-mono focus:ring-2 focus:ring-[#2AABEE]"
                        placeholder="12345678"
                    />
                </div>

                <div className="flex gap-4 mt-4">
                    <button
                        onClick={handleTest}
                        disabled={testing || !botToken || !chatId}
                        className="flex-1 py-3 rounded-xl border-2 border-[#2AABEE] text-[#2AABEE] font-bold hover:bg-[#2AABEE]/10 transition-all disabled:opacity-50"
                    >
                        {testing ? 'Enviando...' : 'Probar'}
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-[2] py-3 rounded-xl bg-[#2AABEE] text-white font-bold shadow-lg shadow-[#2AABEE]/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                    >
                        {saving ? 'Guardando...' : 'Guardar Configuración'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const WebhookConfig = ({ type, title, color, channel, onRefresh, api }: any) => {
    const [webhookUrl, setWebhookUrl] = useState(channel?.config?.webhookUrl || '');
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);

    useEffect(() => {
        if (channel) {
            setWebhookUrl(channel.config.webhookUrl || '');
        }
    }, [channel]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.post('/notifications/channels', {
                channel_type: type,
                config: { webhookUrl }
            });
            await onRefresh();
            alert('Configuración guardada correctamente.');
        } catch (e) {
            alert('Error al guardar configuración.');
        } finally {
            setSaving(false);
        }
    };

    const handleTest = async () => {
        setTesting(true);
        try {
            await api.post('/notifications/test', {
                channel_type: type,
                config: { webhookUrl }
            });
            alert(`¡Prueba enviada a ${title}!`);
        } catch (e) {
            alert('Error en la prueba. Verifica la URL.');
        } finally {
            setTesting(false);
        }
    };

    const handleToggle = async () => {
        if (!channel) return;
        await api.put(`/notifications/channels/${type}/toggle`);
        onRefresh();
    };

    return (
        <div className="flex flex-col xl:flex-row gap-8 animate-fade-in">
            <div className="flex-1 bg-white dark:bg-surface-dark p-8 rounded-3xl border border-border-light dark:border-border-dark">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2" style={{ color }}>
                    <span className="material-symbols-outlined">link</span>
                    ¿Cómo obtener el Webhook?
                </h3>
                {type === 'discord' ? (
                    <ol className="list-decimal list-inside space-y-4 text-sm text-text-secondary-light dark:text-text-secondary-dark">
                        <li>Ve a tu servidor de Discord.</li>
                        <li>Haz clic derecho en el canal donde quieres las alertas y selecciona <strong>Editar canal</strong>.</li>
                        <li>Ve a <strong>Integraciones</strong> &gt; <strong>Webhooks</strong>.</li>
                        <li>Haz clic en <strong>Nuevo Webhook</strong>, dale un nombre y copia la <strong>URL del Webhook</strong>.</li>
                        <li>Pega la URL aquí.</li>
                    </ol>
                ) : (
                    <ol className="list-decimal list-inside space-y-4 text-sm text-text-secondary-light dark:text-text-secondary-dark">
                        <li>En Microsoft Teams, ve al canal deseado.</li>
                        <li>Haz clic en los tres puntos (...) junto al nombre del canal y selecciona <strong>Conectores</strong>.</li>
                        <li>Busca <strong>Incoming Webhook</strong> y haz clic en Configurar/Añadir.</li>
                        <li>Dale un nombre y haz clic en Crear.</li>
                        <li>Copia la URL que aparece y pégala aquí.</li>
                    </ol>
                )}
            </div>

            <div className="flex-1 flex flex-col gap-6 bg-white dark:bg-surface-dark p-8 rounded-3xl border border-border-light dark:border-border-dark h-fit">
                <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold">Configuración {title}</h3>
                    {channel && (
                        <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold ${channel.is_active ? 'text-green-500' : 'text-red-500'}`}>
                                {channel.is_active ? 'ACTIVO' : 'INACTIVO'}
                            </span>
                            <button onClick={handleToggle} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10">
                                <span className="material-symbols-outlined">{channel.is_active ? 'toggle_on' : 'toggle_off'}</span>
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold uppercase text-text-secondary-light">Webhook URL</label>
                    <input
                        type="url"
                        value={webhookUrl}
                        onChange={e => setWebhookUrl(e.target.value)}
                        className="w-full rounded-2xl bg-background-light dark:bg-background-dark border-none p-4 text-sm font-mono focus:ring-2"
                        style={{ '--tw-ring-color': color } as any}
                        placeholder="https://..."
                    />
                </div>

                <div className="flex gap-4 mt-4">
                    <button
                        onClick={handleTest}
                        disabled={testing || !webhookUrl}
                        className="flex-1 py-3 rounded-xl border-2 font-bold hover:bg-opacity-10 transition-all disabled:opacity-50"
                        style={{ borderColor: color, color: color, backgroundColor: testing ? `${color}20` : 'transparent' }}
                    >
                        {testing ? 'Enviando...' : 'Probar'}
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-[2] py-3 rounded-xl text-white font-bold shadow-lg hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                        style={{ backgroundColor: color, shadowColor: `${color}40` }}
                    >
                        {saving ? 'Guardando...' : 'Guardar Configuración'}
                    </button>
                </div>
            </div>
        </div>
    );
};
