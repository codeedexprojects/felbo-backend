import { Logger } from 'winston';
import { RedisClientType } from '../../shared/redis/redis';
import { ConfigRepository } from './config.repository';
import { ConfigDTO, ConfigsByCategoryDTO } from './config.types';
import { ISystemConfig, ConfigValueType } from './config.model';
import { NotFoundError, ValidationError } from '../../shared/errors/index';
import { DEFAULT_CONFIGS } from '../../shared/config/config.defaults';
import { REDIS_KEY_PREFIX, REDIS_TTL } from '../../shared/config/config.keys';

export class ConfigService {
  private readonly memoryCache = new Map<string, string>();

  constructor(
    private readonly configRepository: ConfigRepository,
    private readonly getRedis: () => RedisClientType,
    private readonly logger: Logger,
  ) {}

  async initialize(): Promise<void> {
    await this.configRepository.upsertMany(DEFAULT_CONFIGS);
    const configs = await this.configRepository.findAll();
    configs.forEach((config) => this.memoryCache.set(config.key, config.value));

    await Promise.all(
      configs.map((config) =>
        this.getRedis()
          .set(`${REDIS_KEY_PREFIX}${config.key}`, config.value, { EX: REDIS_TTL })
          .catch((err) =>
            this.logger.warn('Redis sync failed during initialization', { key: config.key, err }),
          ),
      ),
    );
    this.logger.info('System config initialised', { count: configs.length });
  }

  async getAllConfigs(): Promise<ConfigsByCategoryDTO[]> {
    const configs = await this.configRepository.findAll();
    return this.groupByCategory(configs);
  }

  async getConfigsByCategory(category: string): Promise<ConfigsByCategoryDTO> {
    const configs = await this.configRepository.findByCategory(category);
    return {
      category,
      configs: configs.map((c) => this.mapToDTO(c)),
    };
  }

  async updateConfig(key: string, value: string, adminId: string): Promise<ConfigDTO> {
    const existing = await this.configRepository.findByKey(key);
    if (!existing) {
      throw new NotFoundError(`Config key '${key}' not found.`);
    }

    this.validateValueType(value, existing.valueType);

    const updated = await this.configRepository.updateByKey(key, value, adminId);
    if (!updated) {
      throw new NotFoundError(`Config key '${key}' could not be updated.`);
    }

    this.memoryCache.set(key, value);

    await this.getRedis()
      .set(`${REDIS_KEY_PREFIX}${key}`, value, { EX: REDIS_TTL })
      .catch((err) => this.logger.warn('Redis sync failed after config update', { key, err }));

    this.logger.info('System config updated', { key, value, adminId });

    return this.mapToDTO(updated);
  }

  async getValueAsNumber(key: string): Promise<number> {
    const inMemory = this.memoryCache.get(key);
    if (inMemory !== undefined) return Number(inMemory);

    const cached = await this.getRedis()
      .get(`${REDIS_KEY_PREFIX}${key}`)
      .catch(() => null);
    if (cached !== null) {
      this.memoryCache.set(key, cached);
      return Number(cached);
    }

    const config = await this.configRepository.findByKey(key);
    if (!config) throw new NotFoundError(`Config key '${key}' not found.`);
    this.memoryCache.set(key, config.value);
    this.rewarmCache(key, config.value);
    return Number(config.value);
  }

  async getValueAsBoolean(key: string): Promise<boolean> {
    const inMemory = this.memoryCache.get(key);
    if (inMemory !== undefined) return inMemory === 'true';

    const cached = await this.getRedis()
      .get(`${REDIS_KEY_PREFIX}${key}`)
      .catch(() => null);
    if (cached !== null) {
      this.memoryCache.set(key, cached);
      return cached === 'true';
    }

    const config = await this.configRepository.findByKey(key);
    if (!config) throw new NotFoundError(`Config key '${key}' not found.`);
    this.memoryCache.set(key, config.value);
    this.rewarmCache(key, config.value);
    return config.value === 'true';
  }

  async getValueAsString(key: string): Promise<string> {
    const inMemory = this.memoryCache.get(key);
    if (inMemory !== undefined) return inMemory;

    const cached = await this.getRedis()
      .get(`${REDIS_KEY_PREFIX}${key}`)
      .catch(() => null);
    if (cached !== null) {
      this.memoryCache.set(key, cached);
      return cached;
    }

    const config = await this.configRepository.findByKey(key);
    if (!config) throw new NotFoundError(`Config key '${key}' not found.`);
    this.memoryCache.set(key, config.value);
    this.rewarmCache(key, config.value);
    return config.value;
  }

  private validateValueType(value: string, valueType: ConfigValueType): void {
    if (valueType === 'number') {
      const num = Number(value);
      if (isNaN(num) || !isFinite(num)) {
        throw new ValidationError(`Value '${value}' is not a valid finite number.`);
      }
    }
    if (valueType === 'boolean' && value !== 'true' && value !== 'false') {
      throw new ValidationError(
        `Value '${value}' is not a valid boolean. Must be 'true' or 'false'.`,
      );
    }
  }

  private rewarmCache(key: string, value: string): void {
    this.getRedis()
      .set(`${REDIS_KEY_PREFIX}${key}`, value, { EX: REDIS_TTL })
      .catch((err) => this.logger.warn('Redis cache re-warm failed', { key, err }));
  }

  private groupByCategory(configs: ISystemConfig[]): ConfigsByCategoryDTO[] {
    const map = new Map<string, ConfigDTO[]>();

    for (const config of configs) {
      if (!map.has(config.category)) {
        map.set(config.category, []);
      }
      map.get(config.category)!.push(this.mapToDTO(config));
    }

    return Array.from(map.entries()).map(([category, configsList]) => ({
      category,
      configs: configsList,
    }));
  }

  private mapToDTO(config: ISystemConfig): ConfigDTO {
    return {
      id: config._id.toString(),
      key: config.key,
      value: config.value,
      valueType: config.valueType,
      category: config.category,
      displayName: config.displayName,
      description: config.description,
      updatedBy: config.updatedBy?.toString(),
      updatedAt: config.updatedAt,
    };
  }
}
