import sql from '../db';
import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
// Usar JWT_SECRET como clave maestra (recortada o padding a 32 bytes)
const SECRET_KEY = crypto.createHash('sha256').update(String(process.env.JWT_SECRET || 'fallback_secret')).digest();
const IV_LENGTH = 16;

export const SettingsService = {
    // Encriptar valor
    encrypt: (text: string): string => {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(SECRET_KEY), iv);
        let encrypted = cipher.update(text);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return iv.toString('hex') + ':' + encrypted.toString('hex');
    },

    // Desencriptar valor
    decrypt: (text: string): string => {
        try {
            const textParts = text.split(':');
            const iv = Buffer.from(textParts.shift()!, 'hex');
            const encryptedText = Buffer.from(textParts.join(':'), 'hex');
            const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(SECRET_KEY), iv);
            let decrypted = decipher.update(encryptedText);
            decrypted = Buffer.concat([decrypted, decipher.final()]);
            return decrypted.toString();
        } catch (error) {
            console.error('Error decrypting value:', error);
            return ''; // Retornar vacío si falla (ej: clave cambió)
        }
    },

    // Obtener valor (desencripta si es necesario)
    get: async (key: string): Promise<string | null> => {
        // Primero intentar memoria/env para fallback (opcional, pero mantenemos prioridad DB)
        const result = await sql`
            SELECT value, is_encrypted 
            FROM system_settings 
            WHERE key = ${key}
        `;

        if (result.length === 0) {
            // Fallback a variable de entorno si no está en DB (retrocompatibilidad)
            return process.env[key] || null;
        }

        const { value, is_encrypted } = result[0];
        if (is_encrypted) {
            return SettingsService.decrypt(value);
        }
        return value;
    },

    // Guardar valor
    set: async (key: string, value: string, encrypt = false) => {
        let storedValue = value;
        if (encrypt && value) {
            storedValue = SettingsService.encrypt(value);
        }

        await sql`
            INSERT INTO system_settings (key, value, is_encrypted, updated_at)
            VALUES (${key}, ${storedValue}, ${encrypt}, NOW())
            ON CONFLICT (key) 
            DO UPDATE SET 
                value = EXCLUDED.value,
                is_encrypted = EXCLUDED.is_encrypted,
                updated_at = NOW()
        `;

        // Actualizar process.env para que libs síncronas sigan funcionando si es necesario
        // (Aunque lo ideal es que todos migren a usar SettingsService.get)
        // OJO: process.env no debería tener el valor desencriptado de cosas MUY sensibles si no es necesario
        if (!encrypt) {
            process.env[key] = value;
        }
    },

    // Obtener configuración SMTP completa
    getSmtpConfig: async () => {
        const host = await SettingsService.get('SMTP_HOST');
        const port = await SettingsService.get('SMTP_PORT');
        const user = await SettingsService.get('SMTP_USER');
        const password = await SettingsService.get('SMTP_PASSWORD');
        const from = await SettingsService.get('SMTP_FROM');

        return {
            host: host || '',
            port: port || '587',
            user: user || '',
            password: password || '',
            from: from || ''
        };
    },

    // Obtener API Keys
    getApiKeys: async () => {
        return {
            finnhub: await SettingsService.get('FINNHUB_API_KEY') || '',
            google: await SettingsService.get('GOOGLE_GENAI_API_KEY') || '',
            fmp: await SettingsService.get('FMP_API_KEY') || '',
            eodhd: await SettingsService.get('EODHD_API_KEY') || '',
            globalExchanges: await SettingsService.get('GLOBAL_TICKER_EXCHANGES') || ''
        };
    },

    // Cargar todo a process.env (Boot Loader)
    loadToEnv: async () => {
        try {

            const settings = await sql`SELECT key, value, is_encrypted FROM system_settings`;

            for (const s of settings) {
                let val = s.value;
                if (s.is_encrypted) {
                    val = SettingsService.decrypt(s.value);
                }

                // Solo cargar si tiene valor
                if (val) {
                    process.env[s.key] = val;
                }
            }

        } catch (error) {
            console.error('Error loading settings to env:', error);
            // No lanzar throw para no detener el arranque si la tabla está vacía
        }
    }
};
