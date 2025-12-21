import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

interface TwoFactorStatus {
    enabled: boolean;
    securityMode: string;
    hasBackupCodes: boolean;
    backupCodesCount: number;
}

interface SetupData {
    secret: string;
    qrCode: string;
    backupCodes: string[];
}

export const TwoFactorSettings: React.FC = () => {
    const { api } = useAuth();

    const [status, setStatus] = useState<TwoFactorStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [setupStep, setSetupStep] = useState<'idle' | 'setup' | 'codes' | 'verify'>('idle');
    const [setupData, setSetupData] = useState<SetupData | null>(null);
    const [verifyCode, setVerifyCode] = useState('');
    const [codesConfirmed, setCodesConfirmed] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // For disabling 2FA
    const [disableCode, setDisableCode] = useState('');
    const [disablePassword, setDisablePassword] = useState('');
    const [showDisable, setShowDisable] = useState(false);

    // For regenerating backup codes
    const [regenPassword, setRegenPassword] = useState('');
    const [showRegen, setShowRegen] = useState(false);
    const [newBackupCodes, setNewBackupCodes] = useState<string[] | null>(null);
    const [copied, setCopied] = useState(false);

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (e) {
            console.error('Failed to copy:', e);
        }
    };

    useEffect(() => {
        fetchStatus();
    }, []);

    const fetchStatus = async () => {
        try {
            const { data } = await api.get('/auth/2fa/status');
            setStatus(data);
        } catch (e) {
            console.error('Error fetching 2FA status:', e);
        } finally {
            setLoading(false);
        }
    };

    const startSetup = async () => {
        setError('');
        try {
            const { data } = await api.post('/auth/2fa/setup');
            setSetupData(data);
            setSetupStep('setup');
        } catch (e: any) {
            setError(e.response?.data?.error || 'Error al iniciar configuración');
        }
    };

    const handleVerify = async () => {
        setError('');
        if (!setupData || !codesConfirmed) {
            setError('Debes confirmar que has guardado los códigos de respaldo');
            return;
        }

        try {
            await api.post('/auth/2fa/verify', {
                code: verifyCode,
                backupCodes: setupData.backupCodes
            });
            setSuccess('2FA activado correctamente');
            setSetupStep('idle');
            setSetupData(null);
            fetchStatus();
        } catch (e: any) {
            setError(e.response?.data?.error || 'Error al verificar código');
        }
    };

    const handleDisable = async () => {
        setError('');
        try {
            await api.post('/auth/2fa/disable', {
                code: disableCode,
                password: disablePassword
            });
            setSuccess('2FA desactivado');
            setShowDisable(false);
            setDisableCode('');
            setDisablePassword('');
            fetchStatus();
        } catch (e: any) {
            setError(e.response?.data?.error || 'Error al desactivar 2FA');
        }
    };

    const handleSecurityModeChange = async (mode: 'standard' | 'enhanced') => {
        setError('');
        try {
            await api.patch('/auth/2fa/security-mode', { mode });
            setSuccess(`Modo de seguridad cambiado a ${mode === 'enhanced' ? 'reforzado' : 'estándar'}`);
            fetchStatus();
        } catch (e: any) {
            setError(e.response?.data?.error || 'Error al cambiar modo');
        }
    };

    const handleRegenerateBackupCodes = async () => {
        setError('');
        try {
            const { data } = await api.post('/auth/2fa/regenerate-backup-codes', {
                password: regenPassword
            });
            setNewBackupCodes(data.backupCodes);
            setSuccess('Nuevos códigos generados. Los anteriores ya no funcionan.');
            setRegenPassword('');
            fetchStatus();
        } catch (e: any) {
            setError(e.response?.data?.error || 'Error al regenerar códigos');
        }
    };

    const downloadBackupCodes = (codes: string[]) => {
        const content = `CÓDIGOS DE RESPALDO - Stocks Manager\n==========================================\nGuarda estos códigos en un lugar seguro.\nCada código solo puede usarse UNA VEZ.\n\n${codes.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n\nGenerados: ${new Date().toLocaleString()}`;
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'stocks-manager-backup-codes.txt';
        a.click();
        URL.revokeObjectURL(url);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="size-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            {/* Mensajes */}
            {error && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 font-bold text-sm">
                    {error}
                </div>
            )}
            {success && (
                <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-500 font-bold text-sm">
                    {success}
                </div>
            )}

            {/* Estado Actual */}
            <div className="flex flex-col p-8 rounded-3xl bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-sm">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className={`size-12 rounded-2xl flex items-center justify-center ${status?.enabled ? 'bg-green-500/10 text-green-500' : 'bg-gray-500/10 text-gray-500'}`}>
                            <span className="material-symbols-outlined font-bold">
                                {status?.enabled ? 'verified_user' : 'shield'}
                            </span>
                        </div>
                        <div>
                            <h3 className="text-xl font-bold dark:text-white">Autenticación en Dos Pasos</h3>
                            <p className="text-sm text-text-secondary-light">
                                {status?.enabled ? '✅ Activado' : '⚠️ Desactivado'}
                            </p>
                        </div>
                    </div>
                </div>

                {!status?.enabled && setupStep === 'idle' && (
                    <button
                        onClick={startSetup}
                        className="px-6 py-3 bg-primary/10 hover:bg-primary text-primary hover:text-black font-bold rounded-2xl transition-all"
                    >
                        Activar 2FA
                    </button>
                )}

                {/* Setup Flow */}
                {setupStep === 'setup' && setupData && (
                    <div className="flex flex-col gap-6 animate-in fade-in">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* QR Code */}
                            <div className="flex flex-col items-center gap-4 p-6 bg-white dark:bg-background-dark rounded-2xl">
                                <h4 className="font-bold text-lg">1. Escanea el QR</h4>
                                <img src={setupData.qrCode} alt="QR Code" className="w-48 h-48 rounded-lg" />
                                <p className="text-xs text-center text-text-secondary-light">
                                    Usa tu app de autenticación (Google Authenticator, Authy, etc.)
                                </p>
                            </div>

                            {/* Manual Code */}
                            <div className="flex flex-col gap-4 p-6 bg-white dark:bg-background-dark rounded-2xl">
                                <h4 className="font-bold text-lg">O introduce manualmente</h4>
                                <div className="relative">
                                    <div className="p-4 pr-14 bg-gray-100 dark:bg-gray-800 rounded-xl font-mono text-sm break-all select-all">
                                        {setupData.secret}
                                    </div>
                                    <button
                                        onClick={() => copyToClipboard(setupData.secret)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-all"
                                        title="Copiar al portapapeles"
                                    >
                                        <span className="material-symbols-outlined text-lg">
                                            {copied ? 'check' : 'content_copy'}
                                        </span>
                                    </button>
                                </div>
                                {copied && (
                                    <span className="text-xs text-green-500 font-medium">✓ Copiado al portapapeles</span>
                                )}
                            </div>
                        </div>

                        {/* Backup Codes - MUST download */}
                        <div className="p-6 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
                            <h4 className="font-bold text-lg text-amber-600 dark:text-amber-400 mb-4 flex items-center gap-2">
                                <span className="material-symbols-outlined">warning</span>
                                2. Guarda tus Códigos de Respaldo
                            </h4>
                            <p className="text-sm mb-4 text-amber-700 dark:text-amber-300">
                                ⚠️ Solo podrás verlos UNA VEZ. Si pierdes acceso a tu autenticador, necesitarás estos códigos.
                            </p>

                            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
                                {setupData.backupCodes.map((code, i) => (
                                    <div key={i} className="p-2 bg-white dark:bg-gray-800 rounded-lg font-mono text-sm text-center">
                                        {code}
                                    </div>
                                ))}
                            </div>

                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={() => downloadBackupCodes(setupData.backupCodes)}
                                    className="w-full py-3 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-all flex items-center justify-center gap-2"
                                >
                                    <span className="material-symbols-outlined">download</span>
                                    Descargar Códigos
                                </button>

                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={codesConfirmed}
                                        onChange={(e) => setCodesConfirmed(e.target.checked)}
                                        className="size-5 rounded accent-primary"
                                    />
                                    <span className="text-sm font-medium">
                                        Confirmo que he guardado estos códigos en un lugar seguro
                                    </span>
                                </label>
                            </div>
                        </div>

                        {/* Verify Step */}
                        <div className="p-6 bg-blue-500/10 border border-blue-500/30 rounded-2xl">
                            <h4 className="font-bold text-lg text-blue-600 dark:text-blue-400 mb-4">
                                3. Verifica tu código
                            </h4>
                            <div className="flex gap-3">
                                <input
                                    type="text"
                                    value={verifyCode}
                                    onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    placeholder="Código de 6 dígitos"
                                    className="flex-1 px-5 py-3 rounded-xl bg-white dark:bg-background-dark border border-border-light dark:border-border-dark text-center font-mono text-xl tracking-widest"
                                    maxLength={6}
                                />
                                <button
                                    onClick={handleVerify}
                                    disabled={verifyCode.length !== 6 || !codesConfirmed}
                                    className="px-8 py-3 bg-primary text-black font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all"
                                >
                                    Activar 2FA
                                </button>
                            </div>
                        </div>

                        <button
                            onClick={() => { setSetupStep('idle'); setSetupData(null); }}
                            className="text-text-secondary-light hover:text-red-500 font-medium text-sm"
                        >
                            Cancelar
                        </button>
                    </div>
                )}

                {/* If 2FA enabled, show controls */}
                {status?.enabled && setupStep === 'idle' && (
                    <div className="flex flex-col gap-4">
                        {/* Security Mode */}
                        <div className="p-4 bg-background-light dark:bg-background-dark rounded-xl">
                            <h4 className="font-bold mb-3">Modo de Seguridad</h4>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => handleSecurityModeChange('standard')}
                                    className={`flex-1 p-4 rounded-xl border-2 transition-all ${status.securityMode === 'standard'
                                        ? 'border-primary bg-primary/10'
                                        : 'border-border-light dark:border-border-dark hover:border-primary/50'
                                        }`}
                                >
                                    <div className="font-bold">Estándar</div>
                                    <div className="text-xs text-text-secondary-light">Contraseña + 2FA</div>
                                </button>
                                <button
                                    onClick={() => handleSecurityModeChange('enhanced')}
                                    className={`flex-1 p-4 rounded-xl border-2 transition-all ${status.securityMode === 'enhanced'
                                        ? 'border-primary bg-primary/10'
                                        : 'border-border-light dark:border-border-dark hover:border-primary/50'
                                        }`}
                                >
                                    <div className="font-bold">Reforzado</div>
                                    <div className="text-xs text-text-secondary-light">Contraseña + 2FA + Email</div>
                                </button>
                            </div>
                        </div>

                        {/* Backup Codes Status */}
                        <div className="p-4 bg-background-light dark:bg-background-dark rounded-xl flex items-center justify-between">
                            <div>
                                <h4 className="font-bold">Códigos de Respaldo</h4>
                                <p className="text-sm text-text-secondary-light">
                                    {status.backupCodesCount} códigos restantes
                                </p>
                            </div>
                            <button
                                onClick={() => setShowRegen(true)}
                                className="px-4 py-2 bg-amber-500/10 text-amber-600 font-bold rounded-xl hover:bg-amber-500/20 transition-all"
                            >
                                Regenerar
                            </button>
                        </div>

                        {/* Regenerate Modal */}
                        {showRegen && (
                            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                                <p className="text-sm mb-3 text-amber-700 dark:text-amber-300">
                                    ⚠️ Esto invalidará todos tus códigos actuales.
                                </p>
                                <input
                                    type="password"
                                    value={regenPassword}
                                    onChange={(e) => setRegenPassword(e.target.value)}
                                    placeholder="Contraseña actual"
                                    className="w-full px-4 py-3 rounded-xl bg-white dark:bg-background-dark border border-border-light dark:border-border-dark mb-3"
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleRegenerateBackupCodes}
                                        className="flex-1 py-2 bg-amber-500 text-white font-bold rounded-xl"
                                    >
                                        Confirmar
                                    </button>
                                    <button
                                        onClick={() => { setShowRegen(false); setRegenPassword(''); }}
                                        className="px-4 py-2 text-text-secondary-light"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Show new backup codes */}
                        {newBackupCodes && (
                            <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                                <h4 className="font-bold text-green-600 mb-3">Nuevos Códigos de Respaldo</h4>
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
                                    {newBackupCodes.map((code, i) => (
                                        <div key={i} className="p-2 bg-white dark:bg-gray-800 rounded-lg font-mono text-sm text-center">
                                            {code}
                                        </div>
                                    ))}
                                </div>
                                <button
                                    onClick={() => downloadBackupCodes(newBackupCodes)}
                                    className="w-full py-3 bg-green-500 text-white font-bold rounded-xl"
                                >
                                    Descargar Códigos
                                </button>
                                <button
                                    onClick={() => setNewBackupCodes(null)}
                                    className="w-full mt-2 py-2 text-text-secondary-light text-sm"
                                >
                                    Cerrar (no podré volver a verlos)
                                </button>
                            </div>
                        )}

                        {/* Disable 2FA */}
                        <button
                            onClick={() => setShowDisable(!showDisable)}
                            className="text-red-500 text-sm font-medium hover:underline"
                        >
                            Desactivar 2FA
                        </button>

                        {showDisable && (
                            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                                <p className="text-sm mb-3 text-red-600">
                                    ⚠️ Esto reducirá la seguridad de tu cuenta.
                                </p>
                                <input
                                    type="password"
                                    value={disablePassword}
                                    onChange={(e) => setDisablePassword(e.target.value)}
                                    placeholder="Contraseña actual"
                                    className="w-full px-4 py-3 rounded-xl bg-white dark:bg-background-dark border border-border-light dark:border-border-dark mb-3"
                                />
                                <input
                                    type="text"
                                    value={disableCode}
                                    onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    placeholder="Código 2FA"
                                    className="w-full px-4 py-3 rounded-xl bg-white dark:bg-background-dark border border-border-light dark:border-border-dark mb-3 font-mono"
                                    maxLength={6}
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleDisable}
                                        disabled={disableCode.length !== 6 || !disablePassword}
                                        className="flex-1 py-2 bg-red-500 text-white font-bold rounded-xl disabled:opacity-50"
                                    >
                                        Desactivar 2FA
                                    </button>
                                    <button
                                        onClick={() => { setShowDisable(false); setDisableCode(''); setDisablePassword(''); }}
                                        className="px-4 py-2 text-text-secondary-light"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
