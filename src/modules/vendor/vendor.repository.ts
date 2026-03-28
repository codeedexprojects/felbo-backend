import mongoose from 'mongoose';
import { ClientSession } from '../../shared/database/transaction';
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
      { upsert: true, returnDocument: 'after', session },
    ).exec();
  }

  updateLastLogin(id: string, session?: ClientSession): Promise<IVendor | null> {
    return VendorModel.findByIdAndUpdate(
      id,
      { lastLoginAt: new Date() },
      { returnDocument: 'after', session },
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
      { returnDocument: 'after', session },
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
    return VendorModel.findByIdAndUpdate(id, update, { returnDocument: 'after', session }).exec();
  }

  setStatus(
    id: string,
    status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'DELETED',
    session?: ClientSession,
  ): Promise<IVendor | null> {
    return VendorModel.findByIdAndUpdate(
      id,
      { status },
      { returnDocument: 'after', session },
    ).exec();
  }

  async getStatusCounts(registrationType?: 'ASSOCIATION' | 'INDEPENDENT'): Promise<{
    total: number;
    active: number;
    pendingVerification: number;
    suspended: number;
  }> {
    const scope = registrationType ? { registrationType } : {};

    const total = await VendorModel.countDocuments(scope).exec();
    const active = await VendorModel.countDocuments({ ...scope, status: 'ACTIVE' }).exec();
    const pendingVerification = await VendorModel.countDocuments({
      ...scope,
      verificationStatus: 'PENDING',
    }).exec();
    const suspended = await VendorModel.countDocuments({ ...scope, status: 'SUSPENDED' }).exec();

    return { total, active, pendingVerification, suspended };
  }

  async getVerificationRequestCounts(): Promise<{
    pending: number;
    association: number;
    independent: number;
  }> {
    const pending = await VendorModel.countDocuments({ verificationStatus: 'PENDING' }).exec();
    const association = await VendorModel.countDocuments({
      verificationStatus: 'PENDING',
      registrationType: 'ASSOCIATION',
    }).exec();
    const independent = await VendorModel.countDocuments({
      verificationStatus: 'PENDING',
      registrationType: 'INDEPENDENT',
    }).exec();

    return { pending, association, independent };
  }

  async getDashboardStats(): Promise<{ total: number; pendingVerifications: number }> {
    const result = await VendorModel.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          pendingVerifications: {
            $sum: { $cond: [{ $eq: ['$verificationStatus', 'PENDING'] }, 1, 0] },
          },
        },
      },
    ]).exec();

    return {
      total: result[0]?.total ?? 0,
      pendingVerifications: result[0]?.pendingVerifications ?? 0,
    };
  }

  async findIdsByRegistrationType(
    registrationType: 'ASSOCIATION' | 'INDEPENDENT',
  ): Promise<mongoose.Types.ObjectId[]> {
    const vendors = await VendorModel.find({ registrationType })
      .select('_id')
      .lean<{ _id: mongoose.Types.ObjectId }[]>()
      .exec();
    return vendors.map((v) => v._id);
  }

  async findAll(
    filter: Record<string, unknown>,
    page: number,
    limit: number,
  ): Promise<{ vendors: IVendor[]; total: number }> {
    const skip = (page - 1) * limit;

    const [result] = await VendorModel.aggregate<{
      vendors: IVendor[];
      totalCount: { count: number }[];
    }>([
      { $match: filter },
      {
        $facet: {
          vendors: [{ $sort: { createdAt: -1 } }, { $skip: skip }, { $limit: limit }],
          totalCount: [{ $count: 'count' }],
        },
      },
    ]).exec();

    const vendors = (result?.vendors ?? []) as unknown as IVendor[];
    const total = result?.totalCount[0]?.count ?? 0;

    return { vendors, total };
  }

  blockById(id: string, reason: string, adminId: string): Promise<IVendor | null> {
    return VendorModel.findByIdAndUpdate(
      id,
      {
        isBlocked: true,
        blockReason: reason,
        blockedAt: new Date(),
        blockedBy: adminId,
        refreshTokenHash: null,
      },
      { returnDocument: 'after' },
    ).exec();
  }

  unblockById(id: string): Promise<IVendor | null> {
    return VendorModel.findByIdAndUpdate(
      id,
      {
        isBlocked: false,
        blockReason: null,
        blockedAt: null,
        blockedBy: null,
      },
      { returnDocument: 'after' },
    ).exec();
  }

  flagById(id: string): Promise<IVendor | null> {
    return VendorModel.findByIdAndUpdate(
      id,
      { isFlagged: true, flaggedAt: new Date() },
      { returnDocument: 'after' },
    ).exec();
  }

  deactivateById(id: string, reason?: string): Promise<IVendor | null> {
    return VendorModel.findByIdAndUpdate(
      id,
      {
        $set: {
          status: 'DELETED',
          deactivatedAt: new Date(),
          deactivationReason: reason ?? null,
          refreshTokenHash: null,
          fcmTokens: [],
        },
      },
      { returnDocument: 'after', new: true },
    ).exec();
  }

  reactivateById(id: string): Promise<IVendor | null> {
    return VendorModel.findByIdAndUpdate(
      id,
      { $set: { status: 'ACTIVE', deactivatedAt: null } },
      { returnDocument: 'after', new: true },
    ).exec();
  }

  async getAllPhotoKeys(): Promise<string[]> {
    const vendors = await VendorModel.find(
      {},
      {
        'documents.shopLicense': 1,
        'documents.ownerIdProof': 1,
        associationIdProofUrl: 1,
        profilePhoto: 1,
      },
    )
      .lean()
      .exec();

    const keys: string[] = [];
    for (const v of vendors) {
      if (v.documents?.shopLicense) keys.push(v.documents.shopLicense);
      if (v.documents?.ownerIdProof) keys.push(v.documents.ownerIdProof);
      if (v.associationIdProofUrl) keys.push(v.associationIdProofUrl);
      if (v.profilePhoto) keys.push(v.profilePhoto);
    }

    return [...new Set(keys)];
  }

  updateRefreshToken(id: string, refreshTokenHash: string | null): Promise<IVendor | null> {
    return VendorModel.findByIdAndUpdate(
      id,
      { refreshTokenHash },
      { returnDocument: 'after' },
    ).exec();
  }

  findByIdWithRefreshToken(id: string): Promise<IVendor | null> {
    return VendorModel.findById(id).select('+refreshTokenHash').exec();
  }

  addFcmToken(vendorId: string, token: string): Promise<unknown> {
    return VendorModel.updateOne({ _id: vendorId }, { $addToSet: { fcmTokens: token } }).exec();
  }

  removeFcmToken(vendorId: string, token: string): Promise<unknown> {
    return VendorModel.updateOne({ _id: vendorId }, { $pull: { fcmTokens: token } }).exec();
  }

  clearFcmTokens(vendorId: string): Promise<unknown> {
    return VendorModel.updateOne({ _id: vendorId }, { $set: { fcmTokens: [] } }).exec();
  }

  updateProfile(
    id: string,
    data: { ownerName?: string; email?: string; profilePhoto?: string },
    session?: ClientSession,
  ): Promise<IVendor | null> {
    return VendorModel.findByIdAndUpdate(
      id,
      { $set: data },
      { returnDocument: 'after', session },
    ).exec();
  }
}
