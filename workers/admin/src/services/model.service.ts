/**
 * Model Service for AI model management.
 *
 * Handles model CRUD operations, provider linking,
 * and department-level model access control.
 *
 * @module services/model
 */

import type {
  Model,
  CreateModelDto,
  UpdateModelDto,
  ModelResponse,
  SetDepartmentModelDto,
  DepartmentModelResponse,
  AddModelProviderDto,
  ModelProviderResponse,
  Env,
} from "@agate/shared/types/index.ts";
import * as queries from "@agate/shared/db/queries.js";
import { generateId } from "@agate/shared/utils/id-generator.js";
import { NotFoundError, ConflictError } from "@agate/shared/utils/errors/index.js";

/**
 * Model Service class.
 *
 * @example
 * ```ts
 * const model = new ModelService(env);
 *
 * // Create a new model
 * const response = await model.createModel({
 *   model_id: "claude-3-sonnet",
 *   display_name: "Claude 3 Sonnet",
 *   context_window: 200000,
 * });
 *
 * // Check if user can access model
 * const allowed = await model.isModelAllowed("dept-123", "model-456");
 * ```
 */
export class ModelService {
  private readonly db: D1Database;

  /**
   * Creates a new ModelService instance.
   *
   * @param env - Cloudflare Workers environment
   */
  constructor(env: Env) {
    this.db = env.DB;
  }

  /**
   * Lists all models.
   *
   * @returns Array of model responses
   */
  async listModels(): Promise<ModelResponse[]> {
    const models = await queries.listModels(this.db);

    return Promise.all(
      models.map((model) => this.buildResponse(model))
    );
  }

  /**
   * Gets a model by ID.
   *
   * @param id - Model ID
   * @returns Model response
   * @throws {NotFoundError} If model not found
   */
  async getModel(id: string): Promise<ModelResponse> {
    const model = await queries.getModel(this.db, id);
    if (!model) {
      throw new NotFoundError("Model", id);
    }

    return this.buildResponse(model);
  }

  /**
   * Gets a model by model_id (e.g., "claude-3-sonnet").
   *
   * @param modelId - Model identifier
   * @returns Model entity, or null if not found
   */
  async getByModelId(modelId: string): Promise<Model | null> {
    return queries.getModelByModelId(this.db, modelId);
  }

  /**
   * Creates a new model.
   *
   * @param dto - Create model data
   * @returns Created model response
   * @throws {ValidationError} If validation fails
   */
  async createModel(dto: CreateModelDto): Promise<ModelResponse> {
    // Check if model_id already exists
    const existing = await queries.getModelByModelId(this.db, dto.model_id);
    if (existing) {
      throw new ConflictError("Model", "model_id", dto.model_id);
    }

    // Check if alias already exists
    if (dto.alias) {
      const existingAlias = await queries.getModelByAlias(this.db, dto.alias);
      if (existingAlias) {
        throw new ConflictError("Model", "alias", dto.alias);
      }
    }

    const now = Date.now();
    const model: Model = {
      id: generateId(),
      model_id: dto.model_id,
      alias: dto.alias ?? null,
      display_name: dto.display_name,
      context_window: dto.context_window ?? 0,
      max_tokens: dto.max_tokens ?? 0,
      is_active: true,
      created_at: now,
      updated_at: now,
    };

    await queries.createModel(this.db, model);

    return this.buildResponse(model);
  }

  /**
   * Updates a model.
   *
   * @param id - Model ID
   * @param dto - Update data
   * @returns Updated model response
   * @throws {NotFoundError} If model not found
   */
  async updateModel(id: string, dto: UpdateModelDto): Promise<ModelResponse> {
    const existing = await queries.getModel(this.db, id);
    if (!existing) {
      throw new NotFoundError("Model", id);
    }

    // Check if new alias already exists (and belongs to a different model)
    if (dto.alias !== undefined && dto.alias !== existing.alias) {
      if (dto.alias !== null) {
        const existingAlias = await queries.getModelByAlias(this.db, dto.alias);
        if (existingAlias && existingAlias.id !== id) {
          throw new ConflictError("Model", "alias", dto.alias);
        }
      }
    }

    const updated = await queries.updateModel(this.db, id, {
      alias: dto.alias,
      display_name: dto.display_name,
      context_window: dto.context_window,
      max_tokens: dto.max_tokens,
      is_active: dto.is_active,
    });

    return this.buildResponse(updated);
  }

