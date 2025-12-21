import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

type Theme = 'light' | 'dark' | 'midnight';

export const ThemeSwitcher: React.FC = () => {
    const { t } = useTranslation();
    const [theme, setTheme] = useState<Theme>(
        (localStorage.getItem('theme') as Theme) || 'dark'
    );

    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark', 'midnight');
        root.classList.add(theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    return (
        <div className="flex bg-gray-100 dark:bg-white/5 p-1 rounded-full border border-gray-200 dark:border-white/10">
            {(['light', 'dark', 'midnight'] as Theme[]).map((tMode) => (
                <button
                    key={tMode}
                    onClick={() => setTheme(tMode)}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${theme === tMode
                            ? 'bg-primary text-black shadow-sm'
                            : 'text-gray-500 dark:text-gray-400 hover:text-primary'
                        }`}
                >
                    {tMode === 'light' ? '☀️' : tMode === 'dark' ? '🌑' : '🌌'}
                </button>
            ))}
        </div>
    );
};
