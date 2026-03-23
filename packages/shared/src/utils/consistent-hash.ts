/**
 * Consistent Hash utility for load balancing.
 *
 * Provides deterministic selection from a set of nodes based on a key.
 * Used for two-layer load balancing:
 * 1. Provider-level: select provider based on api_key_id + model_id
 * 2. Credential-level: select credential based on api_key_id
 *
 * Nodes with unhealthy status are automatically skipped.
 *
 * @module utils/consistent-hash
 */

/**
 * Health status check for nodes.
 */
export interface HealthCheck {
  health_status?: "healthy" | "unhealthy" | "unknown";
  is_active?: boolean;
}

/**
 * Options for consistent hash selection.
 */
export interface ConsistentHashOptions {
  /** Maximum number of retries when encountering unhealthy nodes */
  maxRetries?: number;
  /** Whether to filter out unhealthy nodes */
  filterUnhealthy?: boolean;
}

/**
 * Default options for consistent hashing.
 */
const DEFAULT_OPTIONS: ConsistentHashOptions = {
  maxRetries: 10,
  filterUnhealthy: true,
};

/**
 * Selects a node using consistent hashing.
 *
 * The same key will always select the same node (assuming the node set is stable).
 * Uses SHA-256 hash for even distribution.
 *
 * @param nodes - Array of nodes to select from
 * @param key - Key for consistent hashing (e.g., api_key_id or api_key_id + model_id)
 * @param options - Selection options
 * @returns Selected node
 * @throws {Error} If no healthy nodes available
 *
 * @example
 * ```ts
 * const providers = [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }];
 * const selected = consistentHashSelect(providers, 'api-key-123');
 * ```
 */
export function consistentHashSelect<T extends HealthCheck>(
  nodes: ReadonlyArray<T>,
  key: string,
  options: ConsistentHashOptions = {}
): T {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Filter out unhealthy nodes if enabled
  let availableNodes = opts.filterUnhealthy
    ? nodes.filter(
        (n) => n.is_active !== false && n.health_status !== "unhealthy"
      )
    : [...nodes];

  if (availableNodes.length === 0) {
    throw new Error("No healthy nodes available for selection");
  }

  // Calculate hash of the key
  const keyHash = hashString(key);

  // Use modulo to select initial index
  const maxRetries = opts.maxRetries ?? DEFAULT_OPTIONS.maxRetries!;
  let index = Number(keyHash % BigInt(availableNodes.length));
  let retries = 0;

  // If filtering is enabled and we encounter an unhealthy node, try next
  while (
    opts.filterUnhealthy &&
    retries < maxRetries &&
    availableNodes[index].health_status === "unhealthy"
  ) {
    index = (index + 1) % availableNodes.length;
    retries++;
  }

  return availableNodes[index];
}

/**
 * Hashes a string using a simple but effective algorithm.
 *
 * Uses FNV-1a inspired algorithm for good distribution.
 *
 * @param str - String to hash
 * @returns Hash value as BigInt
 */
export function hashString(str: string): bigint {
  let hash = 2166136261n; // FNV offset basis

  for (let i = 0; i < str.length; i++) {
    hash ^= BigInt(str.charCodeAt(i));
    hash *= 16777619n; // FNV prime
    hash &= 0xffffffffn; // Keep within 32 bits
  }

  return hash;
}

/**
 * Computes a combined hash for multiple values.
 *
 * @param values - Values to combine and hash
 * @returns Combined hash value as BigInt
 */
export function hashValues(...values: Array<string | number>): bigint {
  const combined = values.join(":");
  return hashString(combined);
}
