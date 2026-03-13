/**
 * Provider Service for AI provider management.
 *
 * Handles provider CRUD operations, credential management,
 * and load balancing for multi-credential scenarios.
 *
 * @module services/provider
 */

import type {
  Provider,
  ProviderCredential,
  CreateProviderDto,
  UpdateProviderDto,
  AddProviderCredentialDto,
  ProviderResponse,
  ProviderCredentialResponse,
  Env,
} from "@/types/index.js";
import * as queries from "@/db/queries.js";
import { generateId } from "@/utils/id-generator.js";
import { NotFoundError, ValidationError } from "@/utils/errors/index.js";

/**
 * Selected provider and credential for proxying.
 */
export interface SelectedCredential {
  /** Provider ID */
  providerId: string;
  /** Provider name */
  providerName: string;
  /** Provider base URL */
  baseUrl: string;
  /** Provider API version */
  apiVersion: string | null;
  /** Credential ID */
  credentialId: string;
  /** Decrypted API key for upstream request */
  apiKey: string;
}

/**
 * Provider Service class.
 *
 * @example
 * ```ts
 * const provider = new ProviderService(env);
 *
 * // Create a new provider
 * const response = await provider.createProvider({
 *   name: "anthropic",
 *   display_name: "Anthropic",
 *   base_url: "https://api.anthropic.com",
 * });
 *
 * // Select credential for request
 * const credential = await provider.selectCredential("model-123", "api-key-456");
 * ```
 */
export class ProviderService {
  private readonly db: D1Database;
  private readonly encryptionKey: string;

  /**
   * Creates a new ProviderService instance.
   *
   * @param env - Cloudflare Workers environment
   */
  constructor(env: Env) {
    this.db = env.DB;
    this.encryptionKey = env.ENCRYPTION_KEY ?? "default-key";
  }

  /**
   * Lists all providers.
   *
   * @returns Array of provider responses
   */
  async listProviders(): Promise<ProviderResponse[]> {
    const providers = await queries.listProviders(this.db);

    // Count credentials for each provider
    const results = await Promise.all(
      providers.map(async (provider) => {
        const credentials = await queries.listProviderCredentials(
          this.db,
          provider.id
        );
        const activeCount = credentials.filter((c) => c.is_active).length;

        return this.toResponse(provider, activeCount);
      })
    );

    return results;
  }

  /**
   * Gets a provider by ID.
   *
   * @param id - Provider ID
   * @returns Provider response
   * @throws {NotFoundError} If provider not found
   */
  async getProvider(id: string): Promise<ProviderResponse> {
    const provider = await queries.getProvider(this.db, id);
    if (!provider) {
      throw new NotFoundError("Provider", id);
    }

    const credentials = await queries.listProviderCredentials(this.db, id);
    const activeCount = credentials.filter((c) => c.is_active).length;

    return this.toResponse(provider, activeCount);
  }

  /**
   * Creates a new provider.
   *
   * @param dto - Create provider data
   * @returns Created provider response
   * @throws {ValidationError} If validation fails
   * @throws {ConflictError} If provider name already exists
   */
  async createProvider(dto: CreateProviderDto): Promise<ProviderResponse> {
    // Validate base_url format
    try {
      new URL(dto.base_url);
    } catch {
      throw new ValidationError("Invalid base URL format", {
        base_url: dto.base_url,
      });
    }

    const now = Date.now();
    const provider: Provider = {
      id: generateId(),
      name: dto.name,
      display_name: dto.display_name,
      base_url: dto.base_url,
      api_version: dto.api_version ?? null,
      is_active: true,
      created_at: now,
      updated_at: now,
    };

    await queries.createProvider(this.db, provider);

    return this.toResponse(provider, 0);
  }

  /**
   * Updates a provider.
   *
   * @param id - Provider ID
   * @param dto - Update data
   * @returns Updated provider response
   * @throws {NotFoundError} If provider not found
   */
  async updateProvider(
    id: string,
    dto: UpdateProviderDto
  ): Promise<ProviderResponse> {
    const existing = await queries.getProvider(this.db, id);
    if (!existing) {
      throw new NotFoundError("Provider", id);
    }

    // Validate base_url if provided
    if (dto.base_url) {
      try {
        new URL(dto.base_url);
      } catch {
        throw new ValidationError("Invalid base URL format", {
          base_url: dto.base_url,
        });
      }
    }

    const updated = await queries.updateProvider(this.db, id, {
      display_name: dto.display_name,
      base_url: dto.base_url,
      api_version: dto.api_version,
      is_active: dto.is_active,
    });

    const credentials = await queries.listProviderCredentials(this.db, id);
    const activeCount = credentials.filter((c) => c.is_active).length;

    return this.toResponse(updated, activeCount);
  }

