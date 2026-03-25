import { IssueRepository } from './issue.repository';
import { PopulatedBookingIssue } from './issue.types';
import { IBookingIssue } from './issue.model';
import {
  ListIssuesFilter,
  ListIssuesResponse,
  IssueDTO,
  IssueDetailDTO,
  UpdateIssueStatusInput,
  CreateIssueInput,
  UserIssueListResponse,
  UserIssueListItemDTO,
  UserIssueListItem,
} from './issue.types';
import { NotFoundError, ConflictError, ValidationError } from '../../shared/errors';
import VendorService from '../vendor/vendor.service';
import ShopService from '../shop/shop.service';
import { BookingService } from '../booking/booking.service';
import { ConfigService } from '../config/config.service';
import { CONFIG_KEYS } from '../../shared/config/config.keys';

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export class IssueService {
  constructor(
    private readonly issueRepository: IssueRepository,
    private readonly getVendorService: () => VendorService,
    private readonly getShopService: () => ShopService,
    private readonly getBookingService: () => BookingService,
    private readonly configService: ConfigService,
  ) {}

  private get vendorService(): VendorService {
    return this.getVendorService();
  }

  private get shopService(): ShopService {
    return this.getShopService();
  }

  private get bookingService(): BookingService {
    return this.getBookingService();
  }

  async listIssues(filter: ListIssuesFilter): Promise<ListIssuesResponse> {
    const { issues, total } = await this.issueRepository.findAll(filter);
    const counts = await this.issueRepository.getStatusCounts();

    return {
      issues: issues.map((issue, i) =>
        this.toDTO(issue, total - (filter.page - 1) * filter.limit - i),
      ),
      total,
      page: filter.page,
      limit: filter.limit,
      totalPages: Math.ceil(total / filter.limit),
      counts,
    };
  }

  async createIssue(input: CreateIssueInput, userId: string): Promise<IssueDetailDTO> {
    // Verify booking exists, belongs to this user, and matches the shop
    await this.bookingService.verifyBookingForIssue(input.bookingId, userId, input.shopId);

    // Prevent duplicate issues for the same booking
    const alreadyExists = await this.issueRepository.existsByBookingId(input.bookingId);
    if (alreadyExists) {
      throw new ConflictError('An issue has already been raised for this booking.');
    }

    const shop = await this.shopService.getShopById(input.shopId);

    const [shopLng, shopLat] = shop.location.coordinates;
    const distance = haversineMeters(
      input.userLocation.lat,
      input.userLocation.lng,
      shopLat,
      shopLng,
    );

    const issueMaxDistance = await this.configService.getValueAsNumber(
      CONFIG_KEYS.ISSUE_MAX_DISTANCE_METERS,
    );
    if (distance > issueMaxDistance) {
      throw new ValidationError(
        `You must be within ${issueMaxDistance}m of the shop to raise an issue. Your distance: ${Math.round(distance)}m.`,
      );
    }

    const issue = await this.issueRepository.create({
      bookingId: input.bookingId,
      userId,
      shopId: input.shopId,
      vendorId: shop.vendorId,
      type: input.type,
      description: input.description,
      userLocation: input.userLocation,
      razorpayPaymentId: input.razorpayPaymentId,
    });

    const populated = await this.issueRepository.findById(issue._id.toString());
    return this.toDetailDTO(populated!);
  }

  async processRefund(issueId: string): Promise<void> {
    const issue = await this.issueRepository.findById(issueId);
    if (!issue) throw new NotFoundError('Issue not found.');
    if (issue.status !== 'RESOLVED')
      throw new ConflictError('Refund is only allowed for resolved issues.');
    if (issue.refundStatus === 'ISSUED' || issue.refundStatus === 'COMPLETED')
      throw new ConflictError('Refund has already been processed.');

    if (!issue.bookingId) throw new NotFoundError('Booking not found for this issue.');

    const paymentDetails = await this.bookingService.getBookingPaymentDetails(
      issue.bookingId._id.toString(),
    );

    if (paymentDetails.paymentMethod === 'FELBO_COINS') {
      if (!issue.userId) throw new ValidationError('User not linked to this issue.');
      await this.bookingService.processIssueCoinsRefund(
        issue.bookingId._id.toString(),
        issue.userId._id.toString(),
      );
      await this.issueRepository.updateRefundStatus(issueId, 'ISSUED');
      return;
    }

    const razorpayPaymentId = issue.razorpayPaymentId ?? paymentDetails.paymentId;
    if (!razorpayPaymentId) throw new ValidationError('No payment linked to this issue.');

    if (!paymentDetails.advancePaid)
      throw new ConflictError('No advance payment to refund for this booking.');

    const refundId = await this.bookingService.refundIssuePayment(
      razorpayPaymentId,
      paymentDetails.advancePaid * 100,
    );
    await this.issueRepository.updateRefundStatus(issueId, 'ISSUED', refundId);
  }

  async markIssueRefundCompleted(refundId: string): Promise<void> {
    await this.issueRepository.markRefundCompleted(refundId);
  }

  async flagVendorForIssue(issueId: string): Promise<{ alreadyFlagged: boolean }> {
    const issue = await this.issueRepository.findById(issueId);
    if (!issue) throw new NotFoundError('Issue not found.');
    if (!issue.vendorId) throw new NotFoundError('Vendor not found for this issue.');
    if (issue.vendorId.isFlagged) return { alreadyFlagged: true };
    await this.vendorService.flagVendor(issue.vendorId._id.toString());
    return { alreadyFlagged: false };
  }

  async updateIssueStatus(
    id: string,
    input: UpdateIssueStatusInput,
    adminId: string,
  ): Promise<void> {
    const issue = await this.issueRepository.findById(id);
    if (!issue) throw new NotFoundError('Issue not found.');

    if (issue.status !== 'OPEN') {
      throw new ConflictError('Issue is already closed.');
    }

    await this.issueRepository.updateStatus(id, input.status, adminId, input.reason);
  }

  async getIssueById(id: string): Promise<IssueDetailDTO> {
    const issue = await this.issueRepository.findById(id);
    if (!issue) throw new NotFoundError('Issue not found');
    return this.toDetailDTO(issue);
  }

  private toDetailDTO(issue: PopulatedBookingIssue): IssueDetailDTO {
    const booking = issue.bookingId;
    const paymentMethod = booking?.paymentMethod ?? null;

    return {
      id: issue._id.toString(),
      bookingNumber: booking?.bookingNumber ?? null,
      user: issue.userId
        ? { id: issue.userId._id.toString(), name: issue.userId.name, phone: issue.userId.phone }
        : null,
      vendor: issue.vendorId
        ? {
            id: issue.vendorId._id.toString(),
            name: issue.vendorId.ownerName,
            phone: issue.vendorId.phone,
            isFlagged: issue.vendorId.isFlagged,
          }
        : null,
      shop: issue.shopId
        ? {
            id: issue.shopId._id.toString(),
            name: issue.shopId.name,
            phone: issue.shopId.phone,
            address: { area: issue.shopId.address.area, city: issue.shopId.address.city },
          }
        : null,
      barberId: issue.barberId?.toString() ?? null,
      type: issue.type,
      description: issue.description,
      status: issue.status,
      refund: {
        status: issue.refundStatus,
        method: paymentMethod,
        amount: paymentMethod === 'RAZORPAY' ? (booking?.advancePaid ?? null) : null,
        coins: paymentMethod === 'FELBO_COINS' ? (booking?.advancePaid ?? null) : null,
        refundId: issue.refundId ?? null,
      },
      userLocation: issue.userLocation ?? null,
      reviewedBy: issue.reviewedBy?.toString() ?? null,
      adminNote: issue.adminNote ?? null,
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
    };
  }

  private toDTO(issue: IBookingIssue, slNo: number): IssueDTO {
    return {
      slNo,
      id: issue._id.toString(),
      bookingId: issue.bookingId.toString(),
      userId: issue.userId.toString(),
      shopId: issue.shopId.toString(),
      vendorId: issue.vendorId.toString(),
      barberId: issue.barberId?.toString() ?? null,
      type: issue.type,
      description: issue.description,
      status: issue.status,
      reviewedBy: issue.reviewedBy?.toString() ?? null,
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
    };
  }

  async getRecentIssuesByUserId(
    userId: string,
  ): Promise<{ id: string; type: string; description: string; status: string; createdAt: Date }[]> {
    const issues = await this.issueRepository.findRecentByUserId(userId, 20);
    return issues.map((i) => ({
      id: i._id.toString(),
      type: i.type,
      description: i.description,
      status: i.status,
      createdAt: i.createdAt,
    }));
  }

  async getRecentIssuesForDashboard(limit: number): Promise<
    {
      id: string;
      userName: string;
      userProfileUrl: string | null;
      reason: string;
      status: 'OPEN' | 'RESOLVED' | 'REJECTED';
      createdAt: Date;
    }[]
  > {
    const issues = await this.issueRepository.findRecentWithUserPopulated(limit);
    return issues.map((issue) => ({
      id: (issue._id as { toString(): string }).toString(),
      userName: issue.userId?.name ?? 'Unknown',
      userProfileUrl: issue.userId?.profileUrl ?? null,
      reason: issue.description,
      status: issue.status,
      createdAt: issue.createdAt,
    }));
  }

  async getUserIssues(
    userId: string,
    page: number,
    limit: number,
    status?: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<UserIssueListResponse> {
    const { issues, total } = await this.issueRepository.findByUserIdPaginated(
      userId,
      page,
      limit,
      status,
      startDate,
      endDate,
    );

    return {
      issues: issues.map((i: UserIssueListItem): UserIssueListItemDTO => {
        const coords = i.shopId?.location?.coordinates;
        return {
          id: i._id.toString(),
          type: i.type,
          status: i.status,
          description: i.description,
          shopName: i.shopId?.name ?? null,
          shopAddress: i.shopId
            ? { area: i.shopId.address.area, city: i.shopId.address.city }
            : null,
          shopLocation: coords ? { lat: coords[1], lng: coords[0] } : null,
          bookingNumber: i.bookingId?.bookingNumber ?? null,
          refundStatus: i.refundStatus,
          refundAmount: i.bookingId?.advancePaid ?? null,
          createdAt: i.createdAt,
        };
      }),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  existsByBookingId(bookingId: string): Promise<boolean> {
    return this.issueRepository.existsByBookingId(bookingId);
  }
}
