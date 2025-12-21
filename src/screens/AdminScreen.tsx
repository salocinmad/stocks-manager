import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Header } from '../components/Header';
import { useNavigate } from 'react-router-dom';

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
}

interface SmtpConfig {
    host: string;
    port: string;
    user: string;
    password: string;
    from: string;
}

type Tab = 'general' | 'market' | 'users' | 'api' | 'smtp' | 'backup' | 'stats' | 'ai';

export const AdminScreen: React.FC = () => {
    const { api, isAdmin, user: currentUser } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<Tab>('general');
    const [users, setUsers] = useState<User[]>([]);
    const [stats, setStats] = useState<SystemStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [apiKeys, setApiKeys] = useState({ finnhub: '', google: '' });
    // AI Model
    const [aiModel, setAiModel] = useState('gemini-1.5-flash');
    const [aiModels, setAiModels] = useState<{ id: string, name: string }[]>([]);
    const [aiPrompts, setAiPrompts] = useState({ chat: '', analysis: '' });
    const [refreshingModels, setRefreshingModels] = useState(false);

    const [generalConfig, setGeneralConfig] = useState({ appUrl: '' });
    const [saving, setSaving] = useState(false);

    // Market Sync
    const [syncPeriod, setSyncPeriod] = useState(1); // meses
    const [syncing, setSyncing] = useState(false);

    // SMTP config
    const [smtpConfig, setSmtpConfig] = useState<SmtpConfig>({
        host: '', port: '587', user: '', password: '', from: ''
    });
    const [testEmail, setTestEmail] = useState('');
    const [sendingTest, setSendingTest] = useState(false);

    // Backup/Restore
    const [backupLoading, setBackupLoading] = useState(false);
    const [restoreLoading, setRestoreLoading] = useState(false);
    const [tables, setTables] = useState<string[]>([]);

    // Modal para cambiar contraseña
    const [passwordModal, setPasswordModal] = useState<User | null>(null);
    const [newPassword, setNewPassword] = useState('');

    // Cargar config general
    const loadGeneralConfig = useCallback(async () => {
        try {
            const { data } = await api.get('/admin/settings/general');
            setGeneralConfig(data);
        } catch (err) {
            console.error('Error loading general config:', err);
        }
    }, [api]);

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
        try {
            const { data } = await api.get('/admin/stats');
            setStats(data);
        } catch (err) {
            console.error('Error loading stats:', err);
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

    // Cargar config IA y Prompts
    const loadAiConfig = useCallback(async () => {
        try {
            const [configRes, modelsRes, promptsRes] = await Promise.all([
                api.get('/admin/settings/ai'),
                api.get('/admin/settings/ai/models'),
                api.get('/admin/settings/ai/prompts')
            ]);
            if (configRes.data?.model) setAiModel(configRes.data.model);
            if (modelsRes.data) setAiModels(modelsRes.data);
            if (promptsRes.data) setAiPrompts(promptsRes.data);
        } catch (e) { console.error('Error loading AI config:', e); }
    }, [api]);

    // Cargar SMTP config
    const loadSmtpConfig = useCallback(async () => {
        try {
            const { data } = await api.get('/admin/settings/smtp');
            setSmtpConfig(data);
            // Pre-rellenar email de prueba con el email del admin
            if (currentUser?.email) {
                setTestEmail(currentUser.email);
            }
        } catch (err) {
            console.error('Error loading SMTP config:', err);
        }
    }, [api, currentUser?.email]);

    useEffect(() => {
        if (!isAdmin) {
            navigate('/');
            return;
        }

        const loadData = async () => {
            setLoading(true);
            await Promise.all([loadGeneralConfig(), loadUsers(), loadStats(), loadApiKeys(), loadAiConfig(), loadSmtpConfig()]);
            setLoading(false);
        };
        loadData();
    }, [isAdmin, navigate, loadGeneralConfig, loadUsers, loadStats, loadApiKeys, loadAiConfig, loadSmtpConfig]);

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

    // Guardar config IA (modelo)
    const handleSaveAiConfig = async () => {
        try {
            await api.post('/admin/settings/ai', { model: aiModel });
            await api.post('/admin/settings/ai/prompts', aiPrompts);
        } catch (error: any) {
            console.error('Error saving AI settings:', error);
            throw error;
        }
    };

    // Refresh AI Models
    const refreshAiModels = async () => {
        setRefreshingModels(true);
        try {
            const { data } = await api.post('/admin/settings/ai/models/refresh');
            if (data.models) setAiModels(data.models);
            alert(data.message || 'Modelos actualizados');
        } catch (e: any) {
            alert(e.response?.data?.message || 'Error actualizando modelos');
        } finally {
            setRefreshingModels(false);
        }
    };

    // Guardar API keys y configuración IA
    const saveApiKeys = async () => {
        setSaving(true);
        try {
            await api.post('/admin/settings/api', apiKeys);
            await handleSaveAiConfig();
            alert('Claves API y configuración de IA actualizadas. Los cambios se aplicarán inmediatamente.');
        } catch (err: any) {
            alert(err.response?.data?.message || 'Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    // Guardar SMTP config
    const saveSmtpConfig = async () => {
        setSaving(true);
        try {
            await api.post('/admin/settings/smtp', smtpConfig);
            alert('Configuración SMTP guardada.');
        } catch (err: any) {
            alert(err.response?.data?.message || 'Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    // Enviar email de prueba
    const sendTestEmail = async () => {
        if (!testEmail) {
            alert('Introduce un email de destino');
            return;
        }
        setSendingTest(true);
        try {
            await api.post('/admin/settings/smtp/test', { testEmail });
            alert(`Email de prueba enviado a ${testEmail}`);
        } catch (err: any) {
            alert(err.response?.data?.message || 'Error al enviar email de prueba');
        } finally {
            setSendingTest(false);
        }
    };

    if (!isAdmin) return null;

    // Descargar backup JSON
    const downloadBackupJson = async () => {
        setBackupLoading(true);
        try {
            const { data } = await api.get('/admin/backup/json');
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `stocks-manager-backup-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err: any) {
            alert(err.response?.data?.message || 'Error al crear backup');
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

    // Sincronizar Mercado
    const handleSync = async (type: 'portfolio' | 'currencies' | 'all') => {
        if (!confirm(`¿Iniciar sincronización de ${type === 'all' ? 'TODO' : type} para los últimos ${syncPeriod} meses?`)) return;
        setSyncing(true);
        try {
            const { data } = await api.post('/admin/market/sync', { months: syncPeriod, type });
            alert(data.message);
        } catch (err: any) {
            alert(err.response?.data?.message || 'Error al iniciar sincronización');
        } finally {
            setSyncing(false);
        }
    };

    // Restaurar desde archivo (JSON o SQL)
    const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const isJson = file.name.endsWith('.json');
        const isSql = file.name.endsWith('.sql');

        if (!isJson && !isSql) {
            alert('Formato no soportado. Usa un archivo .json o .sql');
            e.target.value = '';
            return;
        }

        if (!confirm('¿Estás seguro? Esto REEMPLAZARÁ TODOS los datos actuales con los del backup. Esta acción es irreversible.')) {
            e.target.value = '';
            return;
        }

        setRestoreLoading(true);
        try {
            const text = await file.text();

            if (isJson) {
                const backup = JSON.parse(text);
                if (!backup.metadata || !backup.data) {
                    throw new Error('Formato de backup JSON inválido');
                }
                await api.post('/admin/backup/restore', backup);
            } else {
                // SQL
                await api.post('/admin/backup/restore-sql', { sqlScript: text });
            }

            alert('Base de datos restaurada correctamente. Se recomienda cerrar sesión y volver a entrar.');
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
        if (activeTab === 'backup') {
            loadTables();
        }
    }, [activeTab]);

    const tabs = [
        { id: 'general' as Tab, label: 'General', icon: 'settings' },
        { id: 'ai' as Tab, label: 'Inteligencia Artificial', icon: 'psychology' },
        { id: 'market' as Tab, label: 'Mercado', icon: 'monitoring' },
        { id: 'users' as Tab, label: 'Usuarios', icon: 'group' },
        { id: 'api' as Tab, label: 'Claves API', icon: 'key' },
        { id: 'smtp' as Tab, label: 'SMTP', icon: 'mail' },
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
                            <div className="bg-surface-light dark:bg-surface-dark rounded-3xl p-6 max-w-2xl animate-fade-in">
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

                                {/* Config Basics */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                    <div>
                                        <label className="block text-xs font-bold uppercase text-text-secondary-light mb-2">
                                            Google Gemini API Key
                                        </label>
                                        <input
                                            type="text"
                                            value={apiKeys.google}
                                            onChange={e => setApiKeys({ ...apiKeys, google: e.target.value })}
                                            className="w-full px-4 py-3 bg-background-light dark:bg-surface-dark-elevated rounded-xl border-none focus:ring-2 focus:ring-primary font-mono text-sm"
                                            placeholder="Tu API key de Google AI Studio"
                                        />
                                        <p className="text-xs text-text-secondary-light mt-1">
                                            Necesario para ChatBot y Análisis.
                                        </p>
                                    </div>

                                    <div>
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="block text-xs font-bold uppercase text-text-secondary-light">
                                                Modelo (Gemini)
                                            </label>
                                            <button
                                                onClick={refreshAiModels}
                                                disabled={refreshingModels || !apiKeys.google}
                                                className="text-xs text-primary hover:text-primary-dark transition-colors flex items-center gap-1 disabled:opacity-50"
                                            >
                                                <span className={`material-symbols-outlined text-sm ${refreshingModels ? 'animate-spin' : ''}`}>sync</span>
                                                Refrescar
                                            </button>
                                        </div>
                                        <select
                                            value={aiModel}
                                            onChange={e => setAiModel(e.target.value)}
                                            className="w-full px-4 py-3 bg-background-light dark:bg-surface-dark-elevated rounded-xl border-none focus:ring-2 focus:ring-primary font-sans text-sm"
                                        >
                                            {aiModels.map(m => (
                                                <option key={m.id} value={m.id}>{m.name}</option>
                                            ))}
                                            {aiModels.length === 0 && <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>}
                                        </select>
                                    </div>
                                </div>

                                {/* Prompts Editors */}
                                <h3 className="font-bold text-lg mb-4 text-text-primary-light dark:text-gray-200">Personalidad y Prompts</h3>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    <div className="flex flex-col h-full">
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="block text-xs font-bold uppercase text-text-secondary-light">ChatBot (Conversacional)</label>
                                            <span className="text-[10px] bg-primary/20 text-primary px-2 py-1 rounded">Memoria Activada</span>
                                        </div>
                                        <p className="text-xs text-text-secondary-light mb-2">Variables: <code>{`{{CHAT_HISTORY}}`}</code>, <code>{`{{MARKET_DATA}}`}</code></p>
                                        <textarea
                                            value={aiPrompts.chat}
                                            onChange={e => setAiPrompts({ ...aiPrompts, chat: e.target.value })}
                                            className="w-full flex-1 min-h-[300px] px-4 py-3 bg-background-light dark:bg-surface-dark-elevated rounded-xl border-none focus:ring-2 focus:ring-primary font-mono text-xs leading-relaxed resize-y"
                                            placeholder="System prompt for ChatBot..."
                                        />
                                    </div>

                                    <div className="flex flex-col h-full">
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="block text-xs font-bold uppercase text-text-secondary-light">Análisis Estratégico (Reporte)</label>
                                            <span className="text-[10px] bg-blue-500/20 text-blue-500 px-2 py-1 rounded">Reporte Estático</span>
                                        </div>
                                        <p className="text-xs text-text-secondary-light mb-2">Variables: <code>{`{{PORTFOLIO_CONTEXT}}`}</code>, <code>{`{{MARKET_CONTEXT}}`}</code>, <code>{`{{USER_MESSAGE}}`}</code></p>
                                        <textarea
                                            value={aiPrompts.analysis}
                                            onChange={e => setAiPrompts({ ...aiPrompts, analysis: e.target.value })}
                                            className="w-full flex-1 min-h-[300px] px-4 py-3 bg-background-light dark:bg-surface-dark-elevated rounded-xl border-none focus:ring-2 focus:ring-primary font-mono text-xs leading-relaxed resize-y"
                                            placeholder="System prompt for Analysis..."
                                        />
                                    </div>
                                </div>

                                <div className="mt-8 flex justify-end">
                                    <button
                                        onClick={saveApiKeys}
                                        disabled={saving}
                                        className="px-8 py-4 bg-primary text-black font-bold rounded-2xl hover:opacity-90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center gap-2"
                                    >
                                        <span className="material-symbols-outlined">save</span>
                                        {saving ? 'Guardando...' : 'Guardar Configuración de IA'}
                                    </button>
                                </div>
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

                                    {/* Google Config moved to AI Tab */}

                                    <button
                                        onClick={saveApiKeys}
                                        disabled={saving}
                                        className="px-6 py-4 bg-primary text-black font-bold rounded-2xl hover:opacity-90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 mt-4"
                                    >
                                        {saving ? 'Guardando...' : 'Guardar Claves API'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Tab: SMTP */}
                        {activeTab === 'smtp' && (
                            <div className="bg-surface-light dark:bg-surface-dark rounded-3xl p-6 max-w-2xl animate-fade-in">
                                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                                    <span className="material-symbols-outlined">mail</span>
                                    Configuración SMTP
                                </h2>
                                <p className="text-sm text-text-secondary-light mb-6">
                                    Configura el servidor SMTP para enviar notificaciones de alertas de precio, stop loss y otras notificaciones por email.
                                </p>

                                <div className="flex flex-col gap-5">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold uppercase text-text-secondary-light mb-2">
                                                Host SMTP
                                            </label>
                                            <input
                                                type="text"
                                                value={smtpConfig.host}
                                                onChange={e => setSmtpConfig({ ...smtpConfig, host: e.target.value })}
                                                className="w-full px-4 py-3 bg-background-light dark:bg-surface-dark-elevated rounded-xl border-none focus:ring-2 focus:ring-primary"
                                                placeholder="smtp.gmail.com"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold uppercase text-text-secondary-light mb-2">
                                                Puerto
                                            </label>
                                            <input
                                                type="text"
                                                value={smtpConfig.port}
                                                onChange={e => setSmtpConfig({ ...smtpConfig, port: e.target.value })}
                                                className="w-full px-4 py-3 bg-background-light dark:bg-surface-dark-elevated rounded-xl border-none focus:ring-2 focus:ring-primary"
                                                placeholder="587"
                                            />
                                            <p className="text-xs text-text-secondary-light mt-1">
                                                587 (TLS) o 465 (SSL)
                                            </p>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold uppercase text-text-secondary-light mb-2">
                                            Usuario SMTP
                                        </label>
                                        <input
                                            type="text"
                                            value={smtpConfig.user}
                                            onChange={e => setSmtpConfig({ ...smtpConfig, user: e.target.value })}
                                            className="w-full px-4 py-3 bg-background-light dark:bg-surface-dark-elevated rounded-xl border-none focus:ring-2 focus:ring-primary"
                                            placeholder="tu-email@gmail.com"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold uppercase text-text-secondary-light mb-2">
                                            Contraseña / App Password
                                        </label>
                                        <input
                                            type="password"
                                            value={smtpConfig.password}
                                            onChange={e => setSmtpConfig({ ...smtpConfig, password: e.target.value })}
                                            className="w-full px-4 py-3 bg-background-light dark:bg-surface-dark-elevated rounded-xl border-none focus:ring-2 focus:ring-primary"
                                            placeholder="••••••••"
                                        />
                                        <p className="text-xs text-text-secondary-light mt-1">
                                            Para Gmail, usa una <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">App Password</a>
                                        </p>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold uppercase text-text-secondary-light mb-2">
                                            Email Remitente (From)
                                        </label>
                                        <input
                                            type="text"
                                            value={smtpConfig.from}
                                            onChange={e => setSmtpConfig({ ...smtpConfig, from: e.target.value })}
                                            className="w-full px-4 py-3 bg-background-light dark:bg-surface-dark-elevated rounded-xl border-none focus:ring-2 focus:ring-primary"
                                            placeholder="Stocks Manager <noreply@tudominio.com>"
                                        />
                                    </div>

                                    <button
                                        onClick={saveSmtpConfig}
                                        disabled={saving}
                                        className="px-6 py-4 bg-primary text-black font-bold rounded-2xl hover:opacity-90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
                                    >
                                        {saving ? 'Guardando...' : 'Guardar Configuración SMTP'}
                                    </button>

                                    {/* Prueba de envío */}
                                    <div className="border-t border-border-light dark:border-border-dark pt-6 mt-2">
                                        <h3 className="font-bold mb-4 flex items-center gap-2">
                                            <span className="material-symbols-outlined text-lg">send</span>
                                            Probar Configuración
                                        </h3>
                                        <div className="flex gap-3">
                                            <input
                                                type="email"
                                                value={testEmail}
                                                onChange={e => setTestEmail(e.target.value)}
                                                className="flex-1 px-4 py-3 bg-background-light dark:bg-surface-dark-elevated rounded-xl border-none focus:ring-2 focus:ring-primary"
                                                placeholder="Email de destino para la prueba"
                                            />
                                            <button
                                                onClick={sendTestEmail}
                                                disabled={sendingTest || !smtpConfig.host}
                                                className="px-6 py-3 bg-blue-500 text-white font-bold rounded-xl hover:bg-blue-600 transition-all disabled:opacity-50 flex items-center gap-2"
                                            >
                                                {sendingTest ? (
                                                    <>
                                                        <span className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                                        Enviando...
                                                    </>
                                                ) : (
                                                    <>
                                                        <span className="material-symbols-outlined text-lg">send</span>
                                                        Enviar Prueba
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tab: Backup */}
                        {activeTab === 'backup' && (
                            <div className="bg-surface-light dark:bg-surface-dark rounded-3xl p-6 max-w-2xl animate-fade-in">
                                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                                    <span className="material-symbols-outlined">backup</span>
                                    Backup y Restauración
                                </h2>

                                {/* Info de tablas */}
                                <div className="mb-6 p-4 bg-background-light dark:bg-surface-dark-elevated rounded-xl">
                                    <p className="text-sm text-text-secondary-light mb-2">
                                        <strong>{tables.length}</strong> tablas detectadas en la base de datos:
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {tables.map(t => (
                                            <span key={t} className="px-2 py-1 bg-primary/10 text-primary text-xs font-mono rounded">
                                                {t}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {/* Crear Backup */}
                                <div className="mb-8">
                                    <h3 className="font-bold mb-4 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-green-500">download</span>
                                        Crear Backup
                                    </h3>
                                    <p className="text-sm text-text-secondary-light mb-4">
                                        Descarga una copia completa de todos los datos. El backup incluye todas las tablas automáticamente.
                                    </p>
                                    <div className="grid grid-cols-2 gap-4">
                                        <button
                                            onClick={downloadBackupJson}
                                            disabled={backupLoading}
                                            className="flex flex-col items-center gap-3 p-6 bg-background-light dark:bg-surface-dark-elevated rounded-2xl hover:ring-2 hover:ring-primary transition-all disabled:opacity-50"
                                        >
                                            {backupLoading ? (
                                                <span className="size-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></span>
                                            ) : (
                                                <span className="material-symbols-outlined text-3xl text-blue-500">data_object</span>
                                            )}
                                            <div className="text-center">
                                                <p className="font-bold">Backup JSON</p>
                                                <p className="text-xs text-text-secondary-light">Para restaurar en la app</p>
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
                                                <p className="font-bold">Backup SQL</p>
                                                <p className="text-xs text-text-secondary-light">Script para PostgreSQL</p>
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
                                                <span className="font-semibold">Seleccionar archivo de backup (.json o .sql)</span>
                                            </>
                                        )}
                                        <input
                                            type="file"
                                            accept=".json,.sql"
                                            onChange={handleRestoreFile}
                                            className="hidden"
                                            disabled={restoreLoading}
                                        />
                                    </label>
                                </div>
                            </div>
                        )}

                        {/* Tab: Estadísticas */}
                        {activeTab === 'stats' && stats && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in">
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
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Modal: Cambiar contraseña */}
            {passwordModal && (
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
            )}
        </main>
    );
};
