import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { generateForFeature, type AIProvider } from "@/lib/ai/provider";
import { getFeatureConfig, isAIConfigured } from "@/lib/ai/config";
import { AIError, isRetryableProviderError } from "@/lib/ai/errors";
import type { GenerateTextInput, GenerateTextResult } from "@/lib/ai/types";

const ORIGINAL_ENV = { ...process.env };

function resetEnv() {
  process.env.OPENROUTER_API_KEY = "test-key";
  process.env.OPENROUTER_MODEL = "google/gemma-4-26b-a4b-it:free";
  process.env.OPENROUTER_FALLBACK_MODEL = "google/gemma-4-31b-it:free";
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  resetEnv();
});

class ScriptedProvider implements AIProvider {
  calls: GenerateTextInput[] = [];
  constructor(private readonly script: Array<() => GenerateTextResult>) {}

  async generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
    this.calls.push(input);
    const next = this.script.shift();
    if (!next) throw new Error("ScriptedProvider ran out of scripted responses");
    return next();
  }
}

describe("isRetryableProviderError", () => {
  test("classifies provider-level failures as retryable", () => {
    assert.equal(isRetryableProviderError("MODEL_UNAVAILABLE"), true);
    assert.equal(isRetryableProviderError("RATE_LIMITED"), true);
    assert.equal(isRetryableProviderError("PROVIDER_TIMEOUT"), true);
  });
  test("classifies application-level failures as non-retryable", () => {
    assert.equal(isRetryableProviderError("NOT_CONFIGURED"), false);
    assert.equal(isRetryableProviderError("INVALID_DATE_RANGE"), false);
    assert.equal(isRetryableProviderError("UNKNOWN"), false);
  });
});

describe("getFeatureConfig / isAIConfigured", () => {
  test("resolves stable, low-variance parameters for the standup feature", () => {
    const config = getFeatureConfig("standup");
    assert.equal(config.temperature, 0.2);
    assert.equal(config.topP, 0.9);
    assert.equal(config.maxTokens, 500);
    assert.equal(config.primaryModel, "google/gemma-4-26b-a4b-it:free");
    assert.equal(config.fallbackModel, "google/gemma-4-31b-it:free");
  });

  test("throws NOT_CONFIGURED when the API key is missing", () => {
    delete process.env.OPENROUTER_API_KEY;
    assert.throws(() => getFeatureConfig("standup"), (err: unknown) => {
      assert.ok(err instanceof AIError);
      assert.equal(err.code, "NOT_CONFIGURED");
      return true;
    });
    assert.equal(isAIConfigured("standup"), false);
  });

  test("never silently falls back to the auto-routed openrouter/free model", () => {
    process.env.OPENROUTER_MODEL = "openrouter/free";
    assert.throws(() => getFeatureConfig("standup"), (err: unknown) => {
      assert.ok(err instanceof AIError);
      assert.equal(err.code, "NOT_CONFIGURED");
      return true;
    });
  });
});

describe("generateForFeature (primary/fallback policy)", () => {
  test("uses the configured primary model first", async () => {
    const provider = new ScriptedProvider([() => ({ text: "ok", model: "primary-model" })]);
    const result = await generateForFeature(provider, {
      feature: "standup",
      systemPrompt: "sys",
      userPrompt: "usr",
    });
    assert.equal(result.usedFallback, false);
    assert.equal(result.text, "ok");
    assert.equal(provider.calls.length, 1);
    assert.equal(provider.calls[0].model, "google/gemma-4-26b-a4b-it:free");
  });

  test("does not call the fallback model when the primary succeeds", async () => {
    const provider = new ScriptedProvider([() => ({ text: "ok", model: "primary-model" })]);
    await generateForFeature(provider, { feature: "standup", systemPrompt: "s", userPrompt: "u" });
    assert.equal(provider.calls.length, 1);
  });

  test("calls the fallback model exactly once after a retryable primary failure", async () => {
    const provider = new ScriptedProvider([
      () => {
        throw new AIError("MODEL_UNAVAILABLE", "primary down");
      },
      () => ({ text: "fallback ok", model: "fallback-model" }),
    ]);
    const result = await generateForFeature(provider, {
      feature: "standup",
      systemPrompt: "s",
      userPrompt: "u",
    });
    assert.equal(result.usedFallback, true);
    assert.equal(result.text, "fallback ok");
    assert.equal(provider.calls.length, 2);
    assert.equal(provider.calls[1].model, "google/gemma-4-31b-it:free");
  });

  test("calls the fallback when primary text fails isAcceptable", async () => {
    const provider = new ScriptedProvider([
      () => ({ text: "We need to produce a standup...", model: "primary-model" }),
      () => ({
        text: "What I worked on:\n- Built X",
        model: "fallback-model",
      }),
    ]);
    const result = await generateForFeature(provider, {
      feature: "standup",
      systemPrompt: "s",
      userPrompt: "u",
      isAcceptable: (text) => text.startsWith("What I worked on:"),
    });
    assert.equal(result.usedFallback, true);
    assert.equal(provider.calls.length, 2);
    assert.match(result.text, /^What I worked on:/);
  });

  test("does not call the fallback for a non-retryable provider error", async () => {
    const provider = new ScriptedProvider([
      () => {
        throw new AIError("INVALID_PROVIDER_RESPONSE", "bad response");
      },
    ]);
    await assert.rejects(
      generateForFeature(provider, { feature: "standup", systemPrompt: "s", userPrompt: "u" })
    );
    assert.equal(provider.calls.length, 1);
  });

  test("does not call the provider at all for invalid application configuration", async () => {
    delete process.env.OPENROUTER_API_KEY;
    const provider = new ScriptedProvider([]);
    await assert.rejects(
      generateForFeature(provider, { feature: "standup", systemPrompt: "s", userPrompt: "u" }),
      (err: unknown) => {
        assert.ok(err instanceof AIError);
        assert.equal(err.code, "NOT_CONFIGURED");
        return true;
      }
    );
    assert.equal(provider.calls.length, 0);
  });

  test("supplies the same stable generation parameters to both attempts", async () => {
    const provider = new ScriptedProvider([
      () => {
        throw new AIError("RATE_LIMITED", "rate limited");
      },
      () => ({ text: "fallback ok", model: "fallback-model" }),
    ]);
    await generateForFeature(provider, { feature: "standup", systemPrompt: "s", userPrompt: "u" });
    const [primaryCall, fallbackCall] = provider.calls;
    assert.equal(primaryCall.temperature, fallbackCall.temperature);
    assert.equal(primaryCall.topP, fallbackCall.topP);
    assert.equal(primaryCall.maxTokens, fallbackCall.maxTokens);
  });

  test("propagates a single fallback failure without further retries", async () => {
    const provider = new ScriptedProvider([
      () => {
        throw new AIError("PROVIDER_TIMEOUT", "primary timed out");
      },
      () => {
        throw new AIError("MODEL_UNAVAILABLE", "fallback also down");
      },
    ]);
    await assert.rejects(
      generateForFeature(provider, { feature: "standup", systemPrompt: "s", userPrompt: "u" })
    );
    assert.equal(provider.calls.length, 2);
  });
});
