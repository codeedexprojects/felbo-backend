import { IssueRepository } from './issue.repository';
import { PopulatedBookingIssue } from './issue.repository';
import { IBookingIssue } from './issue.model';
import {
  ListIssuesFilter,
  ListIssuesResponse,
  IssueDTO,
  IssueDetailDTO,
  UpdateIssueStatusInput,
  CreateIssueInput,
} from './issue.types';
import { NotFoundError, ConflictError, ValidationError } from '../../shared/errors';
import VendorService from '../vendor/vendor.service';
import ShopService from '../shop/shop.service';
import PaymentService from '../payment/payment.service';

const MAX_DISTANCE_METERS = 500;

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
    private readonly vendorService: VendorService,
    private readonly shopService: ShopService,
    private readonly paymentService: PaymentService,
  ) {}

  async listIssues(filter: ListIssuesFilter): Promise<ListIssuesResponse> {
    const { issues, total } = await this.issueRepository.findAll(filter);
    const counts = await this.issueRepository.getStatusCounts();

    return {
      issues: issues.map(this.toDTO),
      total,
      page: filter.page,
      limit: filter.limit,
      totalPages: Math.ceil(total / filter.limit),
      counts,
    };
  }

  async createIssue(input: CreateIssueInput, userId: string): Promise<IssueDetailDTO> {
    const shop = await this.shopService.getShopById(input.shopId);

    const [shopLng, shopLat] = shop.location.coordinates;
    const distance = haversineMeters(
      input.userLocation.lat,
      input.userLocation.lng,
      shopLat,
      shopLng,
    );

    if (distance > MAX_DISTANCE_METERS) {
      throw new ValidationError(
        `You must be within 500m of the shop to raise an issue. Your distance: ${Math.round(distance)}m.`,
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
      photoUrl: input.photoUrl,
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
    if (issue.refundStatus === 'ISSUED')
      throw new ConflictError('Refund has already been processed.');
    if (!issue.razorpayPaymentId) throw new ValidationError('No payment linked to this issue.');

    const refundId = await this.paymentService.refundIssuePayment(issue.razorpayPaymentId);
    await this.issueRepository.updateRefundStatus(issueId, 'ISSUED', refundId);
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
    return {
      id: issue._id.toString(),
      bookingId: issue.bookingId.toString(),
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
      refundStatus: issue.refundStatus,
      refundId: issue.refundId ?? null,
      razorpayPaymentId: issue.razorpayPaymentId ?? null,
      userLocation: issue.userLocation ?? null,
      photoUrl: issue.photoUrl ?? null,
      reviewedBy: issue.reviewedBy?.toString() ?? null,
      adminNote: issue.adminNote ?? null,
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
    };
  }

  private toDTO(issue: IBookingIssue): IssueDTO {
    return {
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
}
