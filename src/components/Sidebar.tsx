import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { ThemeSwitcher } from './ThemeSwitcher';

type NavItem = {
  path: string;
  icon: string;
  label: string;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, logout, isAdmin } = useAuth();

  const isActive = (path: string) => location.pathname === path;

  // Grouped Navigation
  const navGroups: NavGroup[] = [
    {
      title: 'Principal',
      items: [
        { path: '/', icon: 'dashboard', label: t('menu.dashboard') },
        { path: '/portfolio', icon: 'pie_chart', label: t('menu.portfolio') },
        { path: '/watchlists', icon: 'playlist_play', label: t('menu.watchlists') },
      ]
    },
    {
      title: 'Mercados',
      items: [
        { path: '/market', icon: 'show_chart', label: t('menu.market') },
        { path: '/news', icon: 'newspaper', label: t('menu.news') },
        { path: '/calendar', icon: 'calendar_month', label: 'Calendario' },
        { path: '/reports', icon: 'fact_check', label: t('menu.reports') },
      ]
    },
    {
      title: 'Sistema',
      items: [
        { path: '/alerts', icon: 'notifications_active', label: t('menu.alerts') },
        { path: '/importers', icon: 'cloud_upload', label: 'Importador' },
      ]
    }
  ];

  if (isAdmin) {
    navGroups.push({
      title: 'Administración',
      items: [
        { path: '/admin', icon: 'admin_panel_settings', label: 'Panel Admin' }
      ]
    });
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="hidden md:flex w-20 lg:w-72 flex-col justify-between bg-surface-light/95 dark:bg-surface-dark/95 backdrop-blur-md border-r border-border-light dark:border-border-dark py-6 z-20 sticky top-0 h-screen transition-all duration-300 shadow-xl">
      <div className="flex flex-col h-full overflow-y-auto scrollbar-thin">
        {/* Brand */}
        <div className="flex items-center justify-center lg:justify-start gap-3 px-2 lg:px-6 mb-8 cursor-pointer group" onClick={() => navigate('/')}>
          <div className="flex-shrink-0 flex items-center justify-center size-10 rounded-xl bg-primary text-black shadow-lg shadow-primary/30 group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined font-bold">insert_chart</span>
          </div>
          <h1 className="hidden lg:block text-xl font-bold tracking-tight text-text-primary-light dark:text-text-primary-dark whitespace-nowrap group-hover:text-primary transition-colors">
            Stocks Manager
          </h1>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-6 px-3 lg:px-4 flex-1">
          {navGroups.map((group, groupIdx) => (
            <div key={groupIdx}>
              <h3 className="hidden lg:block px-4 text-[10px] font-black uppercase tracking-widest text-text-secondary-light/70 dark:text-text-secondary-dark/70 mb-2">
                {group.title}
              </h3>
              <div className="flex flex-col gap-1">
                {group.items.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`group relative flex items-center justify-center lg:justify-start gap-0 lg:gap-3 px-2 lg:px-4 py-2.5 rounded-xl transition-all duration-200 ${isActive(item.path)
                      ? 'bg-primary text-black font-bold shadow-md shadow-primary/25'
                      : 'text-text-secondary-light dark:text-text-secondary-dark hover:bg-black/5 dark:hover:bg-white/10 hover:text-text-primary-light dark:hover:text-white'
                      }`}
                  >
                    <span className={`material-symbols-outlined text-[22px] transition-transform group-hover:scale-110 ${isActive(item.path) ? 'fill' : ''}`}>
                      {item.icon}
                    </span>
                    <span className="hidden lg:block text-sm">
                      {item.label}
                    </span>
                    {isActive(item.path) && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1/2 bg-black/20 rounded-r-full hidden lg:block" />
                    )}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer actions */}
        <div className="flex flex-col gap-4 px-3 lg:px-4 mt-6 pt-6 border-t border-border-light dark:border-border-dark">
          <div className="flex flex-col items-center lg:items-start gap-2">
            <span className="hidden lg:block text-[10px] font-bold uppercase tracking-widest text-text-secondary-light/70">Ajustes</span>
            <ThemeSwitcher />
          </div>

          <Link
            to="/profile"
            className={`group flex items-center justify-center lg:justify-start gap-0 lg:gap-3 px-2 lg:px-4 py-2.5 rounded-xl transition-colors ${isActive('/profile')
              ? 'bg-primary text-black'
              : 'text-text-secondary-light dark:text-text-secondary-dark hover:bg-black/5 dark:hover:bg-white/10'
              }`}
          >
            <span className="material-symbols-outlined">settings</span>
            <span className="hidden lg:block text-sm font-medium">Configuración</span>
          </Link>

          <button
            onClick={handleLogout}
            className="flex items-center justify-center lg:justify-start gap-0 lg:gap-3 px-2 lg:px-4 py-2 hover:bg-red-500/10 hover:text-red-500 rounded-xl transition-colors cursor-pointer group w-full text-left"
          >
            <div
              className="flex-shrink-0 size-8 rounded-full bg-gray-200 dark:bg-gray-700 bg-cover bg-center border border-white/20"
              style={{ backgroundImage: user?.avatar_url ? `url('${user.avatar_url}')` : "url('https://ui-avatars.com/api/?name=" + (user?.name || 'User') + "&background=random')" }}
            ></div>
            <div className="hidden lg:flex flex-col overflow-hidden">
              <p className="text-xs font-bold text-text-primary-light dark:text-text-primary-dark truncate group-hover:text-red-500">
                {user?.name || 'Usuario'}
              </p>
              <span className="text-[10px] opacity-70">Cerrar Sesión</span>
            </div>
          </button>
        </div>
      </div>
    </aside>
  );
};
