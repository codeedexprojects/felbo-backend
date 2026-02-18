import { ClientSession } from 'mongoose';
import { AdminModel, IAdmin } from './admin.model';

export class AdminRepository {
  async findByEmail(email: string, session?: ClientSession): Promise<IAdmin | null> {
    return AdminModel.findOne({ email: email.toLowerCase() })
      .select('+passwordHash')
      .session(session ?? null)
      .exec();
  }

  async updateLastLogin(id: string, session?: ClientSession): Promise<void> {
    await AdminModel.findByIdAndUpdate(id, { lastLoginAt: new Date() }, { session }).exec();
  }
}
