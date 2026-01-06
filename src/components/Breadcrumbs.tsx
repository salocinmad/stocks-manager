import React from 'react';
import { useLocation, Link } from 'react-router-dom';

const routeNameMap: Record<string, string> = {
    '': 'Dashboard',
    'portfolio': 'Portafolio',
    'market': 'Mercado',
    'manual-entry': 'Nueva Operación',
    'risk-vis': 'Riesgo',
    'news': 'Noticias',
    'reports': 'Reportes',
    'profile': 'Perfil',
    'watchlists': 'Listas',
    'alerts': 'Alertas',
    'admin': 'Admin',
    'importers': 'Importadores',
    'notifications': 'Canales',
    'calendar': 'Calendario',
    'reset-password': 'Recuperar',
    'login': 'Login',
    'register': 'Registro'
};

export const Breadcrumbs: React.FC = () => {
    const location = useLocation();
    const pathnames = location.pathname.split('/').filter(x => x);

    // Don't show on dashboard root if you want clean look, or show "Inicio"
    if (pathnames.length === 0) return null;

    return (
        <nav aria-label="breadcrumb" className="hidden md:flex items-center text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark mb-1">
            <Link to="/" className="hover:text-primary transition-colors flex items-center">
                <span className="material-symbols-outlined text-sm mr-1">home</span>
                Inicio
            </Link>
            {pathnames.map((value, index) => {
                const to = `/${pathnames.slice(0, index + 1).join('/')}`;
                const isLast = index === pathnames.length - 1;
                const name = routeNameMap[value] || value; // Fallback to raw path ID if not mapped

                // Capitalize if raw
                const displayName = routeNameMap[value] ? name : name.charAt(0).toUpperCase() + name.slice(1);

                return (
                    <React.Fragment key={to}>
                        <span className="mx-2 opacity-50">/</span>
                        {isLast ? (
                            <span className="text-text-primary-light dark:text-text-primary-dark font-bold">
                                {displayName}
                            </span>
                        ) : (
                            <Link to={to} className="hover:text-primary transition-colors">
                                {displayName}
                            </Link>
                        )}
                    </React.Fragment>
                );
            })}
        </nav>
    );
};
