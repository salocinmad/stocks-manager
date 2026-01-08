import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { ThemeSwitcher } from './ThemeSwitcher';

type NavItem = {
    path: string;
    icon: string;
    label: string;
};

export const MobileNavigation: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { user, logout, isAdmin } = useAuth();
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    const isActive = (path: string) => location.pathname === path;

    // Bottom Nav Items (5 principales)
    const bottomNavItems: NavItem[] = [
        { path: '/', icon: 'dashboard', label: 'Inicio' },
        { path: '/portfolio', icon: 'pie_chart', label: 'Cartera' },
        { path: '/market', icon: 'show_chart', label: 'Mercado' },
        { path: '/alerts', icon: 'notifications_active', label: 'Alertas' },
    ];

    // Drawer Items (resto de opciones)
    const drawerItems: NavItem[] = [
        { path: '/watchlists', icon: 'playlist_play', label: t('menu.watchlists') },
        { path: '/news', icon: 'newspaper', label: t('menu.news') },
        { path: '/calendar', icon: 'calendar_month', label: 'Calendario' },
        { path: '/reports', icon: 'fact_check', label: t('menu.reports') },
        { path: '/importers', icon: 'cloud_upload', label: 'Importador' },
        { path: '/manual-entry', icon: 'add_circle', label: 'Nueva Operación' },
        { path: '/profile', icon: 'settings', label: 'Configuración' },
    ];

    if (isAdmin) {
        drawerItems.push({ path: '/admin', icon: 'admin_panel_settings', label: 'Panel Admin' });
    }

    const handleLogout = () => {
        logout();
        navigate('/login');
        setIsDrawerOpen(false);
    };

    const handleNavigation = (path: string) => {
        navigate(path);
        setIsDrawerOpen(false);
    };

    return (
        <>
            {/* Bottom Navigation Bar - Solo visible en móvil */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-surface-dark border-t border-border-light dark:border-border-dark safe-area-bottom">
                <div className="flex items-center justify-around h-16">
                    {bottomNavItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-colors ${isActive(item.path)
                                    ? 'text-primary'
                                    : 'text-text-secondary-light dark:text-text-secondary-dark'
                                }`}
                        >
                            <span className={`material-symbols-outlined text-[22px] ${isActive(item.path) ? 'fill' : ''}`}>
                                {item.icon}
                            </span>
                            <span className="text-[10px] font-bold mt-0.5">{item.label}</span>
                        </Link>
                    ))}

                    {/* Botón "Más" para abrir drawer */}
                    <button
                        onClick={() => setIsDrawerOpen(true)}
                        className="flex flex-col items-center justify-center flex-1 h-full py-1 text-text-secondary-light dark:text-text-secondary-dark"
                    >
                        <span className="material-symbols-outlined text-[22px]">menu</span>
                        <span className="text-[10px] font-bold mt-0.5">Más</span>
                    </button>
                </div>
            </nav>

            {/* Drawer Overlay */}
            {isDrawerOpen && (
                <div
                    className="md:hidden fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm animate-fade-in"
                    onClick={() => setIsDrawerOpen(false)}
                />
            )}

            {/* Drawer Panel */}
            <div
                className={`md:hidden fixed top-0 right-0 bottom-0 z-[70] w-72 max-w-[85vw] bg-white dark:bg-surface-dark shadow-2xl transform transition-transform duration-300 ease-out ${isDrawerOpen ? 'translate-x-0' : 'translate-x-full'
                    }`}
            >
                {/* Drawer Header */}
                <div className="flex items-center justify-between p-4 border-b border-border-light dark:border-border-dark">
                    <div className="flex items-center gap-3">
                        <div className="size-10 rounded-xl bg-primary flex items-center justify-center">
                            <span className="material-symbols-outlined text-black">insert_chart</span>
                        </div>
                        <span className="font-bold text-lg">Menú</span>
                    </div>
                    <button
                        onClick={() => setIsDrawerOpen(false)}
                        className="size-10 rounded-xl flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Drawer Content */}
                <div className="flex flex-col h-[calc(100%-80px)] overflow-y-auto">
                    {/* User Info */}
                    <div className="p-4 border-b border-border-light dark:border-border-dark">
                        <div className="flex items-center gap-3">
                            <div
                                className="size-12 rounded-full bg-gray-200 dark:bg-gray-700 bg-cover bg-center border-2 border-primary/30"
                                style={{
                                    backgroundImage: user?.avatar_url
                                        ? `url('${user.avatar_url}')`
                                        : `url('https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=random')`
                                }}
                            />
                            <div className="flex-1 min-w-0">
                                <p className="font-bold truncate">{user?.name || 'Usuario'}</p>
                                <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark truncate">
                                    {user?.email}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Navigation Items */}
                    <nav className="flex-1 p-3">
                        <div className="space-y-1">
                            {drawerItems.map((item) => (
                                <button
                                    key={item.path}
                                    onClick={() => handleNavigation(item.path)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${isActive(item.path)
                                            ? 'bg-primary text-black font-bold'
                                            : 'text-text-primary-light dark:text-text-primary-dark hover:bg-black/5 dark:hover:bg-white/10'
                                        }`}
                                >
                                    <span className={`material-symbols-outlined ${isActive(item.path) ? 'fill' : ''}`}>
                                        {item.icon}
                                    </span>
                                    <span className="text-sm">{item.label}</span>
                                </button>
                            ))}
                        </div>
                    </nav>

                    {/* Footer */}
                    <div className="p-3 border-t border-border-light dark:border-border-dark mt-auto">
                        {/* Theme Switcher */}
                        <div className="flex items-center justify-between px-4 py-3 mb-2">
                            <span className="text-sm font-medium">Tema</span>
                            <ThemeSwitcher />
                        </div>

                        {/* Logout Button */}
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-500/10 transition-colors"
                        >
                            <span className="material-symbols-outlined">logout</span>
                            <span className="text-sm font-medium">Cerrar Sesión</span>
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};
