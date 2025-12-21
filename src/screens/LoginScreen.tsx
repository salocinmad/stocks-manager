import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const LoginScreen: React.FC = () => {
  const navigate = useNavigate();
  const { login, api } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [mode, setMode] = useState<'login' | 'forgot' | '2fa'>('login');
  const [successMessage, setSuccessMessage] = useState('');

  // 2FA State
  const [sessionToken, setSessionToken] = useState('');
  const [securityMode, setSecurityMode] = useState('standard');
  const [totpCode, setTotpCode] = useState('');
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [backupCode, setBackupCode] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/auth/login', { email, password });
      const data = response.data;

      // Check if 2FA is required
      if (data.requires2FA) {
        setSessionToken(data.sessionToken);
        setSecurityMode(data.securityMode);
        setMode('2fa');
        setLoading(false);
        return;
      }

      // Normal login
      login(data.token, data.user);
      navigate('/');
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.response?.data?.error || 'Error al iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  const handle2FAVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload: any = { sessionToken };

      if (useBackupCode) {
        payload.backupCode = backupCode.toUpperCase();
      } else {
        payload.totpCode = totpCode;
      }

      const response = await api.post('/auth/login', payload);
      const { token, user } = response.data;

      login(token, user);
      navigate('/');
    } catch (err: any) {
      console.error('2FA error:', err);
      setError(err.response?.data?.error || 'Error de verificación 2FA.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    try {
      const response = await api.post('/auth/forgot-password', { email });
      setSuccessMessage(response.data.message || 'Si el correo existe, recibirás una nueva contraseña.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al solicitar recuperación.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex flex-col items-center justify-center h-screen w-full bg-background-light dark:bg-background-dark p-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[120px] pointer-events-none -mr-40 -mt-40"></div>
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-accent-blue/10 rounded-full blur-[100px] pointer-events-none -ml-30 -mb-30"></div>

      <div className="relative w-full max-w-lg z-10">
        <div className="flex flex-col bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-[3rem] shadow-2xl p-10 md:p-14 transition-all duration-300">
          <div className="flex items-center gap-3 mb-10">
            <div className="size-12 rounded-2xl bg-primary flex items-center justify-center text-black shadow-lg">
              <span className="material-symbols-outlined font-bold">query_stats</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Stocks Manager</h1>
          </div>

          <h2 className="text-4xl font-bold tracking-tight mb-3">
            {mode === 'login' ? 'Bienvenido' : mode === '2fa' ? 'Verificación 2FA' : 'Recuperar Cuenta'}
          </h2>
          <p className="text-text-secondary-light dark:text-text-secondary-dark mb-10 text-lg">
            {mode === 'login'
              ? 'Accede a tu plataforma de inversión inteligente.'
              : mode === '2fa'
                ? securityMode === 'enhanced'
                  ? 'Introduce tu código 2FA y verifica tu email.'
                  : 'Introduce el código de tu aplicación autenticadora.'
                : 'Introduce tu email para restablecer tu contraseña.'}
          </p>

          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="mb-6 p-4 rounded-2xl bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 text-sm">
              {successMessage}
            </div>
          )}

          {mode === 'login' && (
            <form className="flex flex-col gap-6" onSubmit={handleLogin}>
              <div className="space-y-2">
                <label className="text-sm font-bold text-text-primary-light dark:text-white uppercase tracking-widest ml-1">Email</label>
                <input
                  className="block w-full px-5 py-4 bg-background-light dark:bg-background-dark border-none rounded-2xl text-text-primary-light dark:text-white focus:ring-2 focus:ring-primary outline-none text-lg transition-all"
                  placeholder="carlos.pro@example.com"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-bold text-text-primary-light dark:text-white uppercase tracking-widest ml-1">Contraseña</label>
                  <button type="button" onClick={() => { setMode('forgot'); setError(''); setSuccessMessage(''); }} className="text-xs font-bold text-primary hover:underline">
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <input
                  className="block w-full px-5 py-4 bg-background-light dark:bg-background-dark border-none rounded-2xl text-text-primary-light dark:text-white focus:ring-2 focus:ring-primary outline-none text-lg transition-all"
                  placeholder="••••••••"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <button
                className="mt-4 w-full py-5 rounded-full bg-primary hover:bg-primary-dim text-black font-bold text-xl shadow-xl shadow-primary/20 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                type="submit"
                disabled={loading}
              >
                <span>{loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}</span>
                {!loading && <span className="material-symbols-outlined text-2xl">arrow_forward</span>}
              </button>
            </form>
          )}

          {mode === '2fa' && (
            <form className="flex flex-col gap-6" onSubmit={handle2FAVerify}>
              {!useBackupCode ? (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-text-primary-light dark:text-white uppercase tracking-widest ml-1">
                    Código 2FA
                  </label>
                  <input
                    className="block w-full px-5 py-4 bg-background-light dark:bg-background-dark border-none rounded-2xl text-text-primary-light dark:text-white focus:ring-2 focus:ring-primary outline-none text-2xl text-center tracking-[0.5em] font-mono transition-all"
                    placeholder="000000"
                    type="text"
                    maxLength={6}
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    autoComplete="one-time-code"
                    required
                  />
                  <p className="text-xs text-text-secondary-light text-center mt-2">
                    Introduce el código de 6 dígitos de tu app autenticadora
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-text-primary-light dark:text-white uppercase tracking-widest ml-1">
                    Código de Respaldo
                  </label>
                  <input
                    className="block w-full px-5 py-4 bg-background-light dark:bg-background-dark border-none rounded-2xl text-text-primary-light dark:text-white focus:ring-2 focus:ring-primary outline-none text-xl text-center tracking-widest font-mono uppercase transition-all"
                    placeholder="XXXXXXXX"
                    type="text"
                    maxLength={8}
                    value={backupCode}
                    onChange={(e) => setBackupCode(e.target.value.toUpperCase().slice(0, 8))}
                    required
                  />
                  <p className="text-xs text-text-secondary-light text-center mt-2">
                    Usa uno de tus códigos de respaldo (un solo uso)
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={() => { setUseBackupCode(!useBackupCode); setError(''); }}
                className="text-sm text-primary hover:underline text-center"
              >
                {useBackupCode ? '← Usar código de la app' : '¿No tienes acceso a tu app? Usa un código de respaldo'}
              </button>

              <button
                className="mt-4 w-full py-5 rounded-full bg-primary hover:bg-primary-dim text-black font-bold text-xl shadow-xl shadow-primary/20 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                type="submit"
                disabled={loading || (!useBackupCode && totpCode.length !== 6) || (useBackupCode && backupCode.length < 6)}
              >
                <span>{loading ? 'Verificando...' : 'Verificar'}</span>
                {!loading && <span className="material-symbols-outlined text-2xl">verified_user</span>}
              </button>

              <button
                type="button"
                onClick={() => { setMode('login'); setSessionToken(''); setTotpCode(''); setBackupCode(''); setError(''); }}
                className="w-full py-3 text-sm font-bold text-text-secondary-light hover:text-primary transition-colors"
              >
                ← Volver al Inicio de Sesión
              </button>
            </form>
          )}

          {mode === 'forgot' && (
            <form className="flex flex-col gap-6" onSubmit={handleForgotPassword}>
              <div className="space-y-2">
                <label className="text-sm font-bold text-text-primary-light dark:text-white uppercase tracking-widest ml-1">Email</label>
                <input
                  className="block w-full px-5 py-4 bg-background-light dark:bg-background-dark border-none rounded-2xl text-text-primary-light dark:text-white focus:ring-2 focus:ring-primary outline-none text-lg transition-all"
                  placeholder="carlos.pro@example.com"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <button
                className="mt-4 w-full py-5 rounded-full bg-primary hover:bg-primary-dim text-black font-bold text-xl shadow-xl shadow-primary/20 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                type="submit"
                disabled={loading}
              >
                <span>{loading ? 'Enviando...' : 'Recuperar Contraseña'}</span>
                {!loading && <span className="material-symbols-outlined text-2xl">mail</span>}
              </button>
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); setSuccessMessage(''); }}
                className="w-full py-3 text-sm font-bold text-text-secondary-light hover:text-primary transition-colors"
              >
                Volver al Inicio de Sesión
              </button>
            </form>
          )}

          {mode === 'login' && (
            <div className="mt-12 pt-8 border-t border-border-light dark:border-border-dark/30 text-center">
              <p className="text-text-secondary-light dark:text-text-secondary-dark">
                ¿No tienes una cuenta? <Link to="/register" className="font-bold text-text-primary-light dark:text-white hover:text-primary transition-colors underline decoration-primary decoration-2 underline-offset-4">Regístrate ahora</Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
};
