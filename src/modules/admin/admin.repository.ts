import { ClientSession } from '../../shared/database/transaction';
import { AdminModel, IAdmin } from './admin.model';

export class AdminRepository {
  async findByEmail(email: string, session?: ClientSession): Promise<IAdmin | null> {
    return AdminModel.findOne({ email: email.toLowerCase() })
      .select('+passwordHash')
      .session(session ?? null)
      .exec();
  }

  async findById(id: string): Promise<IAdmin | null> {
    return AdminModel.findById(id).exec();
  }

  async findByIdWithRefreshToken(id: string): Promise<IAdmin | null> {
    return AdminModel.findById(id).select('+refreshTokenHash').exec();
  }

  updateRefreshToken(id: string, refreshTokenHash: string | null): Promise<IAdmin | null> {
    return AdminModel.findByIdAndUpdate(
      id,
      { refreshTokenHash },
      { returnDocument: 'after' },
    ).exec();
  }

  async updateLastLogin(id: string, session?: ClientSession): Promise<void> {
    await AdminModel.findByIdAndUpdate(id, { lastLoginAt: new Date() }, { session }).exec();
  }
}
