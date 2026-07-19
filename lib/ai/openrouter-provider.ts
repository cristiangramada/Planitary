import { AIError } from "./errors";
import type { AIProvider } from "./provider";
import type { GenerateTextInput, GenerateTextResult } from "./types";

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

interface OpenRouterChoice {
  message?: { content?: string | null };
}
interface OpenRouterResponse {
  choices?: OpenRouterChoice[];
  model?: string;
}

/**
 * Generic OpenRouter chat-completions provider. Contains no feature-specific
 * business logic — callers supply the exact model, prompts, and generation
 * parameters to use, resolved elsewhere (see `lib/ai/config.ts`).
 */
export class OpenRouterProvider implements AIProvider {
  constructor(private readonly apiKey: string) {}

  async generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
    if (!this.apiKey) {
      throw new AIError("NOT_CONFIGURED", "OpenRouter API key is missing.");
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), input.timeoutMs);

    let response: Response;
    try {
      response = await fetch(OPENROUTER_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          // Attribution headers recommended by OpenRouter; carry no user data.
          "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
          "X-Title": "Planitary",
        },
        body: JSON.stringify({
          model: input.model,
          temperature: input.temperature,
          top_p: input.topP,
          max_tokens: input.maxTokens,
          // Keep chain-of-thought models from dumping planning text into `content`.
          reasoning: { effort: "none", exclude: true },
          messages: [
            { role: "system", content: input.systemPrompt },
            { role: "user", content: input.userPrompt },
          ],
        }),
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new AIError("PROVIDER_TIMEOUT", "The AI provider took too long to respond.");
      }
      throw new AIError("UNKNOWN", "Failed to reach the AI provider.");
    } finally {
      clearTimeout(timer);
    }

    if (response.status === 401 || response.status === 403) {
      throw new AIError("NOT_CONFIGURED", "The AI provider rejected the configured API key.");
    }
    if (response.status === 429) {
      throw new AIError("RATE_LIMITED", "The AI provider is rate-limited.");
    }
    if (!response.ok) {
      // Log provider status + a short error snippet for local debugging.
      // Never includes the API key or full prompts.
      const errBody = await response.text().catch(() => "");
      console.error("[openrouter]", {
        status: response.status,
        model: input.model,
        body: errBody.slice(0, 300),
      });
      if (response.status === 404 || response.status === 400) {
        throw new AIError("MODEL_UNAVAILABLE", "The configured model is unavailable.");
      }
      throw new AIError("MODEL_UNAVAILABLE", `The AI provider returned status ${response.status}.`);
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch {
      throw new AIError("INVALID_PROVIDER_RESPONSE", "The AI provider returned an unreadable response.");
    }

    const data = json as OpenRouterResponse;
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new AIError("INVALID_PROVIDER_RESPONSE", "The AI provider returned an empty response.");
    }

    return {
      text: content.trim(),
      model: typeof data.model === "string" ? data.model : input.model,
    };
  }
}
