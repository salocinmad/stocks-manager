import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

i18n
    .use(initReactI18next)
    .init({
        resources: {
            es: {
                translation: {
                    "common": {
                        "loading": "Cargando...",
                        "error": "Error",
                        "save": "Guardar",
                        "cancel": "Cancelar",
                        "logout": "Cerrar Sesión"
                    },
                    "menu": {
                        "dashboard": "Dashboard",
                        "portfolio": "Mi Portafolio",
                        "market": "Mercado",
                        "manual": "Registro Manual",
                        "risk": "Análisis de Riesgo",
                        "news": "Noticias",
                        "reports": "Informes AEAT",
                        "profile": "Perfil",
                        "alerts": "Alertas",
                        "watchlists": "Watchlist"
                    },
                    "dashboard": {
                        "net_worth": "Patrimonio Neto",
                        "todays_gain": "Variación Diaria",
                        "total_return": "Rentabilidad Total",
                        "ai_analysis": "Análisis Estratégico IA"
                    },
                    "auth": {
                        "login_title": "Iniciar Sesión",
                        "register_title": "Crear Cuenta",
                        "email_placeholder": "correo@ejemplo.com",
                        "password_placeholder": "Contraseña",
                        "submit_login": "Entrar",
                        "submit_register": "Registrarse",
                        "no_account": "¿No tienes cuenta?",
                        "have_account": "¿Ya tienes cuenta?"
                    }
                }
            }
        },
        lng: "es",
        fallbackLng: "es",
        interpolation: {
            escapeValue: false
        }
    });

export default i18n;
