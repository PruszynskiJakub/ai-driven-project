import Replicate from "replicate";

export interface AIMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface AIGenerationRequest {
    model?: string;
    messages: AIMessage[];
    temperature?: number;
    maxTokens?: number;
}

export interface AIGenerationResponse {
    content: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

export class AIServiceError extends Error {
    constructor(message: string, public statusCode?: number) {
        super(message);
        this.name = 'AIServiceError';
    }
}

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-4o';

export const aiService = {
    completion: async (request: AIGenerationRequest): Promise<AIGenerationResponse> => {
        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
            throw new AIServiceError('OPENROUTER_API_KEY environment variable is not set');
        }

        const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
        const siteName = process.env.SITE_NAME || 'AI Content Platform';

        try {
            const response = await fetch(OPENROUTER_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'HTTP-Referer': siteUrl,
                    'X-Title': siteName,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: request.model || DEFAULT_MODEL,
                    messages: request.messages,
                    temperature: request.temperature || 0.7,
                    max_tokens: request.maxTokens || 2000,
                }),
            });

            if (!response.ok) {
                const errorData = await response.text();
                throw new AIServiceError(
                    `OpenRouter API error: ${response.status} ${response.statusText} - ${errorData}`,
                    response.status
                );
            }

            const data = await response.json();

            if (!data.choices || !data.choices[0] || !data.choices[0].message) {
                throw new AIServiceError('Invalid response format from OpenRouter API');
            }

            return {
                content: data.choices[0].message.content,
                usage: data.usage ? {
                    promptTokens: data.usage.prompt_tokens,
                    completionTokens: data.usage.completion_tokens,
                    totalTokens: data.usage.total_tokens,
                } : undefined,
            };
        } catch (error) {
            if (error instanceof AIServiceError) {
                throw error;
            }
            throw new AIServiceError(`AI service request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    },
    image: async (prompt: string): Promise<string> => {
        const apiToken = process.env.REPLICATE_API_TOKEN;
        if (!apiToken) {
            throw new AIServiceError('REPLICATE_API_TOKEN environment variable is not set');
        }

        try {
            const replicate = new Replicate({ auth: apiToken });
            const model = "black-forest-labs/flux-schnell";

            const output = await replicate.run(model, {
                input: { prompt }
            }) as string[];

            if (!output || !output[0]) {
                throw new AIServiceError('No image output received from Replicate');
            }

            // Download the image and convert to base64
            const imageUrl = output[0];
            const imageResponse = await fetch(imageUrl);

            if (!imageResponse.ok) {
                throw new AIServiceError('Failed to download generated image');
            }

            const imageBuffer = await imageResponse.arrayBuffer();
            const base64Image = Buffer.from(imageBuffer).toString('base64');

            return base64Image;
        } catch (error) {
            if (error instanceof AIServiceError) {
                throw error;
            }
            throw new AIServiceError(`Image generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    },
    moderation: async (prompt: string): Promise<boolean> => {
        return true
    }
}