  /**
   * Deletes a model.
   *
   * @param id - Model ID
   * @throws {NotFoundError} If model not found
   */
  async deleteModel(id: string): Promise<void> {
    const existing = await queries.getModel(this.db, id);
    if (!existing) {
      throw new NotFoundError("Model", id);
    }

    await queries.deleteModel(this.db, id);
  }

  /**
   * Sets department-level model access.
   *
   * @param departmentId - Department ID
   * @param modelId - Model ID
   * @param dto - Access configuration
   * @returns Department model response
   * @throws {NotFoundError} If department or model not found
   */
  async setDepartmentModel(
    departmentId: string,
    modelId: string,
    dto: SetDepartmentModelDto
  ): Promise<DepartmentModelResponse> {
    const department = await queries.getDepartment(this.db, departmentId);
    if (!department) {
      throw new NotFoundError("Department", departmentId);
    }

    const model = await queries.getModel(this.db, modelId);
    if (!model) {
      throw new NotFoundError("Model", modelId);
    }

    // Check existing configuration
    const existing = await queries.getDepartmentModel(this.db, departmentId, modelId);

    if (existing) {
      // Update existing
      await queries.updateDepartmentModel(this.db, existing.id, {
        is_allowed: dto.is_allowed,
        daily_quota: dto.daily_quota ?? 0,
      });
    } else {
      // Create new
      await queries.createDepartmentModel(this.db, {
        id: generateId(),
        department_id: departmentId,
        model_id: modelId,
        is_allowed: dto.is_allowed,
        daily_quota: dto.daily_quota ?? 0,
        created_at: Date.now(),
      });
    }

    return {
      department_id: departmentId,
      department_name: department.name,
      model_id: modelId,
      model_display_name: model.display_name,
      is_allowed: dto.is_allowed,
      daily_quota: dto.daily_quota ?? 0,
      created_at: existing?.created_at ?? Date.now(),
    };
  }

  /**
   * Checks if a department is allowed to use a model.
   *
   * @param departmentId - Department ID
   * @param modelId - Model ID
   * @returns true if model is allowed, false otherwise
   */
  async isModelAllowed(
    departmentId: string | null,
    modelId: string
  ): Promise<boolean> {
    // If no department, allow by default (check handled at company level)
    if (!departmentId) {
      return true;
    }

    const config = await queries.getDepartmentModel(this.db, departmentId, modelId);

    // No config means allowed by default
    if (!config) {
      return true;
    }

    return config.is_allowed;
  }

  /**
   * Gets department model configuration.
   *
   * @param departmentId - Department ID
   * @param modelId - Model ID
   * @returns Department model configuration, or null if not found
   */
  async getDepartmentModel(
    departmentId: string,
    modelId: string
  ): Promise<DepartmentModelResponse | null> {
    const config = await queries.getDepartmentModel(this.db, departmentId, modelId);
    if (!config) {
      return null;
    }

    const [department, model] = await Promise.all([
      queries.getDepartment(this.db, departmentId),
      queries.getModel(this.db, modelId),
    ]);

    if (!department || !model) {
      return null;
    }

    return {
      department_id: departmentId,
      department_name: department.name,
      model_id: modelId,
      model_display_name: model.display_name,
      is_allowed: config.is_allowed,
      daily_quota: config.daily_quota,
      created_at: config.created_at,
    };
  }

