import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, verifySession } from '../services/auth.js';
import './Login.css';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Verificar si ya hay una sesión activa
  useEffect(() => {
    const checkSession = async () => {
      const user = await verifySession();
      if (user) {
        navigate('/');
      }
    };
    checkSession();
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await login(username, password, twoFactorToken || null);

      if (response && response.requiresTwoFactor) {
        setRequiresTwoFactor(true);
        setLoading(false);
        // Focus en el input de 2FA si es posible (usando ref o simple autoFocus en el render)
        return;
      }

      navigate('/');
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      if (!requiresTwoFactor) {
        setLoading(false);
      }
    }
  };


  return (
    <div className="login-container">
      <div className="login-card">
        <h1>📊 Stocks Manager</h1>
        <h2>{requiresTwoFactor ? 'Autenticación 2FA' : 'Iniciar Sesión'}</h2>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          {!requiresTwoFactor ? (
            <>
              <div className="form-group">
                <label htmlFor="username">Usuario</label>
                <input
                  type="text"
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                  placeholder="Ingresa tu usuario"
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">Contraseña</label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Ingresa tu contraseña"
                />
              </div>
            </>
          ) : (
            <div className="form-group">
              <label htmlFor="2fa">Código de Autenticación</label>
              <div style={{ marginBottom: '10px', fontSize: '0.9em', color: '#888' }}>
                Ingresa el código de 6 dígitos de tu aplicación autenticadora.
              </div>
              <input
                type="text"
                id="2fa"
                value={twoFactorToken}
                onChange={(e) => setTwoFactorToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                autoFocus
                placeholder="000000"
                style={{ letterSpacing: '4px', textAlign: 'center', fontSize: '1.2em' }}
              />
            </div>
          )}

          <button
            type="submit"
            className="login-button"
            disabled={loading}
          >
            {loading ? 'Verificando...' : (requiresTwoFactor ? 'Verificar Código' : 'Iniciar Sesión')}
          </button>

          {requiresTwoFactor && (
            <button
              type="button"
              className="login-button"
              style={{ marginTop: '10px', backgroundColor: 'transparent', border: '1px solid #555', color: '#ccc' }}
              onClick={() => {
                setRequiresTwoFactor(false);
                setTwoFactorToken('');
                setError('');
              }}
            >
              Cancelar
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

export default Login;

