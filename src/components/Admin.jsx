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
  const [showPass, setShowPass] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadUsers();
    loadApiKey();
    loadSmtp();
  }, []);

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
      const keys = ['smtp_host','smtp_port','smtp_user','smtp_subject','smtp_to'];
      for (const k of keys) {
        const r = await configAPI.get(k);
        const v = r?.value || '';
        if (k==='smtp_host') setSmtpHost(v);
        if (k==='smtp_port') setSmtpPort(v||'587');
        if (k==='smtp_user') setSmtpUser(v);
        if (k==='smtp_subject') setSmtpSubject(v||'Alerta de precios');
        if (k==='smtp_to') setSmtpTo(v);
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

  if (loading) {
    return <div className="admin-container">Cargando...</div>;
  }

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1>🔐 Panel de Administración</h1>
        <button className="back-button" onClick={() => navigate('/')}>
          ← Volver al Portfolio
        </button>
      </div>

      {error && <div className="alert error">{error}</div>}
      {success && <div className="alert success">{success}</div>}

      <div className="admin-actions">
        <button 
          className="button primary" 
          onClick={() => setShowCreateUser(true)}
        >
          ➕ Crear Usuario
        </button>
        <button 
          className="button warning" 
          onClick={() => setShowResetAdmin(true)}
        >
          🔑 Resetear Contraseña Admin
        </button>
        <button 
          className="button" 
          onClick={() => {
            setShowApiKeyConfig(true);
            loadApiKey();
          }}
        >
          🔑 Configurar API Key Finnhub
        </button>
        <button 
          className="button" 
          onClick={() => {
            setShowSmtpConfig(true);
            loadSmtp();
          }}
        >
          ✉️ Configurar SMTP
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
            } catch {}
            setShowSchedulerConfig(true)
          }}
        >
          ⚙️ Configurar Scheduler
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
        >
          🔁 Rearmar Alertas
        </button>
        <button 
          className="button" 
          onClick={async ()=>{
            try {
              const r = await authenticatedFetch('/api/admin/daily-close/run', { method: 'POST' })
              if (r.ok) {
                const d = await r.json()
                setSuccess(`Cierre diario ejecutado (${d.date})`)
              } else {
                setError('Error ejecutando cierre diario')
              }
            } catch (e) {
              setError('Error ejecutando cierre diario')
            }
          }}
        >
          📅 Ejecutar Cierre Diario
        </button>
      </div>

      {showSmtpConfig && (
        <div className="modal-overlay" onClick={() => { setShowSmtpConfig(false); setShowPass(false); setSmtpPass('') }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <h2>✉️ Notificaciones SMTP</h2>
            <div className="form-row">
              <div className="form-group">
                <label>Host</label>
                <input className="input" type="text" placeholder="smtp.ejemplo.com" value={smtpHost} onChange={(e)=> setSmtpHost(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Puerto</label>
                <input className="input" type="number" placeholder="587" value={smtpPort} onChange={(e)=> setSmtpPort(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Usuario</label>
                <input className="input" type="text" placeholder="usuario@dominio" value={smtpUser} onChange={(e)=> setSmtpUser(e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label>Password</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input className="input" style={{ flex: 1 }} type={showPass ? 'text' : 'password'} value={smtpPass} onChange={(e)=> setSmtpPass(e.target.value)} placeholder={showPass ? '' : 'No se muestra la guardada'} />
                <button className="button" style={{ fontSize: '12px' }} onClick={async ()=>{
                  if (!showPass) {
                    const r = await authenticatedFetch('/api/admin/smtp-pass')
                    if (r.ok) {
                      const data = await r.json()
                      setSmtpPass(data.pass || '')
                      setShowPass(true)
                      setTimeout(()=> { setShowPass(false); setSmtpPass('') }, 1000 * 15)
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
                <input className="input" type="text" placeholder="Asunto por defecto" value={smtpSubject} onChange={(e)=> setSmtpSubject(e.target.value)} />
              </div>
              <div className="form-group" style={{ flex: 2 }}>
                <label>Destinatarios (coma)</label>
                <input className="input" type="text" placeholder="correo1@dominio, correo2@dominio" value={smtpTo} onChange={(e)=> setSmtpTo(e.target.value)} />
              </div>
            </div>
            <div className="admin-actions">
              <button className="button primary" onClick={async ()=>{
                const r = await authenticatedFetch('/api/admin/smtp', { method: 'POST', body: JSON.stringify({ host: smtpHost, port: parseInt(smtpPort||'587'), user: smtpUser, pass: smtpPass, subject: smtpSubject, to: smtpTo }) })
                if (r.ok) setSuccess('SMTP guardado'); else setError('Error guardando SMTP')
                setSmtpPass('')
              }}>💾 Guardar SMTP</button>
              <button className="button" onClick={async ()=>{
                const r = await authenticatedFetch('/api/admin/notify-test', { method: 'POST' })
                if (r.ok) setSuccess('Prueba enviada'); else setError('Error al enviar prueba')
              }}>✉️ Enviar prueba</button>
              <button className="button" onClick={()=>{ setShowSmtpConfig(false); setShowPass(false); setSmtpPass('') }}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {showSchedulerConfig && (
        <div className="modal-overlay" onClick={() => setShowSchedulerConfig(false)}>
          <div className="modal-content" onClick={(e)=>e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <h2>⚙️ Scheduler</h2>
            <div className="form-row">
              <div className="form-group">
                <label>Activado</label>
                <input type="checkbox" checked={schedulerEnabled} onChange={(e)=> setSchedulerEnabled(e.target.checked)} />
              </div>
              <div className="form-group">
                <label>Intervalo (minutos)</label>
                <input type="number" className="input" min={1} value={schedulerInterval} onChange={(e)=> setSchedulerInterval(e.target.value)} />
              </div>
            </div>
            <div style={{ fontSize: '12px', color: '#888' }}>
              Última ejecución: {schedulerLastRun ? new Date(schedulerLastRun).toLocaleString('es-ES', { hour12: false }) : '—'}
            </div>
            <div className="admin-actions">
              <button className="button primary" onClick={async ()=>{
                const r = await authenticatedFetch('/api/admin/scheduler', { method: 'POST', body: JSON.stringify({ enabled: schedulerEnabled, intervalMinutes: parseInt(schedulerInterval || 15) }) })
                if (r.ok) setSuccess('Scheduler actualizado'); else setError('Error actualizando scheduler')
                setShowSchedulerConfig(false)
              }}>💾 Guardar</button>
              <button className="button" onClick={async ()=>{
                const r = await authenticatedFetch('/api/admin/scheduler/run', { method: 'POST' })
                if (r.ok) setSuccess('Ejecución manual realizada'); else setError('Error al ejecutar ahora')
              }}>▶ Ejecutar ahora</button>
              <button className="button" onClick={()=> setShowSchedulerConfig(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal crear usuario */}
      {showCreateUser && (
        <div className="modal-overlay" onClick={() => setShowCreateUser(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Crear Nuevo Usuario</h2>
            <form onSubmit={handleCreateUser}>
              <div className="form-group">
                <label>Usuario</label>
                <input
                  type="text"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Contraseña</label>
                <input
                  type="password"
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
        <div className="modal-overlay" onClick={() => setShowResetAdmin(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Resetear Contraseña de Administrador</h2>
            <form onSubmit={handleResetAdminPassword}>
              <div className="form-group">
                <label>Contraseña Maestra</label>
                <input
                  type="password"
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
        <div className="modal-overlay" onClick={() => setShowApiKeyConfig(false)}>
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

      {/* Lista de usuarios */}
      <div className="users-list">
        <h2>Usuarios ({users.length})</h2>
        <table className="users-table">
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
                    className="button small danger"
                    onClick={() => handleDeleteUser(user._id || user.id)}
                  >
                    Eliminar
                  </button>
                  <button
                    className="button small"
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
    </div>
  );
}

export default Admin;

