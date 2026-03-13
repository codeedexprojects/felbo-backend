import mongoose from 'mongoose';
import { ClientSession } from '../../shared/database/transaction';
import {
  BarberAvailabilityModel,
  IBarberAvailability,
  IPresetItem,
} from './barberAvailability.model';

const MAX_PRESETS = 3;

export class BarberAvailabilityRepository {
  async atomicAddPreset(
    barberId: string,
    shopId: string,
    preset: Pick<IPresetItem, 'name' | 'workingHours' | 'breaks'>,
    session?: ClientSession,
  ): Promise<IBarberAvailability | null> {
    const limitGuardKey = `presets.${MAX_PRESETS - 1}`;

    return BarberAvailabilityModel.findOneAndUpdate(
      { barberId, [limitGuardKey]: { $exists: false } },
      {
        $push: {
          presets: {
            _id: new mongoose.Types.ObjectId(),
            name: preset.name,
            workingHours: preset.workingHours,
            breaks: preset.breaks,
            createdAt: new Date(),
          },
        },
        $setOnInsert: { shopId },
      },
      { upsert: true, returnDocument: 'after', session },
    )
      .lean<IBarberAvailability>()
      .exec();
  }

  async findPresets(barberId: string): Promise<IPresetItem[]> {
    const doc = await BarberAvailabilityModel.findOne({ barberId }, { presets: 1 })
      .lean<Pick<IBarberAvailability, 'presets'>>()
      .exec();
    return doc?.presets ?? [];
  }

  async findPresetById(barberId: string, presetId: string): Promise<IPresetItem | null> {
    const presets = await this.findPresets(barberId);
    return presets.find((p) => p._id.toString() === presetId) ?? null;
  }

  async removePreset(barberId: string, presetId: string, session?: ClientSession): Promise<void> {
    await BarberAvailabilityModel.updateOne(
      { barberId },
      { $pull: { presets: { _id: new mongoose.Types.ObjectId(presetId) } } },
      { session },
    ).exec();
  }

  async upsertTodayAvailability(
    data: {
      barberId: string;
      shopId: string;
      date: Date;
      isWorking: boolean;
      workingHours?: { start: string; end: string };
      breaks: Array<{ start: string; end: string; reason?: string }>;
    },
    session?: ClientSession,
  ): Promise<IBarberAvailability | null> {
    return BarberAvailabilityModel.findOneAndUpdate(
      { barberId: data.barberId },
      {
        $set: {
          shopId: data.shopId,
          date: data.date,
          isWorking: data.isWorking,
          workingHours: data.workingHours,
          breaks: data.breaks,
        },
        $setOnInsert: { presets: [] },
      },
      { upsert: true, returnDocument: 'after', session },
    )
      .lean<IBarberAvailability>()
      .exec();
  }

  async findByBarberId(barberId: string): Promise<IBarberAvailability | null> {
    return BarberAvailabilityModel.findOne({ barberId }).lean<IBarberAvailability>().exec();
  }

  async countWorkingByShopIds(
    shopIds: string[],
    todayStart: Date,
    todayEnd: Date,
  ): Promise<number> {
    return BarberAvailabilityModel.countDocuments({
      shopId: { $in: shopIds.map((id) => new mongoose.Types.ObjectId(id)) },
      isWorking: true,
      date: { $gte: todayStart, $lt: todayEnd },
    }).exec();
  }
}
