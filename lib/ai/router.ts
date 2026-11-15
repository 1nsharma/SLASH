import { getGeminiClient } from '../gemini';

export type AiProviderKind = 'auto' | 'gemini' | 'ollama' | 'deterministic';

export interface AiRouterPublicStatus {
  activeDefault: Exclude<AiProviderKind, 'auto'>;
  providers: {
    gemini: boolean;
    ollama: boolean;
    openai: boolean;
    anthropic: boolean;
  };
  ollamaModel: string;
}

export function getAiRouterStatus(): AiRouterPublicStatus {
  const gemini = Boolean(process.env.GEMINI_API_KEY?.trim());
  const ollama = Boolean(process.env.OLLAMA_BASE_URL?.trim());
  const openai = Boolean(process.env.OPENAI_API_KEY?.trim());
  const anthropic = Boolean(process.env.ANTHROPIC_API_KEY?.trim());

  const explicit = process.env.AI_PROVIDER?.trim().toLowerCase();
  let activeDefault: Exclude<AiProviderKind, 'auto'> = 'deterministic';
  if (explicit === 'ollama' && ollama) {
    activeDefault = 'ollama';
  } else if (gemini) {
    activeDefault = 'gemini';
  } else if (ollama) {
    activeDefault = 'ollama';
  }

  return {
    activeDefault,
    providers: {
      gemini,
      ollama,
      openai,
      anthropic,
    },
    ollamaModel: process.env.OLLAMA_MODEL?.trim() || 'llama3.1:8b',
  };
}

export async function routeAiTextGeneration(params: {
  prompt: string;
  systemInstruction: string;
  preferredProvider?: AiProviderKind;
}): Promise<{ text: string; providerUsed: Exclude<AiProviderKind, 'auto'> }> {
  const status = getAiRouterStatus();
  const choice =
    params.preferredProvider && params.preferredProvider !== 'auto'
      ? params.preferredProvider
      : status.activeDefault;

  if (choice === 'ollama' && status.providers.ollama) {
    const baseUrl = process.env.OLLAMA_BASE_URL!.trim().replace(/\/+$/, '');
    const res = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: status.ollamaModel,
        system: params.systemInstruction,
        prompt: params.prompt,
        stream: false,
      }),
    });
    if (res.ok) {
      const json = (await res.json()) as { response?: string };
      if (json.response?.trim()) {
        return { text: json.response.trim(), providerUsed: 'ollama' };
      }
    }
  }

  if (
    (choice === 'gemini' || choice === 'ollama') &&
    status.providers.gemini
  ) {
    const ai = getGeminiClient();
    const res = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: params.prompt,
      config: {
        systemInstruction: params.systemInstruction,
      },
    });
    if (res.text?.trim()) {
      return { text: res.text.trim(), providerUsed: 'gemini' };
    }
  }

  return { text: '', providerUsed: 'deterministic' };
}
