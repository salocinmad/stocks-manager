import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { ThemeSwitcher } from './ThemeSwitcher';

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, logout, isAdmin } = useAuth();

  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { path: '/', icon: 'dashboard', label: t('menu.dashboard') },
    { path: '/portfolio', icon: 'pie_chart', label: t('menu.portfolio') },
    { path: '/market', icon: 'show_chart', label: t('menu.market') },
    { path: '/news', icon: 'newspaper', label: t('menu.news') },
    { path: '/reports', icon: 'fact_check', label: t('menu.reports') },
    { path: '/alerts', icon: 'notifications_active', label: t('menu.alerts') },
    { path: '/notifications', icon: 'hub', label: 'Canales' },
    { path: '/watchlists', icon: 'playlist_play', label: t('menu.watchlists') },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="hidden md:flex w-20 lg:w-72 flex-col justify-between bg-surface-light dark:bg-surface-dark border-r border-border-light dark:border-border-dark py-6 z-20 sticky top-0 h-screen transition-all duration-300">
      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-center lg:justify-start gap-3 px-2 lg:px-6 cursor-pointer" onClick={() => navigate('/')}>
          <div className="flex-shrink-0 flex items-center justify-center size-10 rounded-full bg-primary text-black shadow-[0_0_15px_rgba(252,233,3,0.3)]">
            <span className="material-symbols-outlined font-bold">insert_chart</span>
          </div>
          <h1 className="hidden lg:block text-xl font-bold tracking-tight text-text-primary-light dark:text-text-primary-dark whitespace-nowrap">Stocks Manager</h1>
        </div>
        <nav className="flex flex-col gap-2 px-2 lg:px-4">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`group flex items-center justify-center lg:justify-start gap-0 lg:gap-3 px-2 lg:px-4 py-3 rounded-full transition-all ${isActive(item.path)
                ? 'bg-primary text-black shadow-lg shadow-primary/20 ring-1 ring-black/5'
                : 'text-text-secondary-light dark:text-text-secondary-dark hover:bg-black/5 dark:hover:bg-white/5 hover:text-text-primary-light dark:hover:text-text-primary-dark'
                }`}
            >
              <span className={`material-symbols-outlined ${isActive(item.path) ? 'fill' : ''}`}>
                {item.icon}
              </span>
              <span className={`hidden lg:block text-sm font-semibold ${isActive(item.path) ? '' : 'font-medium'}`}>
                {item.label}
              </span>
            </Link>
          ))}


          <Link
            to="/importers"
            className={`group flex items-center justify-center lg:justify-start gap-0 lg:gap-3 px-2 lg:px-4 py-3 rounded-full transition-all ${location.pathname.startsWith('/importers')
              ? 'bg-primary text-black shadow-lg shadow-primary/20 ring-1 ring-black/5'
              : 'text-text-secondary-light dark:text-text-secondary-dark hover:bg-black/5 dark:hover:bg-white/5 hover:text-text-primary-light dark:hover:text-text-primary-dark'
              }`}
          >
            <span className={`material-symbols-outlined ${location.pathname.startsWith('/importers') ? 'fill' : ''}`}>
              cloud_upload
            </span>
            <span className={`hidden lg:block text-sm font-semibold ${location.pathname.startsWith('/importers') ? '' : 'font-medium'}`}>
              Importador
            </span>
          </Link>

          {/* Menú de Administración - Solo para admins */}
          {isAdmin && (
            <div className="mt-2 pt-2 lg:pt-0">
              <Link
                to="/admin"
                className={`group flex items-center justify-center lg:justify-start gap-0 lg:gap-3 px-2 lg:px-4 py-3 rounded-full transition-all ${isActive('/admin')
                  ? 'bg-primary text-black shadow-lg shadow-primary/20 ring-1 ring-black/5'
                  : 'text-text-secondary-light dark:text-text-secondary-dark hover:bg-black/5 dark:hover:bg-white/5 hover:text-text-primary-light dark:hover:text-text-primary-dark'
                  }`}
              >
                <span className={`material-symbols-outlined ${isActive('/admin') ? 'fill' : ''}`}>
                  admin_panel_settings
                </span>
                <span className={`hidden lg:block text-sm font-semibold ${isActive('/admin') ? '' : 'font-medium'}`}>
                  Administración
                </span>
              </Link>
            </div>
          )}
        </nav>
      </div>

      <div className="flex flex-col gap-4 px-2 lg:px-4 border-t border-border-light dark:border-border-dark pt-6">
        <div className="flex flex-col items-center lg:items-start gap-2">
          <span className="hidden lg:block text-xs font-bold text-text-secondary-light uppercase tracking-wider">Modo</span>
          <ThemeSwitcher />
        </div>

        <Link
          to="/profile"
          className={`group flex items-center justify-center lg:justify-start gap-0 lg:gap-3 px-2 lg:px-4 py-3 rounded-full transition-colors ${isActive('/profile') ? 'bg-primary text-black' : 'text-text-secondary-light dark:text-text-secondary-dark hover:bg-black/5 dark:hover:bg-white/5 hover:text-text-primary-light dark:hover:text-text-primary-dark'
            }`}
        >
          <span className="material-symbols-outlined">settings</span>
          <span className="hidden lg:block text-sm font-medium">{t('common.save') === 'Guardar' ? 'Configuración' : 'Settings'}</span>
        </Link>

        <div onClick={handleLogout} className="flex items-center justify-center lg:justify-start gap-0 lg:gap-3 px-0 lg:px-4 py-2 hover:bg-red-500/10 hover:text-red-500 rounded-full transition-colors cursor-pointer group">
          <div
            className="flex-shrink-0 size-10 rounded-full bg-gray-200 dark:bg-gray-700 bg-cover bg-center border-2 border-white dark:border-gray-600"
            style={{ backgroundImage: "url('https://ui-avatars.com/api/?name=" + (user?.name || 'User') + "&background=random')" }}
          ></div>
          <div className="hidden lg:flex flex-col overflow-hidden">
            <p className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark truncate">
              {user?.name || 'Usuario'}
              {isAdmin && <span className="ml-1 text-xs text-primary">(Admin)</span>}
            </p>
            <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark truncate">{t('common.logout')}</p>
          </div>
        </div>
      </div>
    </aside>
  );
};