  /**
   * Deletes a provider.
   *
   * @param id - Provider ID
   * @throws {NotFoundError} If provider not found
   */
  async deleteProvider(id: string): Promise<void> {
    const existing = await queries.getProvider(this.db, id);
    if (!existing) {
      throw new NotFoundError("Provider", id);
    }

    // Check if provider has active credentials
    const credentials = await queries.listProviderCredentials(this.db, id);
    if (credentials.length > 0) {
      throw new ValidationError(
        "Cannot delete provider with active credentials",
        { credential_count: String(credentials.length) }
      );
    }

    await queries.deleteProvider(this.db, id);
  }

  /**
   * Lists credentials for a provider.
   *
   * @param providerId - Provider ID
   * @returns Array of credential responses
   */
  async listCredentials(
    providerId: string
  ): Promise<ProviderCredentialResponse[]> {
    const credentials = await queries.listProviderCredentials(
      this.db,
      providerId
    );

    return credentials.map((c) => ({
      id: c.id,
      credential_name: c.credential_name,
      is_active: c.is_active,
      priority: c.priority,
      weight: c.weight,
      health_status: c.health_status,
      last_health_check: c.last_health_check,
      created_at: c.created_at,
    }));
  }

  /**
   * Adds a credential to a provider.
   *
   * @param providerId - Provider ID
   * @param dto - Credential data
   * @returns Created credential response
   * @throws {NotFoundError} If provider not found
   */
  async addCredential(
    providerId: string,
    dto: AddProviderCredentialDto
  ): Promise<ProviderCredentialResponse> {
    const provider = await queries.getProvider(this.db, providerId);
    if (!provider) {
      throw new NotFoundError("Provider", providerId);
    }

    // Encrypt the API key
    const encryptedKey = await this.encryptApiKey(dto.api_key);

    const now = Date.now();
    const credential: ProviderCredential = {
      id: generateId(),
      provider_id: providerId,
      credential_name: dto.credential_name,
      api_key_encrypted: encryptedKey,
      is_active: true,
      priority: dto.priority ?? 0,
      weight: dto.weight ?? 1,
      health_status: "unknown",
      last_health_check: null,
      created_at: now,
      updated_at: now,
    };

    await queries.createProviderCredential(this.db, credential);

    return {
      id: credential.id,
      credential_name: credential.credential_name,
      is_active: credential.is_active,
      priority: credential.priority,
      weight: credential.weight,
      health_status: credential.health_status,
      last_health_check: credential.last_health_check,
      created_at: credential.created_at,
    };
  }

  /**
   * Deletes a provider credential.
   *
   * @param credentialId - Credential ID
   * @throws {NotFoundError} If credential not found
   */
  async deleteCredential(credentialId: string): Promise<void> {
    const existing = await queries.getProviderCredential(this.db, credentialId);
    if (!existing) {
      throw new NotFoundError("Credential", credentialId);
    }

    await queries.deleteProviderCredential(this.db, credentialId);
  }

  /**
   * Updates credential health status.
   *
   * @param credentialId - Credential ID
   * @param status - New health status
   */
  async updateHealthStatus(
    credentialId: string,
    status: "healthy" | "unhealthy" | "unknown"
  ): Promise<void> {
    await queries.updateCredentialHealth(this.db, credentialId, status);
  }

