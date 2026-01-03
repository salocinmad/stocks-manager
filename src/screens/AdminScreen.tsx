import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Header } from '../components/Header';
import { useNavigate } from 'react-router-dom';
import { PromptEditor } from '../components/PromptEditor';
import { X } from 'lucide-react';
import { AIGeneral } from '../components/admin/AIGeneral';
import { AIProviders } from '../components/admin/AIProviders';
import { AdminSMTP } from '../components/admin/AdminSMTP';

interface User {
    id: string;
    email: string;
    name: string;
    role: 'admin' | 'user';
    isBlocked: boolean;
    twoFactorEnabled: boolean;
    securityMode: 'standard' | 'enhanced';
    createdAt: string;
}

interface SystemStats {
    users: { total: number; blocked: number };
    portfolios: number;
    positions: number;
    transactions: number;
    discovery?: {
        sectors: number;
        companies: number;
        lastUpdate: string | null;
    };
}

interface SmtpConfig {
    host: string;
    port: string;
    user: string;
    password: string;
    from: string;
}

type Tab = 'general' | 'market' | 'users' | 'api' | 'backup' | 'stats' | 'ai';

export const AdminScreen: React.FC = () => {
    const { api, isAdmin, user: currentUser } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<Tab>('general');
    const [generalSubTab, setGeneralSubTab] = useState<'config' | 'smtp' | 'discovery'>('config');
    const [users, setUsers] = useState<User[]>([]);
    const [stats, setStats] = useState<SystemStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [statsLoading, setStatsLoading] = useState(false);
    const [apiKeys, setApiKeys] = useState({ finnhub: '', google: '' });
    // AI Model
    const [aiSubTab, setAiSubTab] = useState<'general' | 'providers'>('general');

    // Legacy AI State removed (moved to components)

    // AI Prompts State removed (moved to components)

    const [generalConfig, setGeneralConfig] = useState({ appUrl: '' });
    const [saving, setSaving] = useState(false);

    // Market Sync
    const [syncPeriod, setSyncPeriod] = useState(1); // meses
    const [syncing, setSyncing] = useState(false);
    const [pnlRecalculating, setPnlRecalculating] = useState(false);

    // SMTP config
    // SMTP config moved to AdminSMTP component
    // const [smtpConfig, setSmtpConfig] = useState...

    // Backup State
    const [backupSubTab, setBackupSubTab] = useState<'manual' | 'scheduler' | 'tables'>('manual');
    const [backupLoading, setBackupLoading] = useState(false);
    const [restoreLoading, setRestoreLoading] = useState(false);
    const [tables, setTables] = useState<string[]>([]);

    // Scheduler State
    const [schedulerEnabled, setSchedulerEnabled] = useState(false);
    const [schedulerEmail, setSchedulerEmail] = useState('');
    const [schedulerFrequency, setSchedulerFrequency] = useState('daily');
    const [schedulerTime, setSchedulerTime] = useState('04:00');
    const [schedulerPassword, setSchedulerPassword] = useState('');
    const [schedulerDayOfWeek, setSchedulerDayOfWeek] = useState(1); // 0=Domingo, 1=Lunes, ..., 6=Sábado
    const [schedulerDayOfMonth, setSchedulerDayOfMonth] = useState(1); // 1-28
    const [schedulerSaving, setSchedulerSaving] = useState(false);
    const [sendingNow, setSendingNow] = useState(false);
    const [serverTime, setServerTime] = useState('');

    useEffect(() => {
        // Cargar hora del servidor cada minuto
        const interval = setInterval(() => {
            setServerTime(new Date().toLocaleTimeString('es-ES', { timeZone: 'Europe/Madrid' }));
        }, 1000);
        return () => clearInterval(interval);
    }, []);
    // Modal para cambiar contraseña
    const [passwordModal, setPasswordModal] = useState<User | null>(null);
    const [newPassword, setNewPassword] = useState('');

    // Crawler Config
    const [crawlerEnabled, setCrawlerEnabled] = useState(false);
    const [crawling, setCrawling] = useState(false);
    // Granular Config
    const [crawlerCycles, setCrawlerCycles] = useState('6');
    const [crawlerVolV8, setCrawlerVolV8] = useState('20');
    const [crawlerVolV10, setCrawlerVolV10] = useState('5');
    const [crawlerVolFinnhub, setCrawlerVolFinnhub] = useState('15');
    const [crawlerMarketOpenOnly, setCrawlerMarketOpenOnly] = useState(true);

    // Cargar config general
    // SMTP Handlers moved to AdminSMTP
    const loadGeneralConfig = useCallback(async () => {
        try {
            const { data } = await api.get('/admin/settings/general');
            setGeneralConfig(data);
        } catch (err) {
            console.error('Error loading general config:', err);
        }
    }, [api]);

    const loadCrawlerStatus = useCallback(async () => {
        try {
            const { data } = await api.get('/admin/settings/crawler');
            setCrawlerEnabled(data.enabled);
            // Load Granular
            if (data.cycles) setCrawlerCycles(String(data.cycles));
            if (data.volV8) setCrawlerVolV8(String(data.volV8));
            if (data.volV10) setCrawlerVolV10(String(data.volV10));
            if (data.volFinnhub) setCrawlerVolFinnhub(String(data.volFinnhub));
            if (data.marketOpenOnly !== undefined) setCrawlerMarketOpenOnly(data.marketOpenOnly);
        } catch (err) {
            console.error('Error loading crawler status:', err);
        }
    }, [api]);

    const saveCrawlerConfig = async () => {
        try {
            await api.post('/admin/settings/crawler/granular', {
                cycles: crawlerCycles,
                volV8: crawlerVolV8,
                volV10: crawlerVolV10,
                volFinnhub: crawlerVolFinnhub,
                marketOpenOnly: crawlerMarketOpenOnly
            });
            alert('Configuración del motor actualizada.');
        } catch (err) {
            console.error('Error saving crawler config:', err);
            alert('Error al guardar configuración.');
        }
    };

    const toggleCrawler = async () => {
        try {
            const newValue = !crawlerEnabled;
            await api.post('/admin/settings/crawler', { enabled: newValue });
            setCrawlerEnabled(newValue);
        } catch (err) {
            console.error('Error saving crawler status:', err);
            alert('Error al guardar estado del crawler');
        }
    };

    const runCrawler = async () => {
        setCrawling(true);
        try {
            const { data } = await api.post('/admin/settings/crawler/run');
            alert(data.message || 'Crawler iniciado manualmente.');
        } catch (err: any) {
            alert(err.response?.data?.message || 'Error al ejecutar crawler');
        } finally {
            setCrawling(false);
        }
    };

    // Guardar Config General
    const saveGeneralConfig = async () => {
        setSaving(true);
        try {
            await api.post('/admin/settings/general', generalConfig);
            alert('Configuración general guardada.');
        } catch (err: any) {
            alert(err.response?.data?.message || 'Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    // Sincronizar Mercado
    const handleSync = async (type: 'portfolio' | 'currencies' | 'all') => {
        setSyncing(true);
        try {
            await api.post('/admin/market/sync', { months: syncPeriod, type });
            alert(`Sincronización ${type} iniciada en segundo plano.`);
        } catch (err: any) {
            alert(err.response?.data?.message || 'Error al sincronizar');
        } finally {
            setSyncing(false);
        }
    };

    // Recalcular PnL
    const handleRecalculatePnL = async () => {
        if (!confirm('¿Recalcular el historial de PnL para TODOS los portafolios? Este proceso puede tardar varios minutos.')) return;
        setPnlRecalculating(true);
        try {
            const { data } = await api.post('/admin/pnl/recalculate');
            alert(data.message || 'Proceso de recálculo de PnL iniciado.');
        } catch (err: any) {
            alert(err.response?.data?.message || 'Error al iniciar recálculo de PnL');
        } finally {
            setPnlRecalculating(false);
        }
    };

    // Cargar usuarios
    const loadUsers = useCallback(async () => {
        try {
            const { data } = await api.get('/admin/users');
            setUsers(data);
        } catch (err) {
            console.error('Error loading users:', err);
        }
    }, [api]);

    // Cargar stats
    const loadStats = useCallback(async () => {
        setStatsLoading(true);
        try {
            const { data } = await api.get('/admin/stats');
            setStats(data);
        } catch (err) {
            console.error('Error loading stats:', err);
        } finally {
            setStatsLoading(false);
        }
    }, [api]);

    // Cargar API keys
    const loadApiKeys = useCallback(async () => {
        try {
            const { data } = await api.get('/admin/settings/api');
            setApiKeys(data);
        } catch (err) {
            console.error('Error loading API keys:', err);
        }
    }, [api]);

    // Cargar config IA (providers handled by component now)
    // We might still want to load something? No, components handle it.
    const loadAiConfig = useCallback(async () => {
        // Placeholder if needed, or remove call
    }, []);

    // Cargar SMTP config - Moved to AdminSMTP component
    // const loadSmtpConfig = useCallback(async () => { ... }, []);

    useEffect(() => {
        if (!isAdmin) {
            navigate('/');
            return;
        }

        const loadData = async () => {
            setLoading(true);
            await Promise.all([
                loadGeneralConfig(),
                loadUsers(),
                loadStats(),
                loadApiKeys(),
                loadAiConfig(),
                loadCrawlerStatus() // Added
            ]);
            setLoading(false);
        };
        loadData();
    }, [isAdmin, navigate, loadGeneralConfig, loadUsers, loadStats, loadApiKeys, loadAiConfig, loadCrawlerStatus]);

    // Bloquear/Desbloquear usuario
    const toggleBlock = async (userId: string, blocked: boolean) => {
        try {
            await api.put(`/admin/users/${userId}/block`, { blocked });
            await loadUsers();
        } catch (err: any) {
            alert(err.response?.data?.message || 'Error al cambiar estado');
        }
    };

    // Cambiar rol
    const changeRole = async (userId: string, newRole: 'admin' | 'user') => {
        if (!confirm(`¿Cambiar rol a ${newRole}?`)) return;
        try {
            await api.put(`/admin/users/${userId}/role`, { role: newRole });
            await loadUsers();
        } catch (err: any) {
            alert(err.response?.data?.message || 'Error al cambiar rol');
        }
    };

    // Cambiar contraseña
    const changePassword = async () => {
        if (!passwordModal || !newPassword) return;
        if (newPassword.length < 6) {
            alert('La contraseña debe tener al menos 6 caracteres');
            return;
        }
        try {
            await api.put(`/admin/users/${passwordModal.id}/password`, { newPassword });
            setPasswordModal(null);
            setNewPassword('');
            alert('Contraseña actualizada');
        } catch (err: any) {
            alert(err.response?.data?.message || 'Error al cambiar contraseña');
        }
    };

    // Eliminar usuario
    const deleteUser = async (userId: string, email: string) => {
        if (!confirm(`¿Estás seguro de eliminar al usuario ${email}? Esta acción es irreversible.`)) return;
        try {
            await api.delete(`/admin/users/${userId}`);
            await loadUsers();
            await loadStats();
        } catch (err: any) {
            alert(err.response?.data?.message || 'Error al eliminar usuario');
        }
    };

    // Reset 2FA para usuario
    const reset2FA = async (userId: string, email: string) => {
        if (!confirm(`¿Desactivar 2FA para ${email}?`)) return;
        try {
            await api.delete(`/admin/users/${userId}/2fa`);
            await loadUsers();
            alert('2FA desactivado');
        } catch (err: any) {
            alert(err.response?.data?.message || 'Error al resetear 2FA');
        }
    };

    // Reset security mode para usuario
    const resetSecurityMode = async (userId: string, email: string) => {
        if (!confirm(`¿Cambiar modo de seguridad a estándar para ${email}?`)) return;
        try {
            await api.patch(`/admin/users/${userId}/security-mode`, { mode: 'standard' });
            await loadUsers();
            alert('Modo de seguridad cambiado a estándar');
        } catch (err: any) {
            alert(err.response?.data?.message || 'Error al cambiar modo');
        }
    };

    // Guardar config IA (modelo) - Moved to AIGeneral

    // Prompt Handlers
    // Logic moved to AIGeneral

    // Guardar API keys y configuración IA
    const saveApiKeys = async () => {
        setSaving(true);
        try {
            await api.post('/admin/settings/api', apiKeys);
            await api.post('/admin/settings/api', apiKeys);
            // AI Config saved individually
            alert('Claves API actualizadas.');
        } catch (err: any) {
            alert(err.response?.data?.message || 'Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    // Guardar SMTP config - Moved to AdminSMTP component
    // const saveSmtpConfig = async () => { ... };

    // Enviar email de prueba - Moved to AdminSMTP component
    // const sendTestEmail = async () => { ... };

    if (!isAdmin) return null;

    // Descargar backup ZIP
    const downloadBackupZip = async () => {
        setBackupLoading(true);
        try {
            const { data } = await api.get('/admin/backup/zip', { responseType: 'blob' });
            const url = URL.createObjectURL(new Blob([data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = `stocks-manager-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err: any) {
            alert(err.response?.data?.message || 'Error al crear backup ZIP');
        } finally {
            setBackupLoading(false);
        }
    };

    // Descargar backup JSON
    const downloadBackupJson = async () => {
        setBackupLoading(true);
        try {
            const { data } = await api.get('/admin/backup/json');
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `stocks-manager-data-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err: any) {
            alert(err.response?.data?.message || 'Error al crear backup JSON');
        } finally {
            setBackupLoading(false);
        }
    };



    // Descargar backup SQL
    const downloadBackupSql = async () => {
        setBackupLoading(true);
        try {
            // Request text response to avoid JSON parsing errors
            const { data } = await api.get('/admin/backup/sql', { responseType: 'text' });
            const blob = new Blob([data], { type: 'text/sql' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `stocks-manager-backup-${new Date().toISOString().split('T')[0]}.sql`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err: any) {
            alert(err.response?.data?.message || 'Error al crear backup SQL');
        } finally {
            setBackupLoading(false);
        }
    };

    // Cargar tablas
    const loadTables = async () => {
        try {
            const { data } = await api.get('/admin/backup/tables');
            setTables(data);
        } catch (err) {
            console.error('Error loading tables:', err);
        }
    };

    // Restaurar desde archivo (ZIP o SQL)
    const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const isZip = file.name.endsWith('.zip');
        const isJson = file.name.endsWith('.json');
        const isSql = file.name.endsWith('.sql');

        if (!isZip && !isJson && !isSql) {
            alert('Formato no soportado. Usa .zip (Completo), .json (Datos) o .sql');
            e.target.value = '';
            return;
        }

        if (!confirm('¿Estás seguro? Esto REEMPLAZARÁ TODOS los datos actuales e imágenes con los del backup. Esta acción es irreversible.')) {
            e.target.value = '';
            return;
        }

        setRestoreLoading(true);
        try {
            if (isZip || isJson) {
                const formData = new FormData();
                formData.append('file', file);

                // Enviar como multipart/form-data
                await api.post('/admin/backup/restore', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            } else {
                // SQL Restore
                const text = await file.text();
                await api.post('/admin/backup/restore-sql', { sqlScript: text });
            }

            alert('Sistema restaurado correctamente. Se recomienda cerrar sesión y volver a entrar.');
            await loadStats();
            await loadUsers();
        } catch (err: any) {
            alert(err.response?.data?.message || err.message || 'Error al restaurar');
        } finally {
            setRestoreLoading(false);
            e.target.value = '';
        }
    };

    // Cargar tablas cuando se active el tab backup
    React.useEffect(() => {
        if (activeTab === 'users') loadUsers();
        if (activeTab === 'stats') loadStats();
        if (activeTab === 'api') loadApiKeys();
        if (activeTab === 'backup') {
            loadTables();
            loadBackupSettings();
        }
    }, [activeTab, loadUsers, loadStats, loadApiKeys]);

    const loadBackupSettings = async () => {
        try {
            const { data } = await api.get('/admin/settings/backup');
            const { enabled, email, frequency, time, password, dayOfWeek, dayOfMonth } = data;
            setSchedulerEnabled(enabled);
            setSchedulerEmail(email);
            setSchedulerFrequency(frequency);
            setSchedulerTime(time);
            setSchedulerPassword(password || '');
            setSchedulerDayOfWeek(dayOfWeek ?? 1);
            setSchedulerDayOfMonth(dayOfMonth ?? 1);
        } catch (error) {
            console.error('Error loading backup settings:', error);
        }
    };

    const saveBackupSettings = async () => {
        setSchedulerSaving(true);
        try {
            await api.post('/admin/settings/backup', {
                enabled: schedulerEnabled,
                email: schedulerEmail,
                frequency: schedulerFrequency,
                time: schedulerTime,
                password: schedulerPassword,
                dayOfWeek: schedulerDayOfWeek,
                dayOfMonth: schedulerDayOfMonth
            });
            // Show toast or alert?
            alert('Configuración guardada correctamente');
        } catch (error: any) {
            console.error('Error saving backup settings:', error);
            alert('Error al guardar configuración: ' + (error.response?.data?.message || error.message));
        } finally {
            setSchedulerSaving(false);
        }
    };

    const handleSendNow = async () => {
        if (!schedulerEmail) return alert('Debes configurar un email primero');
        setSendingNow(true);
        try {
            await api.post('/admin/settings/backup/send-now', {
                email: schedulerEmail
            });
            alert('Backup enviado correctamente por correo');
        } catch (error: any) {
            console.error('Error sending backup:', error);
            alert('Error al enviar backup: ' + (error.response?.data?.message || error.message));
        } finally {
            setSendingNow(false);
        }
    };
    const tabs = [
        { id: 'general' as Tab, label: 'General', icon: 'settings' },
        { id: 'ai' as Tab, label: 'Inteligencia Artificial', icon: 'psychology' },
        { id: 'market' as Tab, label: 'Mercado', icon: 'monitoring' },
        { id: 'users' as Tab, label: 'Usuarios', icon: 'group' },
        { id: 'api' as Tab, label: 'Claves API', icon: 'key' },
        { id: 'backup' as Tab, label: 'Backup', icon: 'backup' },
        { id: 'stats' as Tab, label: 'Estadísticas', icon: 'analytics' },
    ];

    return (
        <main className="flex-1 flex flex-col h-full bg-background-light dark:bg-background-dark overflow-y-auto">
            <Header title="Administración" />

            <div className="max-w-[1400px] mx-auto w-full px-6 py-8">
                {/* Tabs */}
                <div className="flex gap-2 mb-8 bg-surface-light dark:bg-surface-dark rounded-2xl p-2 flex-wrap">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${activeTab === tab.id
                                ? 'bg-primary text-black shadow-lg'
                                : 'text-text-secondary-light hover:bg-background-light dark:hover:bg-surface-dark-elevated'
                                }`}
                        >
                            <span className="material-symbols-outlined text-xl">{tab.icon}</span>
                            {tab.label}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    <>
                        {/* Tab: General */}
                        {activeTab === 'general' && (
                            <div className="animate-fade-in w-full max-w-2xl">
                                <div className="flex gap-2 mb-6 border-b border-border-light dark:border-border-dark pb-1">
                                    <button
                                        onClick={() => setGeneralSubTab('config')}
                                        className={`px-4 py-2 text-sm font-bold rounded-t-xl transition-all ${generalSubTab === 'config'
                                            ? 'bg-primary/10 text-primary border-b-2 border-primary'
                                            : 'text-text-secondary-light hover:text-text-primary dark:hover:text-gray-200'
                                            }`}
                                    >
                                        Configuración
                                    </button>
                                    <button
                                        onClick={() => setGeneralSubTab('smtp')}
                                        className={`px-4 py-2 text-sm font-bold rounded-t-xl transition-all ${generalSubTab === 'smtp'
                                            ? 'bg-primary/10 text-primary border-b-2 border-primary'
                                            : 'text-text-secondary-light hover:text-text-primary dark:hover:text-gray-200'
                                            }`}
                                    >
                                        SMTP (Correo)
                                    </button>
                                    <button
                                        onClick={() => setGeneralSubTab('discovery')}
                                        className={`px-4 py-2 text-sm font-bold rounded-t-xl transition-all ${generalSubTab === 'discovery'
                                            ? 'bg-primary/10 text-primary border-b-2 border-primary'
                                            : 'text-text-secondary-light hover:text-text-primary dark:hover:text-gray-200'
                                            }`}
                                    >
                                        Discovery Engine
                                    </button>
                                </div>

                                {generalSubTab === 'config' && (
                                    <div className="bg-surface-light dark:bg-surface-dark rounded-3xl p-6 animate-fade-in">
                                        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                                            <span className="material-symbols-outlined">settings</span>
                                            Configuración General
                                        </h2>

                                        <div className="flex flex-col gap-6">
                                            <div>
                                                <label className="block text-xs font-bold uppercase text-text-secondary-light mb-2">
                                                    URL Pública de la Aplicación
                                                </label>
                                                <input
                                                    type="url"
                                                    value={generalConfig.appUrl}
                                                    onChange={e => setGeneralConfig({ ...generalConfig, appUrl: e.target.value })}
                                                    className="w-full px-4 py-3 bg-background-light dark:bg-surface-dark-elevated rounded-xl border-none focus:ring-2 focus:ring-primary font-mono text-sm"
                                                    placeholder="https://stocks.salodev.ovh"
                                                />
                                                <p className="text-xs text-text-secondary-light mt-2">
                                                    Esta URL se utilizará en las notificaciones (Teams, Email, etc.) para redirigir a los usuarios.
                                                </p>
                                            </div>

                                            <button
                                                onClick={saveGeneralConfig}
                                                disabled={saving}
                                                className="px-6 py-4 bg-primary text-black font-bold rounded-2xl hover:opacity-90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 mt-4"
                                            >
                                                {saving ? 'Guardando...' : 'Guardar Configuración'}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {generalSubTab === 'smtp' && (
                                    <AdminSMTP />
                                )}

                                {generalSubTab === 'discovery' && (
                                    <div className="bg-surface-light dark:bg-surface-dark rounded-3xl p-6 animate-fade-in">
                                        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                                            <span className="material-symbols-outlined text-amber-500">rocket_launch</span>
                                            Motor de Descubrimiento
                                        </h2>

                                        {/* --- MAIN CONTROL --- */}
                                        <div className="p-5 bg-background-light dark:bg-surface-dark-elevated rounded-xl border border-border-light dark:border-border-dark mb-6 shadow-sm">
                                            <div className="flex justify-between items-center mb-4">
                                                <div>
                                                    <h3 className="font-bold text-lg flex items-center gap-2">
                                                        Control Maestro
                                                    </h3>
                                                    <p className="text-xs text-text-secondary-light">
                                                        Activa o desactiva todo el sistema de descubrimiento automático.
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <button
                                                        onClick={runCrawler}
                                                        disabled={crawling}
                                                        className="px-4 py-2 bg-primary/10 text-primary text-xs font-bold rounded-lg hover:bg-primary/20 transition-all disabled:opacity-50 flex items-center gap-1"
                                                    >
                                                        <span className={`material-symbols-outlined text-sm ${crawling ? 'animate-spin' : ''}`}>
                                                            {crawling ? 'sync' : 'play_arrow'}
                                                        </span>
                                                        {crawling ? 'Ejecutando...' : 'Ejecutar Ahora'}
                                                    </button>

                                                    <div className="relative inline-block w-12 align-middle select-none transition duration-200 ease-in">
                                                        <input
                                                            type="checkbox"
                                                            checked={crawlerEnabled}
                                                            onChange={toggleCrawler}
                                                            className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer checkbox-toggle"
                                                            style={{ right: crawlerEnabled ? '0' : 'auto', left: crawlerEnabled ? 'auto' : '0', borderColor: crawlerEnabled ? '#22c55e' : '#cbd5e1' }}
                                                        />
                                                        <label className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${crawlerEnabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}></label>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 text-xs">
                                                <div className={`px-2 py-1 rounded ${crawlerEnabled ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                                    Estado: <strong>{crawlerEnabled ? 'ACTIVO' : 'INACTIVO'}</strong>
                                                </div>
                                            </div>
                                        </div>

                                        {/* --- PRESETS --- */}
                                        <div className="mb-8">
                                            <h4 className="text-sm font-bold text-text-secondary-light uppercase mb-3">Modos Rápidos (Presets)</h4>
                                            <div className="grid grid-cols-3 gap-3">
                                                <button
                                                    onClick={() => {
                                                        setCrawlerCycles('2'); setCrawlerVolV8('10'); setCrawlerVolV10('5'); setCrawlerVolFinnhub('5');
                                                    }}
                                                    className="p-3 rounded-xl border border-border-light dark:border-border-dark hover:border-primary/50 bg-background-light dark:bg-surface-dark-elevated transition-all text-left"
                                                >
                                                    <div className="text-xl mb-1">🐢</div>
                                                    <div className="font-bold text-sm">Modo Sigilo</div>
                                                    <div className="text-[10px] text-text-secondary-light">2 ciclos/h - Bajo consumo</div>
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setCrawlerCycles('6'); setCrawlerVolV8('20'); setCrawlerVolV10('5'); setCrawlerVolFinnhub('15');
                                                    }}
                                                    className="p-3 rounded-xl border border-primary bg-primary/5 dark:bg-primary/10 transition-all text-left"
                                                >
                                                    <div className="text-xl mb-1">⚖️</div>
                                                    <div className="font-bold text-sm text-primary">Balanceado</div>
                                                    <div className="text-[10px] text-text-secondary-light">6 ciclos/h (Default)</div>
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setCrawlerCycles('12'); setCrawlerVolV8('80'); setCrawlerVolV10('20'); setCrawlerVolFinnhub('30');
                                                    }}
                                                    className="p-3 rounded-xl border border-red-500/30 bg-red-500/5 hover:bg-red-500/10 transition-all text-left group"
                                                >
                                                    <div className="text-xl mb-1 group-hover:scale-110 transition-transform">🐺</div>
                                                    <div className="font-bold text-sm text-red-400">Wolf Mode</div>
                                                    <div className="text-[10px] text-text-secondary-light">12 ciclos/h - Máximo volumen</div>
                                                </button>
                                            </div>
                                        </div>

                                        {/* --- GRANULAR CONTROLS --- */}
                                        <div className="space-y-6 border-t border-border-light dark:border-border-dark pt-6">

                                            {/* Cycles Per Hour */}
                                            <div>
                                                <div className="flex justify-between mb-2">
                                                    <label className="text-sm font-bold flex items-center gap-1">
                                                        Frecuencia de Ciclos
                                                        <span className="material-symbols-outlined text-xs text-text-secondary-light cursor-help" title="Cuántas veces por hora se ejecutará el crawler. 6 = Cada 10 mins. 12 = Cada 5 mins.">help</span>
                                                    </label>
                                                    <span className="text-sm font-mono bg-background-light dark:bg-black/20 px-2 rounded text-primary">{crawlerCycles} / hora</span>
                                                </div>
                                                <input
                                                    type="range" min="1" max="30" step="1"
                                                    value={crawlerCycles}
                                                    onChange={(e) => setCrawlerCycles(e.target.value)}
                                                    className="w-full accent-primary h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                                                />
                                                <div className="flex justify-between text-[10px] text-text-secondary-light mt-1">
                                                    <span>1 (c/60m)</span>
                                                    <span>6 (c/10m)</span>
                                                    <span>12 (c/5m)</span>
                                                    <span>30 (c/2m)</span>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                {/* V8 Volume */}
                                                <div>
                                                    <div className="flex justify-between mb-2">
                                                        <label className="text-xs font-bold uppercase text-text-secondary-light flex items-center gap-1">
                                                            Global Fast (Resto del Mundo - Rápido) <span className="text-gray-400 font-normal ml-1 text-[10px]">(Motor: Yahoo V8)</span>
                                                            <span className="material-symbols-outlined text-[10px] cursor-help" title="Busca en mercados internacionales (ES, DE, UK...) y guarda datos básicos rápidos.">help</span>
                                                        </label>
                                                        <span className="text-xs font-mono">{crawlerVolV8} items</span>
                                                    </div>
                                                    <input
                                                        type="range" min="10" max="200" step="10"
                                                        value={crawlerVolV8}
                                                        onChange={(e) => setCrawlerVolV8(e.target.value)}
                                                        className="w-full accent-blue-500 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                                                    />
                                                </div>

                                                {/* V10 Volume */}
                                                <div>
                                                    <div className="flex justify-between mb-2">
                                                        <label className="text-xs font-bold uppercase text-text-secondary-light flex items-center gap-1">
                                                            Global Deep (Resto del Mundo - Profundo) <span className="text-purple-300 font-normal ml-1 text-[10px]">(Motor: Yahoo V10)</span>
                                                            <span className="material-symbols-outlined text-[10px] cursor-help" title="Selecciona empresas internacionales, verifica frescura y descarga análisis fundamental completo.">help</span>
                                                        </label>
                                                        <span className="text-xs font-mono text-purple-400">{crawlerVolV10} items</span>
                                                    </div>
                                                    <input
                                                        type="range" min="1" max="50" step="1"
                                                        value={crawlerVolV10}
                                                        onChange={(e) => setCrawlerVolV10(e.target.value)}
                                                        className="w-full accent-purple-500 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                                                    />
                                                </div>

                                                {/* Finnhub Volume */}
                                                <div>
                                                    <div className="flex justify-between mb-2">
                                                        <label className="text-xs font-bold uppercase text-text-secondary-light flex items-center gap-1">
                                                            Pipeline USA (Filtro America) <span className="text-orange-300 font-normal ml-1 text-[10px]">(Motor: Yahoo V10)</span>
                                                            <span className="material-symbols-outlined text-[10px] cursor-help" title="Busca y filtra solo empresas de EE.UU., verificando frescura y descargando datos completos.">help</span>
                                                        </label>
                                                        <span className="text-xs font-mono text-orange-400">{crawlerVolFinnhub} items</span>
                                                    </div>
                                                    <input
                                                        type="range" min="5" max="50" step="5"
                                                        value={crawlerVolFinnhub}
                                                        onChange={(e) => setCrawlerVolFinnhub(e.target.value)}
                                                        className="w-full accent-orange-500 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                                                    />
                                                </div>
                                            </div>

                                            {/* Checks */}
                                            <div className="flex items-center gap-2 mt-4 p-3 rounded-xl bg-background-light dark:bg-surface-dark-elevated">
                                                <input
                                                    type="checkbox"
                                                    id="marketOpen"
                                                    checked={crawlerMarketOpenOnly}
                                                    onChange={(e) => setCrawlerMarketOpenOnly(e.target.checked)}
                                                    className="w-4 h-4 text-primary rounded focus:ring-primary bg-gray-100 border-gray-300 dark:bg-gray-700 dark:border-gray-600"
                                                />
                                                <label htmlFor="marketOpen" className="ml-2 text-sm font-medium text-text-primary cursor-pointer select-none">
                                                    Priorizar <strong>Mercado Abierto</strong> (Buscar Day Gainers si Market Open)
                                                </label>
                                            </div>

                                            <button
                                                onClick={saveCrawlerConfig}
                                                className="w-full py-3 bg-primary text-black font-bold rounded-xl hover:opacity-90 shadow-lg shadow-primary/10 mt-4"
                                            >
                                                Guardar Configuración Avanzada
                                            </button>
                                        </div>


                                        <div className="mt-6 p-4 bg-blue-500/10 rounded-xl border border-blue-500/20">
                                            <h4 className="font-bold text-sm text-blue-500 mb-2 flex items-center gap-1">
                                                <span className="material-symbols-outlined text-sm">info</span>
                                                Información
                                            </h4>
                                            <p className="text-xs text-text-secondary-light">
                                                El crawler busca oportunidades de inversión en múltiples sectores usando
                                                <strong> Yahoo Finance</strong> y <strong>Finnhub</strong>.
                                                Se ejecuta en segundo plano. Los resultados se muestran en el Dashboard y se analizan por la IA.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Tab: Mercado (Market Data Sync) */}
                        {activeTab === 'market' && (
                            <div className="bg-surface-light dark:bg-surface-dark rounded-3xl p-6 max-w-2xl animate-fade-in">
                                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                                    <span className="material-symbols-outlined">cloud_sync</span>
                                    Sincronización de Mercado
                                </h2>

                                <p className="text-sm text-text-secondary-light mb-6">
                                    Actualiza manualmente los precios históricos y tipos de cambio desde Yahoo Finance.
                                    Este proceso se ejecuta automáticamente cada noche (04:00 AM Madrid) por 1 mes, pero puedes forzar una carga completa aquí.
                                </p>

                                <div className="mb-8">
                                    <label className="block text-xs font-bold uppercase text-text-secondary-light mb-3">Periodo a Sincronizar</label>
                                    <div className="flex gap-2 flex-wrap">
                                        {[
                                            { l: '5 Días', v: 0.16 },
                                            { l: '1 Mes', v: 1 },
                                            { l: '6 Meses', v: 6 },
                                            { l: '1 Año', v: 12 },
                                            { l: '2 Años', v: 24 },
                                            { l: '5 Años', v: 60 }
                                        ].map(opt => (
                                            <button
                                                key={opt.l}
                                                onClick={() => setSyncPeriod(opt.v)}
                                                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border-2 ${syncPeriod === opt.v
                                                    ? 'border-primary bg-primary/10 text-primary'
                                                    : 'border-border-light dark:border-border-dark hover:border-primary/50 text-text-secondary-light'
                                                    }`}
                                            >
                                                {opt.l}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <button
                                        onClick={() => handleSync('all')}
                                        disabled={syncing}
                                        className="col-span-1 md:col-span-2 py-4 px-6 bg-primary text-black font-bold rounded-2xl hover:opacity-90 flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
                                    >
                                        {syncing ? <span className="animate-spin material-symbols-outlined">sync</span> : <span className="material-symbols-outlined">sync</span>}
                                        Sincronizar TODO (Recomendado)
                                    </button>

                                    <button
                                        onClick={() => handleSync('portfolio')}
                                        disabled={syncing}
                                        className="py-3 px-4 bg-background-light dark:bg-surface-dark-elevated font-semibold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center gap-2 transition-all disabled:opacity-50 text-text-primary"
                                    >
                                        <span className="material-symbols-outlined">candlestick_chart</span>
                                        Solo Acciones
                                    </button>

                                    <button
                                        onClick={() => handleSync('currencies')}
                                        disabled={syncing}
                                        className="py-3 px-4 bg-background-light dark:bg-surface-dark-elevated font-semibold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center gap-2 transition-all disabled:opacity-50 text-text-primary"
                                    >
                                        <span className="material-symbols-outlined">currency_exchange</span>
                                        Solo Divisas
                                    </button>
                                </div>

                                {/* Sección: Recalcular PnL */}
                                <hr className="border-border-light dark:border-border-dark my-8" />
                                <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                                    <span className="material-symbols-outlined">show_chart</span>
                                    Recalcular Gráfico de PnL
                                </h3>
                                <p className="text-sm text-text-secondary-light mb-4">
                                    Si el gráfico de Ganancias/Pérdidas muestra datos incorrectos o desactualizados,
                                    puedes forzar un recálculo completo desde la primera transacción de cada portafolio.
                                </p>
                                <button
                                    onClick={handleRecalculatePnL}
                                    disabled={pnlRecalculating}
                                    className="py-3 px-6 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50"
                                >
                                    {pnlRecalculating ? <span className="animate-spin material-symbols-outlined">sync</span> : <span className="material-symbols-outlined">refresh</span>}
                                    {pnlRecalculating ? 'Recalculando...' : 'Recalcular PnL Global'}
                                </button>
                            </div>
                        )}

                        {/* Tab: Usuarios */}
                        {activeTab === 'users' && (
                            <div className="bg-surface-light dark:bg-surface-dark rounded-3xl p-6 animate-fade-in">
                                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                                    <span className="material-symbols-outlined">group</span>
                                    Gestión de Usuarios ({users.length})
                                </h2>

                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="text-xs font-bold uppercase text-text-secondary-light border-b border-border-light dark:border-border-dark">
                                                <th className="px-4 py-3 text-left">Usuario</th>
                                                <th className="px-4 py-3 text-center">Rol</th>
                                                <th className="px-4 py-3 text-center">Estado</th>
                                                <th className="px-4 py-3 text-center">2FA</th>
                                                <th className="px-4 py-3 text-center">Registrado</th>
                                                <th className="px-4 py-3 text-center">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {users.map(u => (
                                                <tr key={u.id} className="border-b border-border-light/50 dark:border-border-dark/30 hover:bg-background-light dark:hover:bg-surface-dark-elevated/40 transition-colors">
                                                    <td className="px-4 py-4">
                                                        <div className="flex flex-col">
                                                            <span className="font-semibold">{u.name || 'Sin nombre'}</span>
                                                            <span className="text-sm text-text-secondary-light">{u.email}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4 text-center">
                                                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${u.role === 'admin'
                                                            ? 'bg-primary/20 text-primary'
                                                            : 'bg-blue-500/20 text-blue-500'
                                                            }`}>
                                                            {u.role === 'admin' ? 'Admin' : 'Usuario'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-4 text-center">
                                                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${u.isBlocked
                                                            ? 'bg-red-500/20 text-red-500'
                                                            : 'bg-green-500/20 text-green-500'
                                                            }`}>
                                                            {u.isBlocked ? 'Bloqueado' : 'Activo'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-4 text-center">
                                                        {u.twoFactorEnabled ? (
                                                            <div className="flex flex-col items-center gap-1">
                                                                <span className="px-2 py-1 rounded-full text-xs font-bold bg-green-500/20 text-green-500">
                                                                    ✓ Activo
                                                                </span>
                                                                {u.securityMode === 'enhanced' && (
                                                                    <span className="text-[10px] text-purple-500">Reforzado</span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-text-secondary-light">—</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-4 text-center text-sm text-text-secondary-light">
                                                        {new Date(u.createdAt).toLocaleDateString('es-ES')}
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <div className="flex items-center justify-center gap-1">
                                                            {/* Cambiar rol */}
                                                            {u.id !== currentUser?.id && (
                                                                <button
                                                                    onClick={() => changeRole(u.id, u.role === 'admin' ? 'user' : 'admin')}
                                                                    className="p-2 rounded-lg hover:bg-primary/20 text-text-secondary-light hover:text-primary transition-all"
                                                                    title={u.role === 'admin' ? 'Quitar admin' : 'Hacer admin'}
                                                                >
                                                                    <span className="material-symbols-outlined text-lg">
                                                                        {u.role === 'admin' ? 'person_remove' : 'admin_panel_settings'}
                                                                    </span>
                                                                </button>
                                                            )}

                                                            {/* Bloquear/Desbloquear */}
                                                            {u.id !== currentUser?.id && (
                                                                <button
                                                                    onClick={() => toggleBlock(u.id, !u.isBlocked)}
                                                                    className={`p-2 rounded-lg transition-all ${u.isBlocked
                                                                        ? 'hover:bg-green-500/20 text-text-secondary-light hover:text-green-500'
                                                                        : 'hover:bg-orange-500/20 text-text-secondary-light hover:text-orange-500'
                                                                        }`}
                                                                    title={u.isBlocked ? 'Desbloquear' : 'Bloquear'}
                                                                >
                                                                    <span className="material-symbols-outlined text-lg">
                                                                        {u.isBlocked ? 'lock_open' : 'block'}
                                                                    </span>
                                                                </button>
                                                            )}

                                                            {/* Cambiar contraseña */}
                                                            <button
                                                                onClick={() => setPasswordModal(u)}
                                                                className="p-2 rounded-lg hover:bg-blue-500/20 text-text-secondary-light hover:text-blue-500 transition-all"
                                                                title="Cambiar contraseña"
                                                            >
                                                                <span className="material-symbols-outlined text-lg">password</span>
                                                            </button>

                                                            {/* Eliminar */}
                                                            {u.id !== currentUser?.id && (
                                                                <button
                                                                    onClick={() => deleteUser(u.id, u.email)}
                                                                    className="p-2 rounded-lg hover:bg-red-500/20 text-text-secondary-light hover:text-red-500 transition-all"
                                                                    title="Eliminar usuario"
                                                                >
                                                                    <span className="material-symbols-outlined text-lg">delete</span>
                                                                </button>
                                                            )}

                                                            {/* Reset 2FA */}
                                                            {u.twoFactorEnabled && u.id !== currentUser?.id && (
                                                                <button
                                                                    onClick={() => reset2FA(u.id, u.email)}
                                                                    className="p-2 rounded-lg hover:bg-purple-500/20 text-text-secondary-light hover:text-purple-500 transition-all"
                                                                    title="Desactivar 2FA"
                                                                >
                                                                    <span className="material-symbols-outlined text-lg">key_off</span>
                                                                </button>
                                                            )}

                                                            {/* Reset Security Mode */}
                                                            {u.securityMode === 'enhanced' && u.id !== currentUser?.id && (
                                                                <button
                                                                    onClick={() => resetSecurityMode(u.id, u.email)}
                                                                    className="p-2 rounded-lg hover:bg-amber-500/20 text-text-secondary-light hover:text-amber-500 transition-all"
                                                                    title="Cambiar a modo estándar"
                                                                >
                                                                    <span className="material-symbols-outlined text-lg">shield</span>
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}


                        {/* Tab: AI Settings */}
                        {activeTab === 'ai' && (
                            <div className="bg-surface-light dark:bg-surface-dark rounded-3xl p-6 max-w-4xl animate-fade-in">
                                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                                    <span className="material-symbols-outlined">psychology</span>
                                    Configuración de IA
                                </h2>

                                <div className="flex gap-2 mb-6 border-b border-border-light dark:border-border-dark pb-1">
                                    <button
                                        onClick={() => setAiSubTab('general')}
                                        className={`px-4 py-2 text-sm font-bold rounded-t-xl transition-all ${aiSubTab === 'general'
                                            ? 'bg-primary/10 text-primary border-b-2 border-primary'
                                            : 'text-text-secondary-light hover:text-text-primary dark:hover:text-gray-200'
                                            }`}
                                    >
                                        General y Prompts
                                    </button>
                                    <button
                                        onClick={() => setAiSubTab('providers')}
                                        className={`px-4 py-2 text-sm font-bold rounded-t-xl transition-all ${aiSubTab === 'providers'
                                            ? 'bg-primary/10 text-primary border-b-2 border-primary'
                                            : 'text-text-secondary-light hover:text-text-primary dark:hover:text-gray-200'
                                            }`}
                                    >
                                        Proveedores
                                    </button>
                                </div>

                                {aiSubTab === 'general' ? <AIGeneral /> : <AIProviders />}
                            </div>
                        )}


                        {/* Tab: API Keys (Reducido) */}
                        {activeTab === 'api' && (
                            <div className="bg-surface-light dark:bg-surface-dark rounded-3xl p-6 max-w-2xl animate-fade-in">
                                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                                    <span className="material-symbols-outlined">key</span>
                                    Configuración de APIs
                                </h2>

                                <div className="flex flex-col gap-6">
                                    <div>
                                        <label className="block text-xs font-bold uppercase text-text-secondary-light mb-2">
                                            Finnhub API Key
                                        </label>
                                        <input
                                            type="text"
                                            value={apiKeys.finnhub}
                                            onChange={e => setApiKeys({ ...apiKeys, finnhub: e.target.value })}
                                            className="w-full px-4 py-3 bg-background-light dark:bg-surface-dark-elevated rounded-xl border-none focus:ring-2 focus:ring-primary font-mono text-sm"
                                            placeholder="Tu API key de Finnhub"
                                        />
                                        <p className="text-xs text-text-secondary-light mt-1">
                                            Obtén tu key en <a href="https://finnhub.io" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">finnhub.io</a>
                                        </p>

                                    </div>



                                    <button
                                        onClick={saveApiKeys}
                                        disabled={saving}
                                        className="px-6 py-4 bg-primary text-black font-bold rounded-2xl hover:opacity-90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 mt-4"
                                    >
                                        {saving ? 'Guardando...' : 'Guardar Claves API'}
                                    </button>

                                    <div className="mt-6 p-4 bg-background-light dark:bg-surface-dark-elevated rounded-xl border border-border-light dark:border-border-dark">
                                        <h3 className="font-bold mb-2 flex items-center gap-2">
                                            <span className="material-symbols-outlined text-primary">psychology</span>
                                            Claves de IA (Gemini, OpenAI, etc.)
                                        </h3>
                                        <p className="text-sm text-text-secondary-light mb-3">
                                            Las claves de API para servicios de IA ahora se gestionan en su propia sección para mayor seguridad y soporte multi-proveedor.
                                        </p>
                                        <button
                                            onClick={() => setActiveTab('ai')}
                                            className="text-primary hover:underline text-sm font-bold"
                                        >
                                            Ir a Configuración de IA &rarr;
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tab: Backup */}
                        {activeTab === 'backup' && (
                            <div className="bg-surface-light dark:bg-surface-dark rounded-3xl p-6 animate-fade-in">
                                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                                    <span className="material-symbols-outlined">backup</span>
                                    Backup y Restauración
                                </h2>

                                {/* Sub-tabs Navigation */}
                                <div className="flex gap-4 mb-6 border-b border-border-light dark:border-border-dark pb-2">
                                    <button
                                        onClick={() => setBackupSubTab('manual')}
                                        className={`pb-2 px-2 text-sm font-semibold transition-colors ${backupSubTab === 'manual' ? 'text-primary border-b-2 border-primary' : 'text-text-secondary-light hover:text-text-primary'}`}
                                    >
                                        Manual
                                    </button>
                                    <button
                                        onClick={() => setBackupSubTab('scheduler')}
                                        className={`pb-2 px-2 text-sm font-semibold transition-colors ${backupSubTab === 'scheduler' ? 'text-primary border-b-2 border-primary' : 'text-text-secondary-light hover:text-text-primary'}`}
                                    >
                                        Programación
                                    </button>
                                    <button
                                        onClick={() => setBackupSubTab('tables')}
                                        className={`pb-2 px-2 text-sm font-semibold transition-colors ${backupSubTab === 'tables' ? 'text-primary border-b-2 border-primary' : 'text-text-secondary-light hover:text-text-primary'}`}
                                    >
                                        Tablas Detectadas
                                    </button>
                                </div>

                                {/* CONTENIDO: MANUAL */}
                                {backupSubTab === 'manual' && (
                                    <div className="animate-fade-in">
                                        {/* Crear Backup */}
                                        <div className="mb-8">
                                            <h3 className="font-bold mb-4 flex items-center gap-2">
                                                <span className="material-symbols-outlined text-green-500">download</span>
                                                Crear Backup
                                            </h3>
                                            <p className="text-sm text-text-secondary-light mb-4">
                                                Descarga una copia de seguridad de los datos. Elige el formato que más te convenga.
                                                <br />
                                                <span className="text-xs opacity-70">Nota: Las descargas manuales NO están protegidas con contraseña.</span>
                                            </p>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <button
                                                    onClick={downloadBackupZip}
                                                    disabled={backupLoading}
                                                    className="flex flex-col items-center gap-3 p-6 bg-background-light dark:bg-surface-dark-elevated rounded-2xl hover:ring-2 hover:ring-primary transition-all disabled:opacity-50"
                                                >
                                                    {backupLoading ? (
                                                        <span className="size-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></span>
                                                    ) : (
                                                        <span className="material-symbols-outlined text-3xl text-blue-500">folder_zip</span>
                                                    )}
                                                    <div className="text-center">
                                                        <p className="font-bold">Completo (ZIP)</p>
                                                        <p className="text-xs text-text-secondary-light">DB + Imágenes</p>
                                                    </div>
                                                </button>

                                                <button
                                                    onClick={downloadBackupJson}
                                                    disabled={backupLoading}
                                                    className="flex flex-col items-center gap-3 p-6 bg-background-light dark:bg-surface-dark-elevated rounded-2xl hover:ring-2 hover:ring-primary transition-all disabled:opacity-50"
                                                >
                                                    {backupLoading ? (
                                                        <span className="size-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></span>
                                                    ) : (
                                                        <span className="material-symbols-outlined text-3xl text-green-500">data_object</span>
                                                    )}
                                                    <div className="text-center">
                                                        <p className="font-bold">Datos (JSON)</p>
                                                        <p className="text-xs text-text-secondary-light">Solo Base de Datos</p>
                                                    </div>
                                                </button>

                                                <button
                                                    onClick={downloadBackupSql}
                                                    disabled={backupLoading}
                                                    className="flex flex-col items-center gap-3 p-6 bg-background-light dark:bg-surface-dark-elevated rounded-2xl hover:ring-2 hover:ring-primary transition-all disabled:opacity-50"
                                                >
                                                    {backupLoading ? (
                                                        <span className="size-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></span>
                                                    ) : (
                                                        <span className="material-symbols-outlined text-3xl text-orange-500">database</span>
                                                    )}
                                                    <div className="text-center">
                                                        <p className="font-bold">Script SQL</p>
                                                        <p className="text-xs text-text-secondary-light">Para PostgreSQL</p>
                                                    </div>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Restaurar */}
                                        <div className="border-t border-border-light dark:border-border-dark pt-6">
                                            <h3 className="font-bold mb-4 flex items-center gap-2">
                                                <span className="material-symbols-outlined text-red-500">restore</span>
                                                Restaurar Backup
                                            </h3>
                                            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl mb-4">
                                                <p className="text-sm text-red-400 flex items-start gap-2">
                                                    <span className="material-symbols-outlined text-lg">warning</span>
                                                    <span>
                                                        <strong>¡Atención!</strong> Restaurar un backup REEMPLAZARÁ todos los datos actuales.
                                                        Esta acción es irreversible. Crea un backup antes de continuar.
                                                    </span>
                                                </p>
                                            </div>
                                            <label className={`flex items-center justify-center gap-3 px-6 py-4 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${restoreLoading ? 'border-primary bg-primary/10' : 'border-border-light dark:border-border-dark hover:border-primary hover:bg-primary/5'}`}>
                                                {restoreLoading ? (
                                                    <>
                                                        <span className="size-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
                                                        <span className="font-semibold">Restaurando...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span className="material-symbols-outlined">upload_file</span>
                                                        <span className="font-semibold">Arrastra o selecciona un archivo (.zip, .json, .sql)</span>
                                                    </>
                                                )}
                                                <input
                                                    type="file"
                                                    accept=".json,.sql,.zip"
                                                    onChange={handleRestoreFile}
                                                    className="hidden"
                                                    disabled={restoreLoading}
                                                />
                                            </label>
                                        </div>
                                    </div>
                                )}

                                {/* CONTENIDO: PROGRAMACIÓN */}
                                {backupSubTab === 'scheduler' && (
                                    <div className="animate-fade-in space-y-6">
                                        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <span className="material-symbols-outlined text-blue-500 text-2xl">schedule_send</span>
                                                <div>
                                                    <h4 className="font-bold text-blue-500">Backup Automático por Email</h4>
                                                    <p className="text-xs opacity-70">
                                                        El sistema enviará una copia ZIP encriptada a tu correo.
                                                        Máx 25MB (si supera, se notificará).
                                                    </p>
                                                </div>
                                            </div>
                                            {/* Toggle Switch */}
                                            <button
                                                onClick={() => setSchedulerEnabled(!schedulerEnabled)}
                                                className={`w-12 h-6 rounded-full p-1 transition-colors ${schedulerEnabled ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}
                                            >
                                                <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${schedulerEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {/* Email */}
                                            <div>
                                                <label className="block text-sm font-medium text-text-secondary-light mb-2">Email de Destino</label>
                                                <input
                                                    type="email"
                                                    value={schedulerEmail}
                                                    onChange={e => setSchedulerEmail(e.target.value)}
                                                    className="w-full px-4 py-3 bg-background-light dark:bg-surface-dark-elevated rounded-xl border-none focus:ring-2 focus:ring-primary"
                                                    placeholder="admin@ejemplo.com"
                                                />
                                            </div>

                                            {/* Contraseña */}
                                            <div>
                                                <label className="block text-sm font-medium text-text-secondary-light mb-2">Contraseña del ZIP (Opcional)</label>
                                                <input
                                                    type="password"
                                                    value={schedulerPassword}
                                                    onChange={e => setSchedulerPassword(e.target.value)}
                                                    className="w-full px-4 py-3 bg-background-light dark:bg-surface-dark-elevated rounded-xl border-none focus:ring-2 focus:ring-primary"
                                                    placeholder="Para proteger el archivo adjunto"
                                                />
                                            </div>

                                            {/* Frecuencia */}
                                            <div>
                                                <label className="block text-sm font-medium text-text-secondary-light mb-2">Frecuencia</label>
                                                <div className="flex gap-2">
                                                    {['daily', 'weekly', 'monthly'].map(f => (
                                                        <button
                                                            key={f}
                                                            onClick={() => setSchedulerFrequency(f)}
                                                            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${schedulerFrequency === f ? 'bg-primary text-black' : 'bg-background-light dark:bg-surface-dark-elevated hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                                                        >
                                                            {f === 'daily' ? 'Diario' : f === 'weekly' ? 'Semanal' : 'Mensual'}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Día de la semana (solo para Semanal) */}
                                            {schedulerFrequency === 'weekly' && (
                                                <div>
                                                    <label className="block text-sm font-medium text-text-secondary-light mb-2">Día de la Semana</label>
                                                    <select
                                                        value={schedulerDayOfWeek}
                                                        onChange={e => setSchedulerDayOfWeek(Number(e.target.value))}
                                                        className="w-full px-4 py-3 bg-background-light dark:bg-surface-dark-elevated rounded-xl border-none focus:ring-2 focus:ring-primary"
                                                    >
                                                        <option value={1}>Lunes</option>
                                                        <option value={2}>Martes</option>
                                                        <option value={3}>Miércoles</option>
                                                        <option value={4}>Jueves</option>
                                                        <option value={5}>Viernes</option>
                                                        <option value={6}>Sábado</option>
                                                        <option value={0}>Domingo</option>
                                                    </select>
                                                </div>
                                            )}

                                            {/* Día del mes (solo para Mensual) */}
                                            {schedulerFrequency === 'monthly' && (
                                                <div>
                                                    <label className="block text-sm font-medium text-text-secondary-light mb-2">Día del Mes</label>
                                                    <select
                                                        value={schedulerDayOfMonth}
                                                        onChange={e => setSchedulerDayOfMonth(Number(e.target.value))}
                                                        className="w-full px-4 py-3 bg-background-light dark:bg-surface-dark-elevated rounded-xl border-none focus:ring-2 focus:ring-primary"
                                                    >
                                                        {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                                                            <option key={d} value={d}>{d}</option>
                                                        ))}
                                                    </select>
                                                    <p className="text-xs text-text-secondary-light mt-1">Máximo día 28 para evitar problemas con meses cortos.</p>
                                                </div>
                                            )}

                                            {/* Hora */}
                                            <div>
                                                <label className="block text-sm font-medium text-text-secondary-light mb-2">Hora de Ejecución</label>
                                                <input
                                                    type="time"
                                                    value={schedulerTime}
                                                    onChange={e => setSchedulerTime(e.target.value)}
                                                    className="w-full px-4 py-3 bg-background-light dark:bg-surface-dark-elevated rounded-xl border-none focus:ring-2 focus:ring-primary"
                                                />
                                                <p className="text-xs text-text-secondary-light mt-1 flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-[14px]">public</span>
                                                    Hora del Servidor (aprox): {serverTime || 'Cargando...'}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-center pt-4 border-t border-border-light dark:border-border-dark">
                                            <button
                                                onClick={handleSendNow}
                                                disabled={sendingNow || !schedulerEmail}
                                                className="flex items-center gap-2 px-4 py-2 text-primary hover:bg-primary/10 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {sendingNow ? (
                                                    <span className="size-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
                                                ) : (
                                                    <span className="material-symbols-outlined">send</span>
                                                )}
                                                Enviar Ahora
                                            </button>

                                            <button
                                                onClick={saveBackupSettings}
                                                disabled={schedulerSaving}
                                                className="px-8 py-3 bg-primary text-black font-bold rounded-xl hover:opacity-90 transition-all flex items-center gap-2"
                                            >
                                                {schedulerSaving && <span className="size-4 border-2 border-black border-t-transparent rounded-full animate-spin"></span>}
                                                Guardar Configuración
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* CONTENIDO: TABLAS */}
                                {backupSubTab === 'tables' && (
                                    <div className="animate-fade-in">
                                        <div className="mb-6 p-4 bg-background-light dark:bg-surface-dark-elevated rounded-xl">
                                            <div className="flex justify-between items-end mb-4">
                                                <div>
                                                    <h4 className="font-bold flex items-center gap-2">
                                                        <span className="material-symbols-outlined text-purple-500">table_view</span>
                                                        Tablas Detectadas
                                                    </h4>
                                                    <p className="text-sm text-text-secondary-light">
                                                        Estas son las tablas que se incluyen en el backup.
                                                    </p>
                                                </div>
                                                <span className="text-2xl font-black text-primary">{tables.length}</span>
                                            </div>

                                            <div className="flex flex-wrap gap-2 max-h-[400px] overflow-y-auto">
                                                {tables.map(t => (
                                                    <span key={t} className="px-3 py-1.5 bg-background dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-lg text-xs font-mono">
                                                        {t}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )
                                }
                            </div>
                        )}

                        {/* Tab: Estadísticas */}
                        {
                            activeTab === 'stats' && stats && (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 animate-fade-in">
                                    <div className="bg-surface-light dark:bg-surface-dark rounded-3xl p-6">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                                                <span className="material-symbols-outlined text-blue-500 text-2xl">group</span>
                                            </div>
                                            <span className="text-sm font-semibold text-text-secondary-light">Usuarios</span>
                                        </div>
                                        <p className="text-3xl font-black">{stats.users.total}</p>
                                        <p className="text-sm text-text-secondary-light">{stats.users.blocked} bloqueados</p>
                                    </div>

                                    <div className="bg-surface-light dark:bg-surface-dark rounded-3xl p-6">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                                                <span className="material-symbols-outlined text-green-500 text-2xl">account_balance_wallet</span>
                                            </div>
                                            <span className="text-sm font-semibold text-text-secondary-light">Carteras</span>
                                        </div>
                                        <p className="text-3xl font-black">{stats.portfolios}</p>
                                    </div>

                                    <div className="bg-surface-light dark:bg-surface-dark rounded-3xl p-6">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                                                <span className="material-symbols-outlined text-purple-500 text-2xl">trending_up</span>
                                            </div>
                                            <span className="text-sm font-semibold text-text-secondary-light">Posiciones</span>
                                        </div>
                                        <p className="text-3xl font-black">{stats.positions}</p>
                                    </div>

                                    <div className="bg-surface-light dark:bg-surface-dark rounded-3xl p-6">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center">
                                                <span className="material-symbols-outlined text-orange-500 text-2xl">receipt_long</span>
                                            </div>
                                            <span className="text-sm font-semibold text-text-secondary-light">Transacciones</span>
                                        </div>
                                        <p className="text-3xl font-black">{stats.transactions}</p>
                                    </div>

                                    {/* Discovery Engine Stats */}
                                    <div className="bg-surface-light dark:bg-surface-dark rounded-3xl p-6">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                                                <span className="material-symbols-outlined text-cyan-500 text-2xl">rocket_launch</span>
                                            </div>
                                            <span className="text-sm font-semibold text-text-secondary-light">Discovery Engine</span>
                                        </div>
                                        <p className="text-3xl font-black">{stats.discovery?.companies || 0}</p>
                                        <p className="text-sm text-text-secondary-light">
                                            Empresas en {stats.discovery?.sectors || 0} sectores
                                        </p>
                                        {stats.discovery?.lastUpdate && (
                                            <p className="text-xs text-text-secondary-light mt-1 opacity-70">
                                                {new Date(stats.discovery.lastUpdate).toLocaleTimeString()}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )
                        }

                        {/* Modal: Cambiar contraseña */}
                        {
                            passwordModal && (
                                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                                    <div className="bg-white dark:bg-surface-dark rounded-3xl p-8 max-w-md w-full shadow-2xl animate-scale-in">
                                        <h3 className="text-xl font-bold mb-2">Cambiar Contraseña</h3>
                                        <p className="text-sm text-text-secondary-light mb-6">{passwordModal.email}</p>

                                        <input
                                            type="password"
                                            value={newPassword}
                                            onChange={e => setNewPassword(e.target.value)}
                                            className="w-full px-4 py-3 bg-background-light dark:bg-surface-dark-elevated rounded-xl border-none focus:ring-2 focus:ring-primary mb-6"
                                            placeholder="Nueva contraseña (mín. 6 caracteres)"
                                        />

                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => setPasswordModal(null)}
                                                className="px-4 py-2 text-text-secondary-light hover:text-text-primary transition-colors"
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                onClick={changePassword}
                                                className="px-6 py-2 bg-primary text-black font-bold rounded-xl hover:opacity-90 transition-all"
                                            >
                                                Cambiar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )
                        }
                    </>
                )}
            </div>

        </main >
    );
};
