import type { Config } from 'tailwindcss';

const config: Config = {
    darkMode: 'class',
    content: [
        './index.html',
        './src/**/*.{js,ts,jsx,tsx}',
    ],
    theme: {
        extend: {
            colors: {
                // Colores primarios
                'primary': '#fce903',
                'primary-dim': '#b5a805',

                // Fondos
                'background-light': '#f8f8f5',
                'background-dark': '#0f172a',

                // Superficies (tarjetas, modals, etc.)
                'surface-light': '#ffffff',
                'surface-dark': '#1e293b',
                'surface-dark-elevated': '#334155',

                // Bordes
                'border-light': '#e6e6db',
                'border-dark': '#334155',

                // Texto
                'text-primary-light': '#181811',
                'text-primary-dark': '#f1f5f9',
                'text-secondary-light': '#8c8b5f',
                'text-secondary-dark': '#94a3b8',

                // Acentos
                'accent-blue': '#3b82f6',
                'accent-green': '#22c55e',
                'accent-red': '#ef4444',
                'accent-orange': '#f97316',
                'accent-purple': '#a855f7',
            },
            fontFamily: {
                'display': ['Spline Sans', 'sans-serif'],
                'body': ['Noto Sans', 'sans-serif'],
            },
            borderRadius: {
                'DEFAULT': '1rem',
                'lg': '2rem',
                'xl': '3rem',
                'full': '9999px',
            },
            boxShadow: {
                'card': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                'card-hover': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            },
        },
    },
    plugins: [],
};

export default config;
