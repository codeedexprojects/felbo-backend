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
}
