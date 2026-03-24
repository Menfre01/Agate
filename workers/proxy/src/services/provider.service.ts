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
} from "@agate/shared/types";
import * as queries from "@agate/shared/db/queries.js";
import { generateId } from "@agate/shared/utils/id-generator.js";
import { NotFoundError, ValidationError } from "@agate/shared/utils/errors/index.js";
import { consistentHashSelect, hashValues } from "@agate/shared/utils/consistent-hash.js";

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
  /** Actual model ID to use for upstream API calls (may differ from requested model_id) */
  actualModelId: string | null;
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
      base_url: c.base_url ?? null,
      is_active: Boolean(c.is_active),
      health_check_model_id: c.health_check_model_id,
      health_status: c.health_status,
      last_health_check: c.last_health_check,
      last_check_success: c.last_check_success,
      consecutive_failures: c.consecutive_failures,
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
   * @throws {ValidationError} If base_url format is invalid
   */
  async addCredential(
    providerId: string,
    dto: AddProviderCredentialDto
  ): Promise<ProviderCredentialResponse> {
    const provider = await queries.getProvider(this.db, providerId);
    if (!provider) {
      throw new NotFoundError("Provider", providerId);
    }

    // Validate base_url format if provided
    if (dto.base_url) {
      try {
        new URL(dto.base_url);
      } catch {
        throw new ValidationError("Invalid base URL format", {
          base_url: dto.base_url,
        });
      }
    }

    // Encrypt the API key
    let encryptedKey: string;
    try {
      encryptedKey = await this.encryptApiKey(dto.api_key);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new ValidationError(`Failed to encrypt API key: ${errorMessage}`, {
        original_error: errorMessage,
      });
    }

    // Auto-select cheapest model for health checks (PRD V2 Section 2.3.2)
    const cheapestModel = await queries.getCheapestModelForProvider(this.db, providerId);

    const now = Date.now();
    const credential: ProviderCredential = {
      id: generateId(),
      provider_id: providerId,
      credential_name: dto.credential_name,
      api_key_encrypted: encryptedKey,
      base_url: dto.base_url ?? null,
      is_active: true,
      health_check_model_id: cheapestModel?.id ?? null,
      health_status: "unknown",
      last_health_check: null,
      last_check_success: null,
      consecutive_failures: 0,
      created_at: now,
      updated_at: now,
    };

    await queries.createProviderCredential(this.db, credential);

    return {
      id: credential.id,
      credential_name: credential.credential_name,
      base_url: credential.base_url,
      is_active: Boolean(credential.is_active),
      health_check_model_id: credential.health_check_model_id,
      health_status: credential.health_status,
      last_health_check: credential.last_health_check,
      last_check_success: credential.last_check_success,
      consecutive_failures: credential.consecutive_failures,
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
   * Selects a credential for a model request using consistent hash load balancing.
   *
   * Selection process (two-layer, per PRD V2 Section 2.3):
   * 1. Get all active providers for the model (from model_providers)
   * 2. Select provider using consistent hash(api_key_id + model_id)
   * 3. Get active & healthy credentials for selected provider
   * 4. Select credential using consistent hash(api_key_id)
   *
   * Cache-friendly: Same user + same model → Same provider → Same credential
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
    // 1. Get all active providers for this model
    const modelProviders = await queries.getActiveProvidersForModel(this.db, modelId);

    if (modelProviders.length === 0) {
      throw new Error("No active providers found for model");
    }

    // 2. Select provider using consistent hash(api_key_id + model_id)
    // This ensures the same user + model always goes to the same provider (cache-friendly)
    const providerHash = hashValues(apiKeyId, modelId);
    const selectedProvider = consistentHashSelect(
      modelProviders,
      providerHash.toString()
    ) as { provider_id: string; is_active: boolean; actual_model_id: string | null };

    // 3. Get provider details
    const provider = await queries.getProvider(this.db, selectedProvider.provider_id);
    if (!provider || !provider.is_active) {
      throw new Error("Provider not found or inactive");
    }

    // 4. Get active credentials for selected provider
    const credentials = await queries.listProviderCredentials(this.db, provider.id);

    // 5. Select credential using consistent hash(api_key_id)
    // consistentHashSelect automatically filters out unhealthy credentials
    const credential = consistentHashSelect(credentials, apiKeyId);

    // 6. Decrypt API key
    const apiKey = await this.decryptApiKey(credential.api_key_encrypted);

    // 7. Resolve base URL: credential-level takes precedence over provider-level
    const baseUrl = credential.base_url ?? provider.base_url;

    return {
      providerId: provider.id,
      providerName: provider.name,
      baseUrl,
      apiVersion: provider.api_version,
      credentialId: credential.id,
      apiKey,
      actualModelId: selectedProvider.actual_model_id,
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
    // Derive a 256-bit key from the encryption key using SHA-256
    const keyData = encoder.encode(this.encryptionKey);
    const hashBuffer = await crypto.subtle.digest("SHA-256", keyData);
    const keyBytes = new Uint8Array(hashBuffer);
    const dataBytes = encoder.encode(apiKey);

    const key = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt"]
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      dataBytes
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
    // Derive the same 256-bit key from the encryption key using SHA-256
    const keyData = encoder.encode(this.encryptionKey);
    const hashBuffer = await crypto.subtle.digest("SHA-256", keyData);
    const keyBytes = new Uint8Array(hashBuffer);

    const key = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "AES-GCM", length: 256 },
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
      is_active: Boolean(provider.is_active),
      credential_count: credentialCount,
      created_at: provider.created_at,
      updated_at: provider.updated_at,
    };
  }
}
