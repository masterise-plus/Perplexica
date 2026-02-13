/**
 * Global round-robin API key rotator with per-key cooldown tracking.
 *
 * Uses a static registry so all OpenAILLM instances sharing the same
 * base URL rotate through the same key pool together — spreading load
 * across keys even when multiple LLM calls happen in a single request.
 */
class KeyRotator {
  /** Global registry: baseURL → shared KeyRotator instance */
  private static instances: Map<string, KeyRotator> = new Map();

  private keys: string[];
  private currentIndex: number = 0;
  /** Timestamp (ms) until which each key is on cooldown */
  private cooldownUntil: Map<string, number> = new Map();

  private constructor(apiKeyString: string) {
    this.keys = apiKeyString
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    if (this.keys.length === 0) {
      throw new Error('At least one API key must be provided');
    }
  }

  /**
   * Get or create a shared KeyRotator for the given baseURL.
   * All LLM instances pointing to the same endpoint share one rotator.
   */
  static getInstance(baseURL: string, apiKeyString: string): KeyRotator {
    const existing = KeyRotator.instances.get(baseURL);

    // Reuse if the key set hasn't changed
    if (existing) {
      const newKeys = apiKeyString
        .split(',')
        .map((k) => k.trim())
        .filter((k) => k.length > 0)
        .sort()
        .join(',');
      const oldKeys = [...existing.keys].sort().join(',');

      if (newKeys === oldKeys) {
        return existing;
      }
    }

    const instance = new KeyRotator(apiKeyString);
    KeyRotator.instances.set(baseURL, instance);
    return instance;
  }

  /**
   * Returns the next available API key, skipping keys that are on cooldown.
   * If ALL keys are on cooldown, returns the one whose cooldown expires soonest.
   */
  getNextKey(): string {
    const now = Date.now();
    const startIndex = this.currentIndex;

    // Try to find a key that is NOT on cooldown
    for (let i = 0; i < this.keys.length; i++) {
      const idx = (startIndex + i) % this.keys.length;
      const key = this.keys[idx];
      const cooldown = this.cooldownUntil.get(key) || 0;

      if (now >= cooldown) {
        this.currentIndex = (idx + 1) % this.keys.length;
        return key;
      }
    }

    // All keys are on cooldown — pick the one that expires soonest
    let bestKey = this.keys[startIndex];
    let bestTime = this.cooldownUntil.get(bestKey) || 0;

    for (const key of this.keys) {
      const cd = this.cooldownUntil.get(key) || 0;
      if (cd < bestTime) {
        bestTime = cd;
        bestKey = key;
      }
    }

    this.currentIndex =
      (this.keys.indexOf(bestKey) + 1) % this.keys.length;
    return bestKey;
  }

  /**
   * Mark a key as rate-limited for `durationMs` milliseconds.
   */
  markRateLimited(apiKey: string, durationMs: number): void {
    this.cooldownUntil.set(apiKey, Date.now() + durationMs);
    console.warn(
      `[KeyRotator] Key ${apiKey.slice(0, 8)}...${apiKey.slice(-4)} on cooldown for ${Math.round(durationMs / 1000)}s`,
    );
  }

  /**
   * Returns how long (ms) we need to wait for the given key's cooldown.
   * Returns 0 if the key is not on cooldown.
   */
  getCooldownRemaining(apiKey: string): number {
    const until = this.cooldownUntil.get(apiKey) || 0;
    return Math.max(0, until - Date.now());
  }

  /**
   * Returns the total number of keys available.
   */
  get totalKeys(): number {
    return this.keys.length;
  }
}

export default KeyRotator;
