/**
 * ID generation utilities.
 *
 * Uses Web Crypto API for UUID v4 generation supported by Cloudflare Workers.
 *
 * @module utils/id-generator
 */

/**
 * Generates a unique identifier using UUID v4.
 *
 * Uses the native Web Crypto API which is available in Cloudflare Workers.
 *
 * @returns A UUID v4 string
 *
 * @example
 * ```ts
 * const id = generateId();
 * // Returns: "550e8400-e29b-41d4-a716-446655440000"
 * ```
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Extracts timestamp from a UUID v7 or similar time-based ID.
 *
 * Note: This returns null for UUID v4 (random) as it has no embedded timestamp.
 * For UUID v7, the timestamp is the first 48 bits.
 *
 * @param id - The UUID string to parse
 * @returns Unix timestamp in milliseconds, or null if not time-based
 *
 * @example
 * ```ts
 * // For UUID v7 (time-ordered)
 * extractTimestamp("017f22e2-79b0-7cc3-98c4-dc0c0c07398f");
 * // Returns: 1698765432000 (approximate)
 *
 * // For UUID v4 (random)
 * extractTimestamp("550e8400-e29b-41d4-a716-446655440000");
 * // Returns: null
 * ```
 */
export function extractTimestamp(id: string): number | null {
  // Validate UUID format
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return null;
  }

  // Remove hyphens
  const hex = id.replace(/-/g, "");

  // Check version (character at position 14, which is hex[12] after removing hyphens)
  // For UUID v7, this character should be '7'
  const versionChar = hex[12];
  if (!versionChar) return null;

  // UUID v7 has version nibble 0b0111 = 7
  if (versionChar === "7") {
    // UUID v7: first 48 bits are timestamp (milliseconds since Unix epoch)
    const timestampHex = hex.slice(0, 12);
    return Number.parseInt(timestampHex, 16);
  }

  // UUID v1/v2 also have timestamps but require different parsing
  // For simplicity, we only support v7 here
  return null;
}

/**
 * Checks if an ID is a valid UUID.
 *
 * @param id - The string to validate
 * @returns true if the string is a valid UUID format
 *
 * @example
 * ```ts
 * isValidId("550e8400-e29b-41d4-a716-446655440000"); // true
 * isValidId("not-a-uuid"); // false
 * ```
 */
export function isValidId(id: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}
