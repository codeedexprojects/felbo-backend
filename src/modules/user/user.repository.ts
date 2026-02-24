import { ClientSession } from 'mongoose';
import { UserModel, IUser } from './user.model';

// ─── Repository ──────────────────────────────────────────────────

export default class UserRepository {
  findByPhone(phone: string): Promise<IUser | null> {
    return UserModel.findOne({ phone }).exec();
  }

  findById(id: string): Promise<IUser | null> {
    return UserModel.findById(id).exec();
  }

  findByIdWithRefreshToken(id: string): Promise<IUser | null> {
    return UserModel.findById(id).select('+refreshTokenHash').exec();
  }

  updateRefreshToken(id: string, refreshTokenHash: string | null): Promise<IUser | null> {
    return UserModel.findByIdAndUpdate(id, { refreshTokenHash }, { new: true }).exec();
  }

  async create(data: { phone: string; name?: string }, session?: ClientSession): Promise<IUser> {
    const [user] = await UserModel.create([data], { session });
    return user;
  }

  updateLastLogin(id: string, session?: ClientSession): Promise<IUser | null> {
    return UserModel.findByIdAndUpdate(
      id,
      { lastLoginAt: new Date() },
      { new: true, session },
    ).exec();
  }

  updateProfile(
    id: string,
    data: { name?: string; email?: string },
    session?: ClientSession,
  ): Promise<IUser | null> {
    return UserModel.findByIdAndUpdate(id, data, {
      new: true,
      session,
    }).exec();
  }

  updateStatus(
    id: string,
    status: 'ACTIVE' | 'BLOCKED' | 'DELETED',
    session?: ClientSession,
  ): Promise<IUser | null> {
    return UserModel.findByIdAndUpdate(id, { status }, { new: true, session }).exec();
  }

  async findAll(filter: {
    search?: string;
    status?: 'ACTIVE' | 'BLOCKED';
    page: number;
    limit: number;
  }): Promise<{ users: IUser[]; total: number }> {
    const query: Record<string, unknown> = { status: { $ne: 'DELETED' } };

    if (filter.status) {
      query.status = filter.status;
    }

    if (filter.search) {
      const escaped = filter.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { phone: { $regex: escaped, $options: 'i' } },
      ];
    }

    const skip = (filter.page - 1) * filter.limit;

    const [users, total] = await Promise.all([
      UserModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(filter.limit).exec(),
      UserModel.countDocuments(query).exec(),
    ]);

    return { users, total };
  }

  async getStatusCounts(): Promise<{ total: number; active: number; blocked: number }> {
    const [total, active, blocked] = await Promise.all([
      UserModel.countDocuments({ status: { $ne: 'DELETED' } }).exec(),
      UserModel.countDocuments({ status: 'ACTIVE' }).exec(),
      UserModel.countDocuments({ status: 'BLOCKED' }).exec(),
    ]);
    return { total, active, blocked };
  }

  blockById(id: string, blockReason: string): Promise<IUser | null> {
    return UserModel.findByIdAndUpdate(
      id,
      { status: 'BLOCKED', blockReason },
      { new: true },
    ).exec();
  }

  unblockById(id: string): Promise<IUser | null> {
    return UserModel.findByIdAndUpdate(
      id,
      { status: 'ACTIVE', blockReason: null },
      { new: true },
    ).exec();
  }
}