  /**
   * Selects a credential for a model request using consistent hashing.
   *
   * Selection process:
   * 1. Get all providers that support the model
   * 2. Hash by apiKeyId to select provider
   * 3. Get active credentials for selected provider
   * 4. Hash by apiKeyId to select credential
   *
   * @param modelId - Model ID
   * @param apiKeyId - API Key ID for consistent hashing
   * @returns Selected credential
   * @throws {NotFoundError} If no valid credentials found
   */
  async selectCredential(
    modelId: string,
    apiKeyId: string
  ): Promise<SelectedCredential> {
    // Get all providers that support this model
    const modelProviders = await queries.listModelProvidersByModel(
      this.db,
      modelId
    );

    if (modelProviders.length === 0) {
      throw new NotFoundError("Model providers", modelId);
    }

    // Filter to active providers
    const activeProviderIds = modelProviders
      .filter((mp) => mp.is_active)
      .map((mp) => mp.provider_id);

    if (activeProviderIds.length === 0) {
      throw new Error("No active providers found for model");
    }

    // Select provider using consistent hash
    const providerId = this.consistentHash(activeProviderIds, apiKeyId);

    // Get provider details
    const provider = await queries.getProvider(this.db, providerId);
    if (!provider || !provider.is_active) {
      throw new Error("Selected provider is not active");
    }

    // Get active credentials for provider
    const credentials = await queries.listProviderCredentials(this.db, providerId);
    const activeCredentials = credentials.filter(
      (c) => c.is_active && c.health_status !== "unhealthy"
    );

    if (activeCredentials.length === 0) {
      throw new Error("No active credentials found for provider");
    }

    // Select credential using consistent hash
    const credential = this.consistentHashObject(activeCredentials, apiKeyId);

    // Decrypt API key
    const apiKey = await this.decryptApiKey(credential.api_key_encrypted);

    return {
      providerId: provider.id,
      providerName: provider.name,
      baseUrl: provider.base_url,
      apiVersion: provider.api_version,
      credentialId: credential.id,
      apiKey,
    };
  }

  /**
   * Encrypts an API key using the encryption secret.
   *
   * @param apiKey - Plain API key
   * @returns Encrypted API key (hex string)
   */
  private async encryptApiKey(apiKey: string): Promise<string> {
    const encoder = new TextEncoder();
    const keyBytes = encoder.encode(this.encryptionKey);
    const keyData = encoder.encode(apiKey);

    const key = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "AES-GCM" },
      false,
      ["encrypt"]
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      keyData
    );

    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    return Array.from(combined)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  /**
   * Decrypts an API key using the encryption secret.
   *
   * @param encrypted - Hex-encoded encrypted key
   * @returns Decrypted API key
   */
  private async decryptApiKey(encrypted: string): Promise<string> {
    const combined = Uint8Array.from(
      { length: encrypted.length / 2 },
      (_, i) => Number.parseInt(encrypted.slice(i * 2, i * 2 + 2), 16)
    );

    const iv = combined.slice(0, 12);
    const encryptedData = combined.slice(12);

    const encoder = new TextEncoder();
    const keyBytes = encoder.encode(this.encryptionKey);

    const key = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      encryptedData
    );

    return new TextDecoder().decode(decrypted);
  }

  /**
   * Consistent hash selection from an array of strings.
   *
   * @param values - Array of values to select from
   * @param seed - Seed value for hashing
   * @returns Selected value
   */
  private consistentHash(values: string[], seed: string): string {
    // Combine seed with each value and pick the one with highest hash
    let bestValue: string | undefined = values[0];
    let bestHash = BigInt(0);

    for (const value of values) {
      const combined = `${seed}:${value}`;
      const hash = this.hashCode(combined);
      if (hash > bestHash) {
        bestHash = hash;
        bestValue = value;
      }
    }

    return bestValue!;
  }

  /**
   * Consistent hash selection from an array of objects.
   *
   * @param objects - Array of objects to select from
   * @param seed - Seed value for hashing
   * @returns Selected object
   */
  private consistentHashObject<T>(objects: T[], seed: string): T {
    let bestObject: T | undefined = objects[0];
    let bestHash = BigInt(0);

    for (const obj of objects) {
      const combined = `${seed}:${JSON.stringify(obj)}`;
      const hash = this.hashCode(combined);
      if (hash > bestHash) {
        bestHash = hash;
        bestObject = obj;
      }
    }

    return bestObject!;
  }

  /**
   * Simple hash function for consistent hashing.
   *
   * @param str - String to hash
   * @returns Hash value as BigInt
   */
  private hashCode(str: string): bigint {
    let hash = 0n;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 31n + BigInt(str.charCodeAt(i))) & 0xffffffffn;
    }
    return hash;
  }

  /**
   * Converts Provider entity to API response.
   *
   * @param provider - Provider entity
   * @param credentialCount - Number of active credentials
   * @returns Provider response DTO
   */
  private toResponse(
    provider: Provider,
    credentialCount: number
  ): ProviderResponse {
    return {
      id: provider.id,
      name: provider.name,
      display_name: provider.display_name,
      base_url: provider.base_url,
      api_version: provider.api_version,
      is_active: provider.is_active,
      credential_count: credentialCount,
      created_at: provider.created_at,
      updated_at: provider.updated_at,
    };
  }
}
