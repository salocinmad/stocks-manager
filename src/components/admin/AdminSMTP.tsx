import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

interface SmtpConfig {
    host: string;
    port: string;
    user: string;
    password: string;
    from: string;
}

export const AdminSMTP: React.FC = () => {
    const { api } = useAuth();
    const [smtpConfig, setSmtpConfig] = useState<SmtpConfig>({
        host: '', port: '587', user: '', password: '', from: ''
    });
    const [testEmail, setTestEmail] = useState('');
    const [sendingTest, setSendingTest] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadSmtpConfig();
    }, []);

    const loadSmtpConfig = async () => {
        try {
            const { data } = await api.get('/admin/settings/smtp');
            if (data) setSmtpConfig(data);
        } catch (err) {
            console.error('Error loading SMTP config:', err);
        }
    };

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

    const sendTestEmail = async () => {
        if (!testEmail) return alert('Ingresa un email de destino');
        setSendingTest(true);
        try {
            const { data } = await api.post('/admin/settings/smtp/test', { testEmail });
            alert(data.message);
        } catch (err: any) {
            alert(err.response?.data?.message || 'Error enviando email de prueba');
        } finally {
            setSendingTest(false);
        }
    };

    return (
        <div className="bg-surface-light dark:bg-surface-dark rounded-2xl md:rounded-3xl p-4 md:p-6 animate-fade-in mt-4 md:mt-6 border border-border-light dark:border-border-dark">
            <h2 className="text-lg md:text-xl font-bold mb-4 md:mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined">mail</span>
                Configuración SMTP (Correo)
            </h2>
            <p className="text-xs md:text-sm text-text-secondary-light mb-4 md:mb-6">
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
                    className="px-4 md:px-6 py-3 md:py-4 bg-primary text-black font-bold rounded-xl md:rounded-2xl hover:opacity-90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 text-sm md:text-base"
                >
                    {saving ? 'Guardando...' : 'Guardar Configuración SMTP'}
                </button>

                {/* Prueba de envío */}
                <div className="border-t border-border-light dark:border-border-dark pt-4 md:pt-6 mt-2">
                    <h3 className="font-bold mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-lg">send</span>
                        Probar Configuración
                    </h3>
                    <div className="flex flex-col sm:flex-row gap-3">
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
                            className="px-4 md:px-6 py-2.5 md:py-3 bg-blue-500 text-white font-bold rounded-lg md:rounded-xl hover:bg-blue-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm md:text-base"
                        >
                            {sendingTest ? (
                                <span className="animate-spin material-symbols-outlined">sync</span>
                            ) : (
                                <span className="material-symbols-outlined">send</span>
                            )}
                            Enviar Prueba
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