  /**
   * Lists all model configurations for a department.
   *
   * @param departmentId - Department ID
   * @returns Array of department model responses
   */
  async listDepartmentModels(
    departmentId: string
  ): Promise<DepartmentModelResponse[]> {
    const configs = await queries.listDepartmentModels(this.db, departmentId);

    return Promise.all(
      configs.map(async (config) => {
        const [department, model] = await Promise.all([
          queries.getDepartment(this.db, config.department_id),
          queries.getModel(this.db, config.model_id),
        ]);

        return {
          department_id: config.department_id,
          department_name: department?.name ?? "",
          model_id: config.model_id,
          model_display_name: model?.display_name ?? "",
          is_allowed: config.is_allowed,
          daily_quota: config.daily_quota,
          created_at: config.created_at,
        };
      })
    );
  }

  /**
   * Adds a provider to a model with pricing.
   *
   * @param modelId - Model ID
   * @param dto - Add model provider data
   * @returns Model-provider response
   * @throws {NotFoundError} If model or provider not found
   * @throws {ConflictError} If provider already added to model
   */
  async addProvider(
    modelId: string,
    dto: AddModelProviderDto
  ): Promise<ModelProviderResponse> {
    const model = await queries.getModel(this.db, modelId);
    if (!model) {
      throw new NotFoundError("Model", modelId);
    }

    const provider = await queries.getProvider(this.db, dto.provider_id);
    if (!provider) {
      throw new NotFoundError("Provider", dto.provider_id);
    }

    // Check existing
    const existing = await queries.getModelProvider(this.db, modelId, dto.provider_id);
    if (existing) {
      throw new ConflictError("ModelProvider", "model_id,provider_id", `${modelId},${dto.provider_id}`);
    }

    const result = await queries.addModelProvider(this.db, {
      id: generateId(),
      model_id: modelId,
      provider_id: dto.provider_id,
      input_price: dto.input_price ?? 0,
      output_price: dto.output_price ?? 0,
    });

    return {
      model_id: modelId,
      provider_id: dto.provider_id,
      provider_name: provider.name,
      input_price: result.input_price,
      output_price: result.output_price,
      is_active: Boolean(result.is_active),
    };
  }

  /**
   * Removes a provider from a model.
   *
   * @param modelId - Model ID
   * @param providerId - Provider ID
   * @throws {NotFoundError} If model-provider configuration not found
   */
  async removeProvider(modelId: string, providerId: string): Promise<void> {
    const existing = await queries.getModelProvider(this.db, modelId, providerId);
    if (!existing) {
      throw new NotFoundError("ModelProvider", `${modelId}-${providerId}`);
    }

    await queries.removeModelProvider(this.db, modelId, providerId);
  }

  /**
   * Lists all providers for a model.
   *
   * @param modelId - Model ID
   * @returns Array of model-provider responses
   */
  async listProviders(modelId: string): Promise<ModelProviderResponse[]> {
    const modelProviders = await queries.getProvidersForModel(this.db, modelId);

    return modelProviders.map((mp) => ({
      model_id: modelId,
      provider_id: mp.provider_id,
      provider_name: mp.provider_name,
      input_price: mp.input_price,
      output_price: mp.output_price,
      is_active: Boolean(mp.is_active),
    }));
  }

  /**
   * Builds a complete ModelResponse with provider information.
   *
   * @param model - Model entity
   * @returns Model response DTO
   */
  private async buildResponse(model: Model): Promise<ModelResponse> {
    const modelProviders = await queries.getProvidersForModel(this.db, model.id);

    const providers = modelProviders.map((mp) => ({
      provider_id: mp.provider_id,
      provider_name: mp.provider_display_name,
      input_price: mp.input_price,
      output_price: mp.output_price,
      is_active: Boolean(mp.is_active),
    }));

    return {
      id: model.id,
      model_id: model.model_id,
      alias: model.alias,
      display_name: model.display_name,
      context_window: model.context_window,
      max_tokens: model.max_tokens,
      is_active: Boolean(model.is_active),
      providers,
      created_at: model.created_at,
      updated_at: model.updated_at,
    };
  }
}
