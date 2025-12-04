import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authenticatedFetch, getToken } from '../services/auth.js';
import { configAPI } from '../services/api.js';
import './Admin.css';

function Admin() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showResetAdmin, setShowResetAdmin] = useState(false);
  const [showApiKeyConfig, setShowApiKeyConfig] = useState(false);
  const [resettingAlerts, setResettingAlerts] = useState(false);
  const [showSmtpConfig, setShowSmtpConfig] = useState(false);
  const [showSchedulerConfig, setShowSchedulerConfig] = useState(false);
  const [schedulerEnabled, setSchedulerEnabled] = useState(true);
  const [schedulerInterval, setSchedulerInterval] = useState(15);
  const [schedulerLastRun, setSchedulerLastRun] = useState(null);
  const [newUser, setNewUser] = useState({ username: '', password: '', isAdmin: false });
  const [resetAdminData, setResetAdminData] = useState({ masterPassword: '', newPassword: '' });
  const [apiKey, setApiKey] = useState('');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpSubject, setSmtpSubject] = useState('Alerta de precios');
  const [smtpTo, setSmtpTo] = useState('');
  const [logLevelEnabled, setLogLevelEnabled] = useState(false); // Nuevo estado para el nivel de log

  const [showPass, setShowPass] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [backupFormat, setBackupFormat] = useState('json');
  const [theme, setTheme] = useState('dark');
  const navigate = useNavigate();

  // Estados para Editor de Operaciones
  const [showOperationsEditor, setShowOperationsEditor] = useState(false);
  const [usersPortfolios, setUsersPortfolios] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState(null);
  const [operations, setOperations] = useState([]);
  const [editingOperations, setEditingOperations] = useState({}); // { operationId: editedData }
  const [symbolValidations, setSymbolValidations] = useState({}); // { operationId: validationData }
  const [validatingSymbols, setValidatingSymbols] = useState({}); // { operationId: boolean }

  useEffect(() => {
    // Cargar tema desde localStorage
    const savedTheme = localStorage.getItem('portfolio-theme') || 'dark';
    setTheme(savedTheme);
    document.body.className = savedTheme;

    loadUsers();
    loadApiKey();
    loadSmtp();
    loadLogLevel();
  }, []);

  const loadLogLevel = async () => {
    try {
      const response = await configAPI.get('logLevel');
      setLogLevelEnabled(response.value === 'verbose');
    } catch (err) {
      console.error('Error cargando nivel de log:', err);
    }
  };

  const handleToggleLogLevel = async () => {
    const newLevel = logLevelEnabled ? 'minimal' : 'verbose';
    try {
      await configAPI.set('logLevel', newLevel);
      setLogLevelEnabled(!logLevelEnabled);
      setSuccess(`Nivel de log cambiado a ${newLevel}`);
    } catch (err) {
      setError('Error al cambiar el nivel de log');
      console.error('Error al cambiar el nivel de log:', err);
    }
  };

  const loadApiKey = async () => {
    try {
      const response = await authenticatedFetch('/api/admin/finnhub-api-key');
      if (response.ok) {
        const data = await response.json();
        setApiKey(data.value || '');
      }
    } catch (err) {
      console.error('Error cargando API key:', err);
    }
  };

  const loadSmtp = async () => {
    try {
      const keys = ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_subject', 'smtp_to'];
      for (const k of keys) {
        const r = await configAPI.get(k);
        const v = r?.value || '';
        if (k === 'smtp_host') setSmtpHost(v);
        if (k === 'smtp_port') setSmtpPort(v || '587');
        if (k === 'smtp_user') setSmtpUser(v);
        if (k === 'smtp_subject') setSmtpSubject(v || 'Alerta de precios');
        if (k === 'smtp_to') setSmtpTo(v);
      }
    } catch (err) {
      console.error('Error cargando SMTP:', err);
    }
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await authenticatedFetch('/api/admin/users');
      if (!response.ok) throw new Error('Error al cargar usuarios');
      const data = await response.json();
      setUsers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const response = await authenticatedFetch('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify(newUser),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al crear usuario');
      }

      setSuccess('Usuario creado correctamente');
      setNewUser({ username: '', password: '', isAdmin: false });
      setShowCreateUser(false);
      loadUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este usuario?')) {
      return;
    }

    try {
      const response = await authenticatedFetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Error al eliminar usuario');

      setSuccess('Usuario eliminado correctamente');
      loadUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleResetAdminPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const response = await authenticatedFetch('/api/admin/reset-admin-password', {
        method: 'POST',
        body: JSON.stringify(resetAdminData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al resetear contraseña');
      }

      setSuccess('Contraseña de administrador actualizada correctamente');
      setResetAdminData({ masterPassword: '', newPassword: '' });
      setShowResetAdmin(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleChangeUserPassword = async (userId, newPassword) => {
    if (!newPassword || newPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    try {
      const response = await authenticatedFetch(`/api/admin/users/${userId}/password`, {
        method: 'PUT',
        body: JSON.stringify({ newPassword }),
      });

      if (!response.ok) throw new Error('Error al cambiar contraseña');

      setSuccess('Contraseña actualizada correctamente');
      loadUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSaveApiKey = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const response = await authenticatedFetch('/api/admin/finnhub-api-key', {
        method: 'POST',
        body: JSON.stringify({ value: apiKey }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al guardar API key');
      }

      setSuccess('API Key guardada correctamente');
      setShowApiKeyConfig(false);
      loadApiKey();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleExportBackup = async () => {
    try {
      const response = await authenticatedFetch(`/api/admin/backup/export?format=${backupFormat}`);
      if (!response.ok) throw new Error('Error al exportar backup');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_${new Date().toISOString().split('T')[0]}.${backupFormat}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setSuccess('Backup exportado correctamente');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleImportBackup = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!window.confirm('⚠️ ADVERTENCIA CRÍTICA ⚠️\n\nEsta acción BORRARÁ TODOS LOS DATOS ACTUALES de la base de datos y los reemplazará con el contenido del backup.\n\n¿Estás absolutamente seguro de que quieres continuar?')) {
      e.target.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      setLoading(true);
      const response = await authenticatedFetch('/api/admin/backup/import', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al importar backup');
      }

      const data = await response.json();
      setSuccess(data.message || 'Restauración completada correctamente');
      setShowBackupModal(false);
      // Recargar datos para reflejar cambios
      loadUsers();
      loadApiKey();
      loadSmtp();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  // ============================================================================
  // Funciones del Editor de Operaciones
  // ============================================================================

  const loadUsersPortfolios = async () => {
    try {
      const response = await authenticatedFetch('/api/admin/users-portfolios');
      if (!response.ok) throw new Error('Error al cargar usuarios y portfolios');
      const data = await response.json();
      setUsersPortfolios(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const loadOperations = async (portfolioId) => {
    try {
      setLoading(true);
      const response = await authenticatedFetch(`/api/admin/operations/${portfolioId}`);
      if (!response.ok) throw new Error('Error al cargar operaciones');
      const data = await response.json();
      setOperations(data);
      setEditingOperations({});
      setSymbolValidations({});
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const validateSymbol = async (operationId, symbol) => {
    if (!symbol || symbol.trim() === '') {
      setSymbolValidations(prev => ({
        ...prev,
        [operationId]: { valid: false, error: 'Símbolo vacío' }
      }));
      return;
    }

    setValidatingSymbols(prev => ({ ...prev, [operationId]: true }));

    try {
      const response = await authenticatedFetch('/api/admin/validate-symbol', {
        method: 'POST',
        body: JSON.stringify({ symbol })
      });
      const data = await response.json();

      setSymbolValidations(prev => ({
        ...prev,
        [operationId]: data
      }));
    } catch (err) {
      setSymbolValidations(prev => ({
        ...prev,
        [operationId]: { valid: false, error: 'Error al validar' }
      }));
    } finally {
      setValidatingSymbols(prev => ({ ...prev, [operationId]: false }));
    }
  };

  const handleOperationFieldChange = (operationId, field, value) => {
    setEditingOperations(prev => ({
      ...prev,
      [operationId]: {
        ...prev[operationId],
        [field]: value
      }
    }));

    // Si el campo es el símbolo, validarlo
    if (field === 'symbol') {
      validateSymbol(operationId, value);
    }
  };

  const saveOperation = async (operationId) => {
    const editedData = editingOperations[operationId];
    if (!editedData) return;

    // Verificar validación de símbolo si fue modificado
    if (editedData.symbol !== undefined) {
      const validation = symbolValidations[operationId];
      if (!validation || !validation.valid) {
        setError('El símbolo no es válido. Por favor, corrígelo antes de guardar.');
        return;
      }
    }

    try {
      setLoading(true);
      const response = await authenticatedFetch(`/api/admin/operations/${operationId}`, {
        method: 'PUT',
        body: JSON.stringify(editedData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al actualizar operación');
      }

      setSuccess('Operación actualizada correctamente');

      // Recargar operaciones
      if (selectedPortfolioId) {
        await loadOperations(selectedPortfolioId);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getEditedValue = (operation, field) => {
    const edited = editingOperations[operation.id];
    return edited && edited[field] !== undefined ? edited[field] : operation[field];
  };

  const calculateTotal = (operation) => {
    const shares = getEditedValue(operation, 'shares');
    const price = getEditedValue(operation, 'price');
    const exchangeRate = getEditedValue(operation, 'exchangeRate') || 1;
    const commission = getEditedValue(operation, 'commission') || 0;
    return (shares * price * exchangeRate) + commission;
  };

  if (loading) {
    return <div className="admin-container">Cargando...</div>;
  }

  return (
    <div className="container">
      <div className="header">
        <h1>
          <img
            src="/logo64.png"
            alt="Logo"
            style={{
              width: '48px',
              height: '48px',
              marginRight: '10px',
              verticalAlign: 'middle'
            }}
          />
          Stocks Manager - Admin
        </h1>
        <button className="button" onClick={() => navigate('/')}>
          ← Volver al Portfolio
        </button>
      </div>

      {error && <div className="alert error">{error}</div>}
      {success && <div className="alert success">{success}</div>}

      <div className="grid">
        {/* Panel de Usuarios */}
        <div className="card">
          <h3 style={{ borderBottom: '1px solid #404040', paddingBottom: '10px', marginBottom: '15px' }}>👤 Gestión de Usuarios</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              className="button primary"
              onClick={() => setShowCreateUser(true)}
              style={{ justifyContent: 'center' }}
            >
              ➕ Crear Usuario
            </button>
            <button
              className="button warning"
              onClick={() => setShowResetAdmin(true)}
              style={{ justifyContent: 'center' }}
            >
              🔑 Resetear Contraseña Admin
            </button>
          </div>
        </div>

        {/* Panel de Configuración */}
        <div className="card">
          <h3 style={{ borderBottom: '1px solid #404040', paddingBottom: '10px', marginBottom: '15px' }}>⚙️ Configuración</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              className="button"
              onClick={() => {
                setShowApiKeyConfig(true);
                loadApiKey();
              }}
              style={{ justifyContent: 'center' }}
            >
              🔑 API Key Finnhub
            </button>
            <button
              className="button"
              onClick={() => {
                setShowSmtpConfig(true);
                loadSmtp();
              }}
              style={{ justifyContent: 'center' }}
            >
              ✉️ SMTP / Notificaciones
            </button>
            <button
              className="button"
              onClick={async () => {
                try {
                  const r = await authenticatedFetch('/api/admin/scheduler')
                  if (r.ok) {
                    const d = await r.json()
                    setSchedulerEnabled(!!d.enabled)
                    setSchedulerInterval(parseInt(d.intervalMinutes || 15))
                    setSchedulerLastRun(d.lastRun || null)
                  }
                } catch { }
                setShowSchedulerConfig(true)
              }}
              style={{ justifyContent: 'center' }}
            >
              ⚙️ Scheduler
            </button>

            <button
              className="button"
              onClick={handleToggleLogLevel}
              style={{ justifyContent: 'center' }}
            >
              {logLevelEnabled ? '✅ Logging Detallado' : '❌ Logging Minimal'}
            </button>
          </div>
        </div>

        <div className="admin-card">
          <h3>Mantenimiento</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              className="button"
              onClick={() => setShowBackupModal(true)}
              style={{ justifyContent: 'center' }}
            >
              💾 Backup y Restauración
            </button>
            <button
              className="button"
              onClick={async () => {
                try {
                  const r = await authenticatedFetch('/api/admin/daily-close/run', { method: 'POST' })
                  const d = await r.json().catch(() => ({}))
                  if (r.ok) {
                    if (d.status === 'already_running') {
                      setSuccess('Cierre diario ya en ejecución')
                    } else if (d.status === 'partial_failures') {
                      setSuccess(`Cierre diario con incidencias (${(d.failures || []).length})`)
                    } else if (d.status === 'no_data') {
                      setSuccess('Cierre diario sin datos que procesar')
                    } else {
                      setSuccess(`Cierre diario ejecutado (${d.date || '—'})`)
                    }
                  } else {
                    setError(d?.error || 'Error ejecutando cierre diario')
                  }
                } catch (e) {
                  setError('Error ejecutando cierre diario')
                }
              }}
              style={{ justifyContent: 'center' }}
            >
              📅 Ejecutar Cierre Diario
            </button>
            <button
              className="button warning"
              onClick={async () => {
                if (!window.confirm('¿Recalcular todo el historial de PnL para todos los portafolios usando precios históricos?')) return
                try {
                  const r = await authenticatedFetch('/api/admin/daily-close/recompute-last', { method: 'POST' })
                  const d = await r.json().catch(() => ({}))
                  if (r.ok) {
                    setSuccess(d.message || `Recalculado: ${d.portfolios || 0} portafolios, ${d.dates || 0} fechas`)
                  } else {
                    setError(d?.error || 'Error forzando recálculo')
                  }
                } catch (e) {
                  setError('Error forzando recálculo')
                }
              }}
              style={{ justifyContent: 'center' }}
            >
              ♻️ Recalcular Historial PnL
            </button>
            <button
              className="button warning"
              disabled={resettingAlerts}
              onClick={async () => {
                if (!window.confirm('¿Rearmar todas las alertas de precio objetivo?')) return;
                try {
                  setResettingAlerts(true);
                  const r = await authenticatedFetch('/api/admin/reset-alerts', { method: 'POST', body: JSON.stringify({}) })
                  if (r.ok) {
                    const data = await r.json();
                    setSuccess(`Alertas rearmadas (${data.affected ?? 0})`);
                  } else {
                    setError('Error rearmando alertas');
                  }
                } catch (e) {
                  setError('Error rearmando alertas');
                } finally {
                  setResettingAlerts(false);
                }
              }}
              style={{ justifyContent: 'center' }}
            >
              🔁 Rearmar Alertas
            </button>
            <button
              className="button"
              onClick={async () => {
                if (!window.confirm('¿Generar reportes para todos los portafolios ahora?')) return;
                try {
                  const r = await authenticatedFetch('/api/admin/reports/generate', { method: 'POST' });
                  const d = await r.json().catch(() => ({}));
                  if (r.ok) {
                    setSuccess(`Reportes generados (${d.count || '—'} portafolios procesados)`);
                  } else {
                    setError(d?.error || 'Error generando reportes');
                  }
                } catch (e) {
                  setError('Error generando reportes');
                }
              }}
              style={{ justifyContent: 'center' }}
            >
              📊 Generar Reportes
            </button>
            <button
              className="button"
              onClick={() => {
                setShowOperationsEditor(true);
                loadUsersPortfolios();
              }}
              style={{ justifyContent: 'center' }}
            >
              ✏️ Editar Operaciones
            </button>
            <button
              className="button warning"
              onClick={async () => {
                const days = prompt('¿Cuántos días de historial deseas sobrescribir? (Recomendado: 30)', '30');
                if (!days) return;

                if (!window.confirm(`⚠️ ADVERTENCIA DESTRUCTIVA ⚠️\n\nEstás a punto de SOBRESCRIBIR los datos históricos de los últimos ${days} días para TODAS las acciones activas.\n\nEsto eliminará cualquier corrección manual y reemplazará los datos con los de Yahoo Finance.\n\n¿Estás seguro de continuar?`)) return;

                try {
                  setLoading(true);
                  const r = await authenticatedFetch('/api/admin/overwrite-history', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ days: parseInt(days) })
                  });

                  const d = await r.json().catch(() => ({}));

                  if (r.ok) {
                    setSuccess(d.message || 'Historial sobrescrito correctamente');
                    alert(`✅ Proceso completado.\n\n${d.message}\n\nDetalles: ${d.details?.updatedPositions} posiciones actualizadas.`);
                  } else {
                    setError(d?.error || 'Error sobrescribiendo historial');
                  }
                } catch (e) {
                  setError('Error de conexión al sobrescribir historial');
                } finally {
                  setLoading(false);
                }
              }}
              style={{ justifyContent: 'center', marginTop: '10px', border: '1px solid #ef4444', color: '#ef4444' }}
            >
              🔄 Sobrescribir Historial (Emergencia)
            </button>
          </div>
        </div>
      </div>

      {showSmtpConfig && (
        <div className="modal" onClick={() => { setShowSmtpConfig(false); setShowPass(false); setSmtpPass('') }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <h2>✉️ Notificaciones SMTP</h2>
            <div className="form-row">
              <div className="form-group">
                <label>Host</label>
                <input className="input" type="text" placeholder="smtp.ejemplo.com" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Puerto</label>
                <input className="input" type="number" placeholder="587" value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Usuario</label>
                <input className="input" type="text" placeholder="usuario@dominio" value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label>Password</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input className="input" style={{ flex: 1 }} type={showPass ? 'text' : 'password'} value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)} placeholder={showPass ? '' : 'No se muestra la guardada'} />
                <button className="button" style={{ fontSize: '12px' }} onClick={async () => {
                  if (!showPass) {
                    const r = await authenticatedFetch('/api/admin/smtp-pass')
                    if (r.ok) {
                      const data = await r.json()
                      setSmtpPass(data.pass || '')
                      setShowPass(true)
                      setTimeout(() => { setShowPass(false); setSmtpPass('') }, 1000 * 15)
                    }
                  } else {
                    setShowPass(false); setSmtpPass('')
                  }
                }}>{showPass ? 'Ocultar' : 'Mostrar'}</button>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group" style={{ flex: 2 }}>
                <label>Asunto</label>
                <input className="input" type="text" placeholder="Asunto por defecto" value={smtpSubject} onChange={(e) => setSmtpSubject(e.target.value)} />
              </div>
              <div className="form-group" style={{ flex: 2 }}>
                <label>Destinatarios (coma)</label>
                <input className="input" type="text" placeholder="correo1@dominio, correo2@dominio" value={smtpTo} onChange={(e) => setSmtpTo(e.target.value)} />
              </div>
            </div>
            <div className="admin-actions">
              <button className="button primary" onClick={async () => {
                const r = await authenticatedFetch('/api/admin/smtp', { method: 'POST', body: JSON.stringify({ host: smtpHost, port: parseInt(smtpPort || '587'), user: smtpUser, pass: smtpPass, subject: smtpSubject, to: smtpTo }) })
                if (r.ok) setSuccess('SMTP guardado'); else setError('Error guardando SMTP')
                setSmtpPass('')
              }}>💾 Guardar SMTP</button>
              <button className="button" onClick={async () => {
                const r = await authenticatedFetch('/api/admin/notify-test', { method: 'POST' })
                if (r.ok) setSuccess('Prueba enviada'); else setError('Error al enviar prueba')
              }}>✉️ Enviar prueba</button>
              <button className="button" onClick={() => { setShowSmtpConfig(false); setShowPass(false); setSmtpPass('') }}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {showSchedulerConfig && (
        <div className="modal" onClick={() => setShowSchedulerConfig(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <h2>⚙️ Scheduler</h2>
            <div className="form-row">
              <div className="form-group">
                <label>Activado</label>
                <input type="checkbox" checked={schedulerEnabled} onChange={(e) => setSchedulerEnabled(e.target.checked)} />
              </div>
              <div className="form-group">
                <label>Intervalo (minutos)</label>
                <input type="number" className="input" min={1} value={schedulerInterval} onChange={(e) => setSchedulerInterval(e.target.value)} />
              </div>
            </div>
            <div style={{ fontSize: '12px', color: '#888' }}>
              Última ejecución: {schedulerLastRun ? new Date(schedulerLastRun).toLocaleString('es-ES', { hour12: false }) : '—'}
            </div>
            <div className="admin-actions">
              <button className="button primary" onClick={async () => {
                const r = await authenticatedFetch('/api/admin/scheduler', { method: 'POST', body: JSON.stringify({ enabled: schedulerEnabled, intervalMinutes: parseInt(schedulerInterval || 15) }) })
                if (r.ok) setSuccess('Scheduler actualizado'); else setError('Error actualizando scheduler')
                setShowSchedulerConfig(false)
              }}>💾 Guardar</button>
              <button className="button" onClick={async () => {
                const r = await authenticatedFetch('/api/admin/scheduler/run', { method: 'POST' })
                if (r.ok) setSuccess('Ejecución manual realizada'); else setError('Error al ejecutar ahora')
              }}>▶ Ejecutar ahora</button>
              <button className="button" onClick={() => setShowSchedulerConfig(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal crear usuario */}
      {showCreateUser && (
        <div className="modal" onClick={() => setShowCreateUser(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Crear Nuevo Usuario</h2>
            <form onSubmit={handleCreateUser}>
              <div className="form-group">
                <label>Usuario</label>
                <input
                  type="text"
                  className="input"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Contraseña</label>
                <input
                  type="password"
                  className="input"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  required
                  minLength={6}
                />
              </div>
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={newUser.isAdmin}
                    onChange={(e) => setNewUser({ ...newUser, isAdmin: e.target.checked })}
                  />
                  Administrador
                </label>
              </div>
              <div className="modal-actions">
                <button type="submit" className="button primary">Crear</button>
                <button
                  type="button"
                  className="button"
                  onClick={() => setShowCreateUser(false)}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal resetear admin */}
      {showResetAdmin && (
        <div className="modal" onClick={() => setShowResetAdmin(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Resetear Contraseña de Administrador</h2>
            <form onSubmit={handleResetAdminPassword}>
              <div className="form-group">
                <label>Contraseña Maestra</label>
                <input
                  type="password"
                  className="input"
                  value={resetAdminData.masterPassword}
                  onChange={(e) => setResetAdminData({ ...resetAdminData, masterPassword: e.target.value })}
                  required
                  placeholder="Freedom2-Mud9-Garnish7..."
                />
              </div>
              <div className="form-group">
                <label>Nueva Contraseña</label>
                <input
                  type="password"
                  className="input"
                  value={resetAdminData.newPassword}
                  onChange={(e) => setResetAdminData({ ...resetAdminData, newPassword: e.target.value })}
                  required
                  minLength={6}
                />
              </div>
              <div className="modal-actions">
                <button type="submit" className="button warning">Resetear</button>
                <button
                  type="button"
                  className="button"
                  onClick={() => setShowResetAdmin(false)}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal configurar API Key */}
      {showApiKeyConfig && (
        <div className="modal" onClick={() => setShowApiKeyConfig(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>🔑 Configurar API Key de Finnhub</h2>
            <p style={{ fontSize: '14px', color: '#888', marginBottom: '15px' }}>
              Esta API Key será utilizada por todos los usuarios de la aplicación.
              Obtén una API Key gratuita en: <a href="https://finnhub.io/register" target="_blank" rel="noopener noreferrer" style={{ color: '#007bff' }}>finnhub.io/register</a>
            </p>
            <form onSubmit={handleSaveApiKey}>
              <div className="form-group">
                <label>API Key de Finnhub</label>
                <input
                  type="password"
                  className="input"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Ingresa la API Key"
                  style={{ fontFamily: 'monospace' }}
                />
              </div>
              <div className="modal-actions">
                <button type="submit" className="button primary">💾 Guardar</button>
                <button
                  type="button"
                  className="button"
                  onClick={() => setShowApiKeyConfig(false)}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Backup */}
      {showBackupModal && (
        <div className="modal" onClick={() => setShowBackupModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>💾 Backup y Restauración</h2>

            <div className="backup-section" style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '8px' }}>
              <h3>⬇️ Exportar Backup</h3>
              <p style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>
                Descarga una copia completa de la base de datos (usuarios, precios, operaciones, configuración).
              </p>
              <div className="form-group">
                <label>Formato:</label>
                <div style={{ display: 'flex', gap: '15px', marginTop: '5px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="backupFormat"
                      value="json"
                      checked={backupFormat === 'json'}
                      onChange={() => setBackupFormat('json')}
                    />
                    JSON (Recomendado)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="backupFormat"
                      value="sql"
                      checked={backupFormat === 'sql'}
                      onChange={() => setBackupFormat('sql')}
                    />
                    SQL
                  </label>
                </div>
              </div>
              <button className="button primary" onClick={handleExportBackup}>
                Descargar Backup
              </button>
            </div>

            <div className="backup-section" style={{ padding: '15px', border: '1px solid #ffcccc', borderRadius: '8px', backgroundColor: '#fff5f5' }}>
              <h3 style={{ color: '#cc0000' }}>⬆️ Restaurar Backup</h3>
              <p style={{ fontSize: '14px', color: '#cc0000', marginBottom: '10px', fontWeight: 'bold' }}>
                ⚠️ ADVERTENCIA: Esta acción eliminará TODOS los datos actuales y los reemplazará con los del backup.
              </p>
              <p style={{ fontSize: '14px', color: '#666', marginBottom: '15px' }}>
                Soporta archivos .json y .sql. El formato se detecta automáticamente.
              </p>
              <input
                type="file"
                accept=".json,.sql"
                onChange={handleImportBackup}
                style={{ width: '100%' }}
              />
            </div>

            <div className="modal-actions" style={{ marginTop: '20px' }}>
              <button
                className="button"
                onClick={() => setShowBackupModal(false)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista de usuarios */}
      <div className="card">
        <h2 style={{ marginBottom: '20px' }}>Usuarios ({users.length})</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Administrador</th>
              <th>Fecha Creación</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user._id || user.id}>
                <td>{user.username}</td>
                <td>{user.isAdmin ? '✅' : '❌'}</td>
                <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                <td>
                  <button
                    className="button danger"
                    style={{ marginRight: '8px', padding: '4px 8px', fontSize: '12px' }}
                    onClick={() => handleDeleteUser(user._id || user.id)}
                  >
                    Eliminar
                  </button>
                  <button
                    className="button"
                    style={{ padding: '4px 8px', fontSize: '12px' }}
                    onClick={() => {
                      const newPassword = prompt('Nueva contraseña (mínimo 6 caracteres):');
                      if (newPassword) {
                        handleChangeUserPassword(user._id || user.id, newPassword);
                      }
                    }}
                  >
                    Cambiar Contraseña
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Editor de Operaciones */}
      {showOperationsEditor && (
        <div className="modal" onClick={() => setShowOperationsEditor(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '95%', maxHeight: '90vh', overflow: 'auto' }}>
            <h2>✏️ Editor de Operaciones</h2>

            {/* Selectores de Usuario y Portfolio */}
            <div className="form-row" style={{ marginBottom: '20px' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Usuario</label>
                <select
                  className="input"
                  value={selectedUserId || ''}
                  onChange={(e) => {
                    const userId = e.target.value ? parseInt(e.target.value) : null;
                    setSelectedUserId(userId);
                    setSelectedPortfolioId(null);
                    setOperations([]);
                  }}
                >
                  <option value="">Selecciona un usuario...</option>
                  {usersPortfolios.map(user => (
                    <option key={user.userId} value={user.userId}>
                      {user.username}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ flex: 1 }}>
                <label>Portfolio</label>
                <select
                  className="input"
                  value={selectedPortfolioId || ''}
                  disabled={!selectedUserId}
                  onChange={(e) => {
                    const portfolioId = e.target.value ? parseInt(e.target.value) : null;
                    setSelectedPortfolioId(portfolioId);
                    if (portfolioId) {
                      loadOperations(portfolioId);
                    } else {
                      setOperations([]);
                    }
                  }}
                >
                  <option value="">Selecciona un portfolio...</option>
                  {selectedUserId && usersPortfolios.find(u => u.userId === selectedUserId)?.portfolios.map(portfolio => (
                    <option key={portfolio.id} value={portfolio.id}>
                      {portfolio.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Tabla de Operaciones */}
            {operations.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table className="operations-table" style={{ width: '100%', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#333' }}>
                      <th style={{ padding: '8px' }}>Fecha</th>
                      <th style={{ padding: '8px' }}>Tipo</th>
                      <th style={{ padding: '8px' }}>Compañía</th>
                      <th style={{ padding: '8px', width: '150px' }}>Símbolo</th>
                      <th style={{ padding: '8px' }}>Acciones</th>
                      <th style={{ padding: '8px' }}>Precio</th>
                      <th style={{ padding: '8px' }}>Tasa Cambio</th>
                      <th style={{ padding: '8px' }}>Comisión</th>
                      <th style={{ padding: '8px' }}>Total</th>
                      <th style={{ padding: '8px' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {operations.map(op => {
                      const validation = symbolValidations[op.id];
                      const isValidating = validatingSymbols[op.id];
                      const hasEdits = editingOperations[op.id] && Object.keys(editingOperations[op.id]).length > 0;

                      return (
                        <tr key={op.id} style={{ borderBottom: '1px solid #444' }}>
                          <td style={{ padding: '4px' }}>
                            <input
                              type="date"
                              className="input"
                              style={{ fontSize: '12px', padding: '4px' }}
                              value={getEditedValue(op, 'date')?.split('T')[0] || ''}
                              onChange={(e) => handleOperationFieldChange(op.id, 'date', e.target.value)}
                            />
                          </td>
                          <td style={{ padding: '4px' }}>
                            <span style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              backgroundColor: op.type === 'purchase' ? '#22c55e' : '#ef4444',
                              color: 'white',
                              fontSize: '11px',
                              fontWeight: 'bold'
                            }}>
                              {op.type === 'purchase' ? '📈 COMPRA' : '📉 VENTA'}
                            </span>
                          </td>
                          <td style={{ padding: '4px' }}>
                            <input
                              type="text"
                              className="input"
                              style={{ fontSize: '12px', padding: '4px', width: '100%' }}
                              value={getEditedValue(op, 'company')}
                              onChange={(e) => handleOperationFieldChange(op.id, 'company', e.target.value)}
                            />
                          </td>
                          <td style={{ padding: '4px' }}>
                            <div>
                              <input
                                type="text"
                                className="input"
                                style={{ fontSize: '12px', padding: '4px', width: '100%', marginBottom: '4px' }}
                                value={getEditedValue(op, 'symbol')}
                                onChange={(e) => handleOperationFieldChange(op.id, 'symbol', e.target.value)}
                              />
                              {isValidating && (
                                <div style={{ fontSize: '11px', color: '#888' }}>⏳ Validando...</div>
                              )}
                              {!isValidating && validation && validation.valid && (
                                <div style={{ fontSize: '11px', color: '#22c55e' }}>
                                  ✅ {validation.price.toFixed(2)} {validation.currency} ({validation.source})
                                </div>
                              )}
                              {!isValidating && validation && !validation.valid && (
                                <div style={{ fontSize: '11px', color: '#ef4444' }}>
                                  ❌ {validation.error}
                                </div>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '4px' }}>
                            <input
                              type="number"
                              step="0.01"
                              className="input"
                              style={{ fontSize: '12px', padding: '4px', width: '80px' }}
                              value={getEditedValue(op, 'shares')}
                              onChange={(e) => handleOperationFieldChange(op.id, 'shares', parseFloat(e.target.value))}
                            />
                          </td>
                          <td style={{ padding: '4px' }}>
                            <input
                              type="number"
                              step="0.01"
                              className="input"
                              style={{ fontSize: '12px', padding: '4px', width: '80px' }}
                              value={getEditedValue(op, 'price')}
                              onChange={(e) => handleOperationFieldChange(op.id, 'price', parseFloat(e.target.value))}
                            />
                          </td>
                          <td style={{ padding: '4px' }}>
                            <input
                              type="number"
                              step="0.000000000001"
                              className="input"
                              style={{ fontSize: '12px', padding: '4px', width: '90px' }}
                              value={getEditedValue(op, 'exchangeRate')}
                              onChange={(e) => handleOperationFieldChange(op.id, 'exchangeRate', parseFloat(e.target.value))}
                            />
                          </td>
                          <td style={{ padding: '4px' }}>
                            <input
                              type="number"
                              step="0.01"
                              className="input"
                              style={{ fontSize: '12px', padding: '4px', width: '70px' }}
                              value={getEditedValue(op, 'commission')}
                              onChange={(e) => handleOperationFieldChange(op.id, 'commission', parseFloat(e.target.value))}
                            />
                          </td>
                          <td style={{ padding: '4px', fontWeight: 'bold' }}>
                            {calculateTotal(op).toFixed(2)}€
                          </td>
                          <td style={{ padding: '4px' }}>
                            <button
                              className="button primary"
                              style={{ fontSize: '11px', padding: '4px 12px' }}
                              disabled={!hasEdits || (validation && !validation.valid && editingOperations[op.id]?.symbol !== undefined)}
                              onClick={() => saveOperation(op.id)}
                            >
                              💾 Guardar
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {operations.length === 0 && selectedPortfolioId && (
              <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
                No hay operaciones en este portfolio
              </div>
            )}

            {!selectedPortfolioId && (
              <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
                Selecciona un usuario y portfolio para ver las operaciones
              </div>
            )}

            <div className="modal-actions" style={{ marginTop: '20px' }}>
              <button
                className="button"
                onClick={() => {
                  setShowOperationsEditor(false);
                  setSelectedUserId(null);
                  setSelectedPortfolioId(null);
                  setOperations([]);
                  setEditingOperations({});
                  setSymbolValidations({});
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

}

export default Admin;

