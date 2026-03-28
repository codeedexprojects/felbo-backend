import { SystemConfigModel, ISystemConfig } from './config.model';
import { SeedConfigItem } from './config.types';

export class ConfigRepository {
  findByKey(key: string): Promise<ISystemConfig | null> {
    return SystemConfigModel.findOne({ key }).exec();
  }

  findByCategory(category: string): Promise<ISystemConfig[]> {
    return SystemConfigModel.find({ category }).sort({ key: 1 }).exec();
  }

  findAll(): Promise<ISystemConfig[]> {
    return SystemConfigModel.find().sort({ category: 1, key: 1 }).exec();
  }

  updateByKey(key: string, value: string, updatedBy: string): Promise<ISystemConfig | null> {
    return SystemConfigModel.findOneAndUpdate(
      { key },
      { $set: { value, updatedBy } },
      { returnDocument: 'after' },
    ).exec();
  }

  async upsertMany(items: SeedConfigItem[]): Promise<void> {
    const ops = items.map((item) => ({
      updateOne: {
        filter: { key: item.key },
        update: { $setOnInsert: item },
        upsert: true,
      },
    }));
    await SystemConfigModel.bulkWrite(ops);
  }
}
