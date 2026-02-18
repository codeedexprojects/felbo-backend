import { ClientSession } from 'mongoose';
import { VendorModel, IVendor } from './vendor.model';
import { CreateVendorData, UpsertVendorData } from './vendor.types';

export default class VendorRepository {
  findByPhone(phone: string): Promise<IVendor | null> {
    return VendorModel.findOne({ phone }).exec();
  }

  findById(id: string): Promise<IVendor | null> {
    return VendorModel.findById(id).exec();
  }

  async create(data: CreateVendorData, session?: ClientSession): Promise<IVendor> {
    const [vendor] = await VendorModel.create([data], { session });
    return vendor;
  }

  upsertByPhone(
    phone: string,
    data: UpsertVendorData,
    session?: ClientSession,
  ): Promise<IVendor | null> {
    return VendorModel.findOneAndUpdate(
      { phone },
      { $set: { ...data, phone } },
      { upsert: true, new: true, session },
    ).exec();
  }

  updateLastLogin(id: string, session?: ClientSession): Promise<IVendor | null> {
    return VendorModel.findByIdAndUpdate(
      id,
      { lastLoginAt: new Date() },
      { new: true, session },
    ).exec();
  }

  updateRegistrationPayment(
    id: string,
    data: { amount: number; paymentId: string; paidAt: Date },
    session?: ClientSession,
  ): Promise<IVendor | null> {
    return VendorModel.findByIdAndUpdate(
      id,
      { registrationPayment: data },
      { new: true, session },
    ).exec();
  }

  setVerificationStatus(
    id: string,
    status: 'PENDING' | 'APPROVED' | 'REJECTED',
    note?: string,
    session?: ClientSession,
  ): Promise<IVendor | null> {
    const update: Record<string, unknown> = { verificationStatus: status };
    if (note !== undefined) {
      update.verificationNote = note;
    }
    if (status === 'APPROVED') {
      update.verifiedAt = new Date();
    }
    return VendorModel.findByIdAndUpdate(id, update, { new: true, session }).exec();
  }

  setStatus(
    id: string,
    status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'DELETED',
    session?: ClientSession,
  ): Promise<IVendor | null> {
    return VendorModel.findByIdAndUpdate(id, { status }, { new: true, session }).exec();
  }
  findAll(
    filter: Record<string, unknown>,
    page: number,
    limit: number,
  ): Promise<{ vendors: IVendor[]; total: number }> {
    const skip = (page - 1) * limit;
    return Promise.all([
      VendorModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      VendorModel.countDocuments(filter).exec(),
    ]).then(([vendors, total]) => ({ vendors, total }));
  }
}
