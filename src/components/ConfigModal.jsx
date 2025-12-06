import { useState, useEffect } from 'react';
import { authenticatedFetch, verifySession } from '../services/auth.js';
import { twoFactorAPI } from '../services/api.js';

export default function ConfigModal({
    isOpen,
    theme,
    finnhubApiKey,
    setFinnhubApiKey,
    missingApiKeyWarning,
    setMissingApiKeyWarning,
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    confirmNewPassword,
    setConfirmNewPassword,
    onChangePassword,
    onClearAll,
    onClose
}) {
    const [is2FAEnabled, setIs2FAEnabled] = useState(false);
    const [show2FASetup, setShow2FASetup] = useState(false);
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [manualSecret, setManualSecret] = useState('');
    const [setupToken, setSetupToken] = useState('');
    const [disablePassword, setDisablePassword] = useState('');
    const [disableToken, setDisableToken] = useState('');
    const [showDisableConfirm, setShowDisableConfirm] = useState(false);

    useEffect(() => {
        if (isOpen) {
            check2FAStatus();
        } else {
            // Reset states on close
            setShow2FASetup(false);
            setQrCodeUrl('');
            setManualSecret('');
            setSetupToken('');
            setSetupToken('');
            setDisablePassword('');
            setDisableToken('');
            setShowDisableConfirm(false);
        }
    }, [isOpen]);

    const check2FAStatus = async () => {
        try {
            const data = await twoFactorAPI.getStatus();
            setIs2FAEnabled(!!data.isTwoFactorEnabled);
        } catch (e) {
            console.error('Error checking 2FA status', e);
        }
    };

    const handleStartSetup = async () => {
        try {
            const data = await twoFactorAPI.setup();
            setQrCodeUrl(data.qrCode);
            setManualSecret(data.secret); // Secret for manual entry
            setShow2FASetup(true);
        } catch (e) {
            alert(e.message || 'Error al iniciar configuración 2FA');
        }
    };

    const handleVerifySetup = async () => {
        try {
            await twoFactorAPI.verify(setupToken);
            alert('✅ 2FA Activado correctamente');
            setIs2FAEnabled(true);
            setShow2FASetup(false);
            setSetupToken('');
            setManualSecret('');
        } catch (e) {
            alert(e.message || 'Error al verificar código');
        }
    };

    const handleDisable2FA = async () => {
        try {
            await twoFactorAPI.disable(disablePassword, disableToken);
            alert('✅ 2FA Desactivado');
            setIs2FAEnabled(false);
            setShowDisableConfirm(false);
            setDisablePassword('');
            setDisableToken('');
        } catch (e) {
            alert(e.message || 'Error al desactivar 2FA');
        }
    };

    const handleSaveApiKey = async () => {
        try {
            const response = await authenticatedFetch('/api/admin/finnhub-api-key', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ value: finnhubApiKey })
            });
            if (response.ok) {
                alert('✅ API Key guardada correctamente');
                setMissingApiKeyWarning(false);
            } else {
                alert('❌ Error al guardar API Key');
            }
        } catch (e) {
            console.error(e);
            alert('❌ Error al guardar API Key');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal">
            <div className="modal-content" style={{ maxWidth: '550px', maxHeight: '90vh', overflowY: 'auto' }}>
                <h2 style={{ marginBottom: '20px', fontSize: '20px' }}>⚙️ Configuración</h2>

                {/* Sección 2FA */}
                <div style={{ marginBottom: '20px', paddingBottom: '15px', borderBottom: `1px solid ${theme === 'dark' ? '#404040' : '#e0e0e0'}` }}>
                    <h3 style={{ marginBottom: '8px', fontSize: '16px' }}>🛡️ Autenticación en Dos Pasos (2FA)</h3>
                    {is2FAEnabled ? (
                        <div>
                            <p style={{ color: '#4ade80', marginBottom: '10px' }}>✅ 2FA está activado. Tu cuenta está segura.</p>
                            {!showDisableConfirm ? (
                                <button
                                    className="button danger"
                                    onClick={() => setShowDisableConfirm(true)}
                                    style={{ fontSize: '13px', padding: '6px 12px' }}
                                >
                                    Desactivar 2FA
                                </button>
                            ) : (
                                <div style={{ backgroundColor: theme === 'dark' ? '#2d2d2d' : '#f5f5f5', padding: '15px', borderRadius: '8px' }}>
                                    <p style={{ fontSize: '13px', marginBottom: '10px' }}>
                                        Para desactivar, ingresa tu contraseña y el código de tu app autenticadora.
                                    </p>
                                    <input
                                        type="password"
                                        placeholder="Contraseña actual"
                                        className="input"
                                        value={disablePassword}
                                        onChange={e => setDisablePassword(e.target.value)}
                                        style={{ marginBottom: '10px', width: '100%' }}
                                    />
                                    <input
                                        type="text"
                                        placeholder="Código 2FA (000000)"
                                        className="input"
                                        value={disableToken}
                                        onChange={e => setDisableToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        style={{ marginBottom: '10px', width: '100%', letterSpacing: '2px', textAlign: 'center' }}
                                    />
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                            className="button warning"
                                            onClick={handleDisable2FA}
                                            disabled={!disablePassword || disableToken.length !== 6}
                                        >
                                            Confirmar Desactivar
                                        </button>
                                        <button className="button" onClick={() => { setShowDisableConfirm(false); setDisablePassword(''); setDisableToken(''); }}>
                                            Cancelar
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div>
                            <p style={{ fontSize: '13px', marginBottom: '10px', color: '#888' }}>
                                Protege tu cuenta requiriendo un código extra al iniciar sesión.
                            </p>
                            {!show2FASetup ? (
                                <button
                                    className="button primary"
                                    onClick={handleStartSetup}
                                    style={{ fontSize: '13px', padding: '8px 16px' }}
                                >
                                    Activar 2FA
                                </button>
                            ) : (
                                <div style={{ backgroundColor: theme === 'dark' ? '#2d2d2d' : '#f5f5f5', padding: '15px', borderRadius: '8px' }}>
                                    <h4 style={{ fontSize: '14px', marginBottom: '10px' }}>1. Escanea el código QR</h4>
                                    <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
                                        {qrCodeUrl && (
                                            <div style={{ background: 'white', padding: '8px', borderRadius: '4px' }}>
                                                <img src={qrCodeUrl} alt="QR Code" style={{ display: 'block', width: '120px', height: '120px' }} />
                                            </div>
                                        )}
                                        <div style={{ flex: 1 }}>
                                            <p style={{ fontSize: '12px', marginBottom: '5px' }}>O ingresa la clave manualmente:</p>
                                            <div style={{
                                                fontFamily: 'monospace',
                                                background: theme === 'dark' ? '#1a1a1a' : '#e0e0e0',
                                                padding: '8px',
                                                borderRadius: '4px',
                                                wordBreak: 'break-all',
                                                fontSize: '14px',
                                                marginBottom: '8px'
                                            }}>
                                                {manualSecret}
                                            </div>
                                            <p style={{ fontSize: '11px', color: '#888' }}>
                                                Usa Google Authenticator o Authy.
                                            </p>
                                        </div>
                                    </div>

                                    <h4 style={{ fontSize: '14px', marginBottom: '10px' }}>2. Ingresa el código generado</h4>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <input
                                            type="text"
                                            placeholder="000000"
                                            className="input"
                                            value={setupToken}
                                            onChange={e => setSetupToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                            style={{ width: '120px', textAlign: 'center', letterSpacing: '2px' }}
                                        />
                                        <button className="button primary" onClick={handleVerifySetup} disabled={setupToken.length !== 6}>
                                            Verificar y Activar
                                        </button>
                                        <button className="button" onClick={() => setShow2FASetup(false)}>
                                            Cancelar
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div style={{ marginBottom: '20px', paddingBottom: '15px', borderBottom: `1px solid ${theme === 'dark' ? '#404040' : '#e0e0e0'}` }}>
                    <h3 style={{ marginBottom: '8px', fontSize: '16px' }}>🔑 Finnhub API Key</h3>
                    {missingApiKeyWarning && (
                        <div style={{
                            backgroundColor: 'rgba(255, 193, 7, 0.1)',
                            border: '1px solid #ffc107',
                            color: '#ffc107',
                            padding: '10px',
                            borderRadius: '4px',
                            marginBottom: '10px',
                            fontSize: '13px'
                        }}>
                            ⚠️ Necesitas configurar una API Key de Finnhub para buscar empresas.
                        </div>
                    )}
                    <div className="form-group" style={{ marginBottom: '10px' }}>
                        <label style={{ fontSize: '13px', marginBottom: '4px' }}>API Key:</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                                type="text"
                                value={finnhubApiKey}
                                onChange={(e) => setFinnhubApiKey(e.target.value)}
                                className="input"
                                placeholder="Introduce tu API Key de Finnhub"
                                style={{ fontSize: '14px', padding: '8px', flex: 1 }}
                            />
                            <button
                                type="button"
                                className="button primary"
                                onClick={handleSaveApiKey}
                                style={{ padding: '8px 16px', fontSize: '13px', whiteSpace: 'nowrap' }}
                            >
                                💾 Guardar
                            </button>
                        </div>
                        <p style={{ fontSize: '11px', color: '#888', marginTop: '5px' }}>
                            Obtén tu clave gratuita en <a href="https://finnhub.io/" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>finnhub.io</a>
                        </p>
                    </div>
                </div>

                <div style={{ marginBottom: '20px', paddingBottom: '15px', borderBottom: `1px solid ${theme === 'dark' ? '#404040' : '#e0e0e0'}` }}>
                    <h3 style={{ marginBottom: '8px', fontSize: '16px' }}>🔒 Cambiar Contraseña</h3>
                    <div className="form-group" style={{ marginBottom: '10px' }}>
                        <label style={{ fontSize: '13px', marginBottom: '4px' }}>Contraseña Actual:</label>
                        <input
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className="input"
                            placeholder="Contraseña actual"
                            style={{ fontSize: '14px', padding: '8px' }}
                            autoComplete="current-password"
                        />
                    </div>
                    <div className="form-group" style={{ marginBottom: '10px' }}>
                        <label style={{ fontSize: '13px', marginBottom: '4px' }}>Nueva Contraseña:</label>
                        <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="input"
                            placeholder="Nueva contraseña (mín. 6 caracteres)"
                            style={{ fontSize: '14px', padding: '8px' }}
                            autoComplete="new-password"
                        />
                    </div>
                    <div className="form-group" style={{ marginBottom: '0', display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '13px', marginBottom: '4px' }}>Confirmar Nueva:</label>
                            <input
                                type="password"
                                value={confirmNewPassword}
                                onChange={(e) => setConfirmNewPassword(e.target.value)}
                                className="input"
                                placeholder="Confirma la nueva contraseña"
                                style={{ fontSize: '14px', padding: '8px' }}
                                autoComplete="new-password"
                            />
                        </div>
                        <button
                            type="button"
                            className="button primary"
                            onClick={onChangePassword}
                            style={{ padding: '8px 16px', fontSize: '13px', whiteSpace: 'nowrap' }}
                        >
                            💾 Cambiar
                        </button>
                    </div>
                </div>

                <div style={{ marginBottom: '0' }}>
                    <h3 style={{ marginBottom: '8px', fontSize: '16px' }}>🗑️ Borrar Todas las Operaciones</h3>
                    <p style={{ marginBottom: '10px', fontSize: '12px', color: '#dc3545', fontWeight: 'bold' }}>
                        ⚠️ Esta acción borrará TODAS las operaciones. NO se puede deshacer.
                    </p>
                    <button
                        type="button"
                        className="button danger"
                        onClick={onClearAll}
                        style={{ fontSize: '14px', padding: '8px 16px' }}
                    >
                        🗑️ Borrar Todas las Operaciones
                    </button>
                </div>

                <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                        type="button"
                        className="button"
                        onClick={onClose}
                        style={{ fontSize: '14px', padding: '8px 16px' }}
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}
