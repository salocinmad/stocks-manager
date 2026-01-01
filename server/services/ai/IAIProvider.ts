export interface AIModel {
    id: string;
    name: string;
}

export interface IAIProvider {
    /**
     * Unique identifier for the provider configuration (slug)
     */
    id: string;

    /**
     * Generates content based on the provided prompt string.
     * @param prompt The prompt to send to the AI.
     * @param modelName Optional model name override.
     * @returns A promise that resolves to the generated text.
     */
    generateContent(prompt: string, modelName?: string): Promise<string>;

    /**
     * Generates a streaming response.
     * @param prompt The prompt to send to the AI.
     * @param modelName Optional model name override.
     * @returns A promise that resolves to an async generator or readable stream.
     */
    generateStream(prompt: string, modelName?: string): Promise<any>;

    /**
     * Validates if the provider is correctly configured (e.g. has API key if required).
     */
    validateConfig(): Promise<boolean | string>;

    /**
     * Lists available models from the provider.
     */
    getModels(): Promise<AIModel[]>;
    /**
     * Generates content based on the provided prompt string.
     * @param prompt The prompt to send to the AI.
     * @param modelName Optional model name override.
     * @returns A promise that resolves to the generated text.
     */
    generateContent(prompt: string, modelName?: string): Promise<string>;

    /**
     * Generates a streaming response.
     * @param prompt The prompt to send to the AI.
     * @param modelName Optional model name override.
     * @returns A promise that resolves to an async generator or readable stream.
     */
    generateStream(prompt: string, modelName?: string): Promise<any>;

    /**
     * Validates if the provider is correctly configured (e.g. has API key if required).
     */
    validateConfig(): Promise<boolean | string>;
}
