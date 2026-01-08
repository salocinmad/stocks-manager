import sql from '../../db';
import { IAIProvider } from './IAIProvider';
import { GeminiProvider } from './providers/GeminiProvider';
import { OpenAICompatibleProvider } from './providers/OpenAICompatibleProvider';
import { SettingsService } from '../settingsService';

export class AIProviderFactory {

    /**
     * Obtiene la instancia del proveedor activo configurado.
     */
    static async getActiveProvider(): Promise<IAIProvider> {
        // 1. Get Active Provider Slug
        const activeProviderSlug = await SettingsService.get('AI_PROVIDER') || 'gemini'; // Default to gemini

        // 2. Get Provider Details from DB
        const [providerConfig] = await sql`
            SELECT * FROM ai_providers WHERE slug = ${activeProviderSlug} LIMIT 1
        `;

        // Fallback if not found (e.g. initial setup)
        if (!providerConfig) {
            // Fallback to Gemini System Default if missing
            return this.createGeminiProvider('gemini');
        }

        // 3. Get API Key if required
        let apiKey = '';
        if (providerConfig.requires_api_key && providerConfig.api_key_config_key) {
            apiKey = await SettingsService.get(providerConfig.api_key_config_key);
        }

        // 4. Instantiate
        if (providerConfig.type === 'google') {
            const aiModel = await SettingsService.get('AI_MODEL') || 'gemini-1.5-flash';
            return new GeminiProvider(providerConfig.slug, {
                apiKey,
                model: aiModel
            });
        } else {
            // OpenAI Compatible (OpenRouter, Groq, Custom, Ollama, etc.)
            // Note: For OpenAI providers, we might need to store the specific model selected 
            // separately or use a generic 'AI_MODEL' setting that applies to the active provider.
            // For now, we assume 'AI_MODEL' holds the model ID for the active provider.
            const aiModel = await SettingsService.get('AI_MODEL') || 'default';

            return new OpenAICompatibleProvider(providerConfig.slug, {
                apiKey,
                baseUrl: providerConfig.base_url,
                modelsEndpoint: providerConfig.models_endpoint,
                model: aiModel
            });
        }
    }

    private static async createGeminiProvider(slug: string): Promise<IAIProvider> {
        const apiKey = await SettingsService.get('GOOGLE_GENAI_API_KEY');
        const aiModel = await SettingsService.get('AI_MODEL') || 'gemini-1.5-flash';
        return new GeminiProvider(slug, { apiKey, model: aiModel });
    }

    /**
     * Obtiene una lista de modelos disponibles para el proveedor activo.
     * Esta funcionalidad puede moverse aquí o mantenerse en el servicio.
     */
}
