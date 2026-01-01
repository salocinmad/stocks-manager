import { GoogleGenerativeAI } from "@google/generative-ai";
import { IAIProvider, AIModel } from "../IAIProvider";

export interface GeminiConfig {
    apiKey: string;
    model: string;
}

export class GeminiProvider implements IAIProvider {
    id: string;
    private config: GeminiConfig;
    private client: GoogleGenerativeAI | null = null;
    private model: any = null;

    constructor(id: string, config: GeminiConfig) {
        this.id = id;
        this.config = config;
    }

    private getClient() {
        if (!this.client && this.config.apiKey) {
            this.client = new GoogleGenerativeAI(this.config.apiKey);
            this.model = this.client.getGenerativeModel({ model: this.config.model });
        }
        return this.model;
    }

    async validateConfig(): Promise<boolean | string> {
        if (!this.config.apiKey) return "API Key de Google no configurada";
        return true;
    }

    async getModels(): Promise<AIModel[]> {
        if (!this.config.apiKey) return [];

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${this.config.apiKey}`);
            if (!response.ok) {
                console.warn('[GeminiProvider] Error fetching models:', response.statusText);
                return [];
            }
            const data = await response.json();
            const models = (data.models || [])
                .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
                .map((m: any) => ({
                    id: m.name.replace('models/', ''),
                    name: `${m.displayName} (${m.version})`
                }))
                .sort((a: any, b: any) => b.id.localeCompare(a.id));

            return models;
        } catch (e) {
            console.error('[GeminiProvider] Error fetching models:', e);
            return [];
        }
    }

    async generateContent(prompt: string, modelName?: string): Promise<string> {
        const model = this.getClient();
        if (!model) throw new Error("Cliente Gemini no inicializado (Falta API Key)");

        // Allow model override if supported/re-instantiation needed (simplified for now)
        // For Gemini, changing model means getting a new GenerativeModel instance.
        let targetModel = model;
        if (modelName && modelName !== this.config.model) {
            const tempClient = new GoogleGenerativeAI(this.config.apiKey);
            targetModel = tempClient.getGenerativeModel({ model: modelName });
        }

        try {
            const result = await targetModel.generateContent(prompt);
            return result.response.text();
        } catch (error: any) {
            this.handleError(error);
            return ""; // Unreachable
        }
    }

    async generateStream(prompt: string, modelName?: string): Promise<any> {
        const model = this.getClient();
        if (!model) throw new Error("Cliente Gemini no inicializado");

        let targetModel = model;
        if (modelName && modelName !== this.config.model) {
            const tempClient = new GoogleGenerativeAI(this.config.apiKey);
            targetModel = tempClient.getGenerativeModel({ model: modelName });
        }

        try {
            const result = await targetModel.generateContentStream(prompt);
            return result.stream;
        } catch (error: any) {
            this.handleError(error);
        }
    }

    private handleError(error: any) {
        // Shared error handling logic adapted from aiService.ts
        console.error(`Error in GeminiProvider (${this.id}):`, error);
        const msg = error.message || JSON.stringify(error);

        if (msg.includes('API key') || msg.includes('expired') || msg.includes('400')) {
            throw new Error("API Key inválida o expirada");
        }
        if (msg.includes('429') || msg.includes('Quota') || msg.includes('exhausted')) {
            throw new Error("Límite de cuota excedido (429)");
        }
        throw new Error(`Error Gemini: ${error.message}`);
    }
}
