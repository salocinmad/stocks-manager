
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Header } from '../components/Header';
import { TwoFactorSettings } from '../components/TwoFactorSettings';
import { NotificationChannelsContent } from './NotificationChannelsScreen';

export const ProfileScreen: React.FC = () => {
  const { isAdmin, api, logout } = useAuth();

  const [activeTab, setActiveTab] = useState<'general' | 'security' | 'notifications'>('general');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdMessage, setPwdMessage] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [loadingPwd, setLoadingPwd] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdMessage('');
    setPwdError('');

    if (newPassword !== confirmPassword) {
      setPwdError('Las contraseñas nuevas no coinciden');
      return;
    }

    setLoadingPwd(true);
    try {
      const res = await api.post('/auth/change-password', {
        currentPassword,
        newPassword
      });
      setPwdMessage(res.data.message || 'Contraseña actualizada');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPwdError(err.response?.data?.error || 'Error al cambiar la contraseña');
    } finally {
      setLoadingPwd(false);
    }
  };

  const toggleTheme = (mode: 'dark' | 'light') => {
    if (mode === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  };

  return (
    <main className="flex-1 flex flex-col h-screen overflow-y-auto bg-background-light dark:bg-background-dark">
      <Header title="Perfil y Ajustes" />

      <div className="flex flex-col p-6 md:p-10 max-w-5xl mx-auto w-full gap-8">

        {/* Tabs Navigation */}
        <div className="flex flex-wrap gap-2 border-b border-border-light dark:border-border-dark pb-0">
          <button
            onClick={() => setActiveTab('general')}
            className={`px-8 py-4 rounded-t-2xl font-bold text-base transition-all flex items-center gap-3 ${activeTab === 'general'
              ? 'bg-primary text-black shadow-[0_-4px_15px_rgba(252,233,3,0.15)] translate-y-[1px] z-10'
              : 'text-text-secondary-light dark:text-text-secondary-dark hover:bg-black/5 dark:hover:bg-white/5'
              }`}
          >
            <span className="material-symbols-outlined">person</span>
            General
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`px-8 py-4 rounded-t-2xl font-bold text-base transition-all flex items-center gap-3 ${activeTab === 'security'
              ? 'bg-primary text-black shadow-[0_-4px_15px_rgba(252,233,3,0.15)] translate-y-[1px] z-10'
              : 'text-text-secondary-light dark:text-text-secondary-dark hover:bg-black/5 dark:hover:bg-white/5'
              }`}
          >
            <span className="material-symbols-outlined">lock</span>
            Seguridad
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`px-8 py-4 rounded-t-2xl font-bold text-base transition-all flex items-center gap-3 ${activeTab === 'notifications'
              ? 'bg-primary text-black shadow-[0_-4px_15px_rgba(252,233,3,0.15)] translate-y-[1px] z-10'
              : 'text-text-secondary-light dark:text-text-secondary-dark hover:bg-black/5 dark:hover:bg-white/5'
              }`}
          >
            <span className="material-symbols-outlined">hub</span>
            Canales
          </button>
        </div>

        {/* Tab Content */}
        <div className="animate-fade-in min-h-[400px]">

          {/* GENERAL TAB */}
          {activeTab === 'general' && (
            <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* Tarjeta Perfil */}
              <div className="flex flex-col p-8 rounded-3xl bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-sm">
                <div className="flex items-center gap-6 mb-8">
                  <div className="size-24 rounded-full bg-primary/20 border-4 border-white dark:border-surface-dark-elevated shadow-xl bg-cover bg-center" style={{ backgroundImage: "url('https://picsum.photos/seed/user/200/200')" }}></div>
                  <div>
                    <h3 className="text-2xl font-bold">Carlos Rodríguez</h3>
                    <p className="text-text-secondary-light">carlos.pro@example.com</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold uppercase text-text-secondary-light tracking-widest">Nombre Público</label>
                    <input defaultValue="Carlos" className="px-5 py-4 rounded-2xl bg-background-light dark:bg-background-dark border-none focus:ring-2 focus:ring-primary text-text-primary-light dark:text-white" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold uppercase text-text-secondary-light tracking-widest">Divisa Principal</label>
                    <select className="px-5 py-4 rounded-2xl bg-background-light dark:bg-background-dark border-none focus:ring-2 focus:ring-primary text-text-primary-light dark:text-white">
                      <option>EUR (€)</option>
                      <option>USD ($)</option>
                      <option>GBP (£)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Tarjeta Apariencia */}
              <div className="flex flex-col p-8 rounded-3xl bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-sm">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">palette</span> Apariencia
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => toggleTheme('light')}
                    className="group relative flex flex-col items-center gap-3 p-4 rounded-2xl border-2 border-border-light dark:border-transparent bg-background-light dark:bg-background-dark hover:border-primary transition-all"
                  >
                    <div className="size-12 rounded-full bg-white flex items-center justify-center text-black shadow-md">
                      <span className="material-symbols-outlined">light_mode</span>
                    </div>
                    <span className="font-bold text-sm">Claro</span>
                  </button>
                  <button
                    onClick={() => toggleTheme('dark')}
                    className="group relative flex flex-col items-center gap-3 p-4 rounded-2xl border-2 border-border-light dark:border-transparent bg-background-light dark:bg-background-dark hover:border-primary transition-all"
                  >
                    <div className="size-12 rounded-full bg-slate-900 flex items-center justify-center text-white shadow-md">
                      <span className="material-symbols-outlined">dark_mode</span>
                    </div>
                    <span className="font-bold text-sm">Oscuro</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SECURITY TAB */}
          {activeTab === 'security' && (
            <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* 2FA Settings */}
              <TwoFactorSettings />

              <div className="flex flex-col p-8 rounded-3xl bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-sm">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">lock</span> Cambio de Contraseña
                </h3>

                {pwdMessage && (
                  <div className="mb-4 p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 text-sm font-bold">
                    {pwdMessage}
                  </div>
                )}
                {pwdError && (
                  <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm font-bold">
                    {pwdError}
                  </div>
                )}

                <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase text-text-secondary-light mb-2">Contraseña Actual</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      className="w-full px-5 py-3 rounded-2xl bg-background-light dark:bg-background-dark border-none focus:ring-2 focus:ring-primary text-text-primary-light dark:text-white"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase text-text-secondary-light mb-2">Nueva Contraseña</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        className="w-full px-5 py-3 rounded-2xl bg-background-light dark:bg-background-dark border-none focus:ring-2 focus:ring-primary text-text-primary-light dark:text-white"
                        placeholder="Mínimo 6 caracteres"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-text-secondary-light mb-2">Confirmar Nueva</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        className="w-full px-5 py-3 rounded-2xl bg-background-light dark:bg-background-dark border-none focus:ring-2 focus:ring-primary text-text-primary-light dark:text-white"
                        placeholder="Repite la contraseña"
                        required
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loadingPwd}
                    className="mt-2 px-6 py-3 bg-primary/10 hover:bg-primary text-primary hover:text-black font-bold rounded-2xl transition-all self-start disabled:opacity-50"
                  >
                    {loadingPwd ? 'Actualizando...' : 'Cambiar Contraseña'}
                  </button>
                </form>
              </div>

              {/* Aviso sobre configuración de API - Solo visible para no-admins en la pestaña de seguridad también, o en General. Lo prefiero aquí. */}
              {!isAdmin && (
                <div className="flex items-center gap-4 p-6 bg-blue-500/10 border border-blue-500/20 rounded-3xl">
                  <span className="material-symbols-outlined text-blue-500 text-2xl">info</span>
                  <div>
                    <p className="text-sm text-text-secondary-light">
                      La configuración de APIs (Finnhub, Google Gemini) está gestionada por los administradores del sistema.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* NOTIFICATIONS TAB */}
          {activeTab === 'notifications' && (
            <NotificationChannelsContent />
          )}
        </div>

        {/* LOGOUT FOOTER - ALWAYS VISIBLE */}
        <div className="border-t border-border-light dark:border-border-dark pt-8 mt-4">
          <div className="flex justify-between items-center p-6 bg-red-500/10 border border-red-500/20 rounded-3xl hover:bg-red-500/15 transition-all cursor-pointer group" onClick={logout}>
            <div className="flex flex-col">
              <h4 className="font-bold text-red-500 group-hover:translate-x-1 transition-transform">Cerrar Sesión Global</h4>
              <p className="text-xs opacity-60">Se cerrará la sesión en este dispositivo.</p>
            </div>
            <button className="px-6 py-2 bg-red-500 text-white font-bold rounded-full shadow-lg active:scale-95 transition-all group-hover:shadow-red-500/30">Salir</button>
          </div>
        </div>

      </div>
    </main>
  );
};
