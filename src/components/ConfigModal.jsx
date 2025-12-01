import { authenticatedFetch } from '../services/auth.js';

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
    if (!isOpen) return null;

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

    return (
        <div className="modal">
            <div className="modal-content" style={{ maxWidth: '550px' }}>
                <h2 style={{ marginBottom: '20px', fontSize: '20px' }}>⚙️ Configuración</h2>

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
