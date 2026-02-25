import { BookingIssueModel, IBookingIssue } from './issue.model';
import { ListIssuesFilter, CreateIssueInput, PopulatedBookingIssue } from './issue.types';

export class IssueRepository {
  updateRefundStatus(
    id: string,
    refundStatus: 'ISSUED' | 'FAILED',
    refundId?: string,
  ): Promise<IBookingIssue | null> {
    const update: Record<string, unknown> = { refundStatus };
    if (refundId) update.refundId = refundId;
    return BookingIssueModel.findByIdAndUpdate(id, update, { returnDocument: 'after' }).exec();
  }

  async create(data: {
    bookingId: string;
    userId: string;
    shopId: string;
    vendorId: string;
    type: CreateIssueInput['type'];
    description: string;
    userLocation: { lat: number; lng: number };
    photoUrl?: string;
    razorpayPaymentId?: string;
  }): Promise<IBookingIssue> {
    const issue = await BookingIssueModel.create(data);
    return issue;
  }

  async findAll(filter: ListIssuesFilter): Promise<{ issues: IBookingIssue[]; total: number }> {
    const query: Record<string, unknown> = {};
    if (filter.status) query.status = filter.status;
    if (filter.type) query.type = filter.type;

    const skip = (filter.page - 1) * filter.limit;

    const [issues, total] = await Promise.all([
      BookingIssueModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(filter.limit).exec(),
      BookingIssueModel.countDocuments(query).exec(),
    ]);

    return { issues, total };
  }

  findRecentByUserId(userId: string, limit: number = 20): Promise<IBookingIssue[]> {
    return BookingIssueModel.find({ userId }).sort({ createdAt: -1 }).limit(limit).exec();
  }

  async getStatusCounts(): Promise<{
    total: number;
    open: number;
    resolved: number;
    rejected: number;
  }> {
    const total = await BookingIssueModel.countDocuments().exec();
    const open = await BookingIssueModel.countDocuments({ status: 'OPEN' }).exec();
    const resolved = await BookingIssueModel.countDocuments({ status: 'RESOLVED' }).exec();
    const rejected = await BookingIssueModel.countDocuments({ status: 'REJECTED' }).exec();

    return { total, open, resolved, rejected };
  }

  updateStatus(
    id: string,
    status: 'RESOLVED' | 'REJECTED',
    adminId: string,
    adminNote: string,
  ): Promise<IBookingIssue | null> {
    const update: Record<string, unknown> = { status, reviewedBy: adminId, adminNote };
    return BookingIssueModel.findByIdAndUpdate(id, update, { returnDocument: 'after' }).exec();
  }

  async findById(id: string): Promise<PopulatedBookingIssue | null> {
    return BookingIssueModel.findById(id)
      .populate<{ userId: PopulatedBookingIssue['userId'] }>('userId', 'name phone')
      .populate<{ vendorId: PopulatedBookingIssue['vendorId'] }>(
        'vendorId',
        'ownerName phone isFlagged',
      )
      .populate<{
        shopId: PopulatedBookingIssue['shopId'];
      }>('shopId', 'name phone address.area address.city')
      .lean()
      .exec() as Promise<PopulatedBookingIssue | null>;
  }
}
