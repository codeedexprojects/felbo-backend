import { BookingIssueModel, IBookingIssue } from './issue.model';
import { ListIssuesFilter } from './issue.types';

export interface PopulatedBookingIssue extends Omit<
  IBookingIssue,
  'userId' | 'vendorId' | 'shopId'
> {
  userId: { _id: { toString(): string }; name: string; phone: string } | null;
  vendorId: { _id: { toString(): string }; ownerName: string; phone: string } | null;
  shopId: {
    _id: { toString(): string };
    name: string;
    phone: string;
    address: { area: string; city: string };
  } | null;
}

export class IssueRepository {
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

  async findById(id: string): Promise<PopulatedBookingIssue | null> {
    return BookingIssueModel.findById(id)
      .populate<{ userId: PopulatedBookingIssue['userId'] }>('userId', 'name phone')
      .populate<{ vendorId: PopulatedBookingIssue['vendorId'] }>('vendorId', 'ownerName phone')
      .populate<{
        shopId: PopulatedBookingIssue['shopId'];
      }>('shopId', 'name phone address.area address.city')
      .lean()
      .exec() as Promise<PopulatedBookingIssue | null>;
  }
}
