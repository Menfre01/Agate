/**
 * Cryptographic utilities for API Key management.
 *
 * Uses Web Crypto API supported by Cloudflare Workers.
 *
 * @module utils/crypto
 */

/**
 * Computes the SHA-256 hash of an API Key.
 *
 * @param apiKey - The API key to hash
 * @returns Hex-encoded SHA-256 hash string
 *
 * @example
 * ```ts
 * const hash = await hashApiKey("sk_test_12345");
 * // Returns: "a1b2c3d4e5f6..."
 * ```
 */
export async function hashApiKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);

  // Convert buffer to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  return hashHex;
}

/**
 * Extracts a safe prefix from an API Key for display purposes.
 *
 * Shows first 10 characters + ellipsis to avoid exposing full keys.
 *
 * @param apiKey - The API key to extract prefix from
 * @returns Safe prefix string (e.g., "sk-abc12...")
 *
 * @example
 * ```ts
 * extractKeyPrefix("sk_live_abc123def456");
 * // Returns: "sk_live_a..."
 * ```
 */
export function extractKeyPrefix(apiKey: string): string {
  if (apiKey.length <= 10) {
    return `${apiKey}...`;
  }
  return `${apiKey.slice(0, 10)}...`;
}

/**
 * Generates a secure random API Key.
 *
 * Format: `sk_${timestamp}_${random}` where:
 * - `sk` prefix for "secret key"
 * - `timestamp` for basic traceability
 * - `random` 32 bytes (64 hex chars) for security
 *
 * @returns Newly generated API key
 *
 * @example
 * ```ts
 * const apiKey = generateApiKey();
 * // Returns: "sk_1678901234_abc123def456..."
 * ```
 */
export function generateApiKey(): string {
  const timestamp = Date.now();
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);

  const randomHex = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `sk_${timestamp}_${randomHex}`;
}
