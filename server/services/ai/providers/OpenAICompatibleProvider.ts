import { IAIProvider, AIModel } from "../IAIProvider";
import axios from "axios";

export interface OpenAIConfig {
    apiKey?: string;
    baseUrl: string;
    modelsEndpoint?: string; // e.g. /models or /api/tags
    model: string;
}

export class OpenAICompatibleProvider implements IAIProvider {
    id: string;
    private config: OpenAIConfig;

    constructor(id: string, config: OpenAIConfig) {
        this.id = id;
        this.config = config;
    }

    async validateConfig(): Promise<boolean | string> {
        if (!this.config.baseUrl) return "URL Base no configurada";
        // Some providers like Ollama/LMStudio local might not need API Key
        return true;
    }

    async getModels(): Promise<AIModel[]> {
        if (!this.config.baseUrl) return [];
        // Default to /models if not specified
        const endpoint = this.config.modelsEndpoint || '/models';
        // Handle full URL possibility vs relative path
        const url = endpoint.startsWith('http') ? endpoint : `${this.config.baseUrl}${endpoint}`;

        try {
            const headers: any = {};
            if (this.config.apiKey) {
                headers['Authorization'] = `Bearer ${this.config.apiKey}`;
            }

            const response = await axios.get(url, { headers });
            const data = response.data;

            // Handle different array locations (Ollama uses .models, OpenAI uses .data)
            const list = data.data || data.models || [];

            if (Array.isArray(list)) {
                return list.map((m: any) => ({
                    id: m.id || m.name, // Ollama uses name
                    name: m.id || m.name
                })).sort((a, b) => a.id.localeCompare(b.id));
            }
            return [];
        } catch (error) {
            console.error(`Error fetching models for ${this.id}: `, error);
            // Return empty list instead of throwing to avoid breaking UI
            return [];
        }
    }

    async generateContent(prompt: string, modelName?: string): Promise<string> {
        const model = modelName || this.config.model;
        const url = `${this.config.baseUrl}/chat/completions`;

        try {
            const headers: any = {
                'Content-Type': 'application/json'
            };
            if (this.config.apiKey) {
                headers['Authorization'] = `Bearer ${this.config.apiKey}`;
            }

            // OpenAI Format
            const payload = {
                model: model,
                messages: [
                    { role: "user", content: prompt }
                ],
                temperature: 0.7
            };

            const response = await axios.post(url, payload, { headers });

            if (response.data && response.data.choices && response.data.choices.length > 0) {
                return response.data.choices[0].message.content;
            }

            throw new Error("Respuesta inesperada del proveedor AI");

        } catch (error: any) {
            console.error(`Error in OpenAICompatibleProvider(${this.id}): `, error.response?.data || error.message);

            if (error.response?.status === 401) throw new Error("API Key inválida o expirada");
            if (error.response?.status === 429) throw new Error("Límite de cuota excedido (429)");

            throw new Error(`Error en proveedor AI: ${error.message}`);
        }
    }

    async generateStream(prompt: string, modelName?: string): Promise<any> {
        const model = modelName || this.config.model;
        const url = `${this.config.baseUrl}/chat/completions`;

        const headers: any = {
            'Content-Type': 'application/json'
        };
        if (this.config.apiKey) {
            headers['Authorization'] = `Bearer ${this.config.apiKey}`;
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                model: model,
                messages: [{ role: "user", content: prompt }],
                stream: true
            })
        });

        if (!response.ok) {
            throw new Error(`Stream Error: ${response.status} ${response.statusText}`);
        }

        if (!response.body) {
            throw new Error('No response body for streaming');
        }

        // Parse SSE stream and yield text chunks in Gemini-compatible format
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const self = this;

        // Return an async generator that yields objects with .text() method (Gemini-compatible)
        async function* parseSSEStream() {
            let buffer = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep incomplete line in buffer

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed === 'data: [DONE]') continue;

                    if (trimmed.startsWith('data: ')) {
                        try {
                            const jsonStr = trimmed.slice(6); // Remove "data: " prefix
                            const parsed = JSON.parse(jsonStr);
                            const content = parsed.choices?.[0]?.delta?.content;

                            if (content) {
                                // Yield object with .text() method for Gemini compatibility
                                yield { text: () => content };
                            }
                        } catch (e) {
                            // Skip malformed JSON lines
                            console.warn('[OpenAICompatibleProvider] SSE parse error:', e);
                        }
                    }
                }
            }
        }

        return parseSSEStream();
    }
}
