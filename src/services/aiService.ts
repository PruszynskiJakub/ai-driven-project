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

export async function generateContent(request: AIGenerationRequest): Promise<AIGenerationResponse> {
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
}

export async function generateArtifactContent(
  storyContent: string,
  artifactType: string,
  feedback?: string
): Promise<string> {
  const messages: AIMessage[] = [
    {
      role: 'system',
      content: `You are a content creation assistant. Generate high-quality ${artifactType} content based on the provided story context.${feedback ? ' Take into account the user feedback to improve the content.' : ''}`
    },
    {
      role: 'user',
      content: `Story context: ${storyContent}${feedback ? `\n\nUser feedback: ${feedback}` : ''}\n\nPlease create engaging ${artifactType} content based on this story.`
    }
  ];

  const response = await generateContent({ messages });
  return response.content;
}

export async function generateStoryFromSpark(sparkContent: string): Promise<string> {
  const messages: AIMessage[] = [
    {
      role: 'system',
      content: 'You are a creative writing assistant. Transform the provided spark into a detailed, engaging story with rich context, character development, and narrative depth.'
    },
    {
      role: 'user',
      content: `Spark: ${sparkContent}\n\nPlease develop this spark into a comprehensive story with backstory, motivation, and detailed context.`
    }
  ];

  const response = await generateContent({ messages });
  return response.content;
}