import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const RegisterScreen: React.FC = () => {
  const navigate = useNavigate();
  const { login, api } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validación básica
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/auth/register', {
        email,
        password,
        fullName
      });
      const { token, user } = response.data;

      // Guardar token y usuario usando el contexto de autenticación
      login(token, user);

      // Navegar al dashboard
      navigate('/');
    } catch (err: any) {
      console.error('Register error:', err);
      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError('Error al crear la cuenta. Inténtalo de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex flex-col items-center justify-center h-screen w-full bg-background-light dark:bg-background-dark p-6 relative">
      <div className="relative w-full max-w-lg">
        <div className="bg-white dark:bg-surface-dark rounded-[3rem] border border-border-light dark:border-border-dark shadow-2xl p-10 md:p-14">
          <h2 className="text-4xl font-bold tracking-tight mb-2">Crear Cuenta</h2>
          <p className="text-text-secondary-light dark:text-text-secondary-dark mb-10 text-lg">Únete a la nueva era de la gestión de activos.</p>

          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <form className="flex flex-col gap-6" onSubmit={handleRegister}>
            <div className="space-y-2">
              <label className="text-sm font-bold uppercase tracking-widest ml-1">Nombre Completo</label>
              <input
                className="block w-full px-5 py-4 rounded-2xl bg-background-light dark:bg-background-dark border-none text-lg focus:ring-2 focus:ring-primary"
                type="text"
                placeholder="Tu nombre"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold uppercase tracking-widest ml-1">Email</label>
              <input
                className="block w-full px-5 py-4 rounded-2xl bg-background-light dark:bg-background-dark border-none text-lg focus:ring-2 focus:ring-primary"
                type="email"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold uppercase tracking-widest ml-1">Contraseña</label>
              <input
                className="block w-full px-5 py-4 rounded-2xl bg-background-light dark:bg-background-dark border-none text-lg focus:ring-2 focus:ring-primary"
                type="password"
                placeholder="Mín. 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <button
              className="mt-6 w-full py-5 rounded-full bg-primary text-black font-bold text-xl shadow-xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              type="submit"
              disabled={loading}
            >
              {loading ? 'Creando cuenta...' : 'Completar Registro'}
            </button>
          </form>

          <div className="mt-12 text-center text-sm">
            <span className="text-text-secondary-light dark:text-text-secondary-dark">
              ¿Ya eres usuario? <Link to="/login" className="font-bold text-primary underline underline-offset-4">Inicia sesión</Link>
            </span>
          </div>
        </div>
      </div>
    </main>
  );
};
