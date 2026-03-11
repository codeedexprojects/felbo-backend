import { PayoutRepository } from './payout.repository';
import {
  PayoutDashboardDto,
  PayoutItemDto,
  PayoutAssocSummaryDto,
  PayoutListParams,
  PayoutListResponse,
  mapPayoutToDto,
} from './payout.types';
import { ConflictError, NotFoundError } from '../../shared/errors';
import VendorService from '../vendor/vendor.service';
import ShopService from '../shop/shop.service';

export class PayoutService {
  constructor(
    private readonly payoutRepository: PayoutRepository,
    private readonly getVendorService: () => VendorService,
    private readonly getShopService: () => ShopService,
  ) {}

  private get vendorService(): VendorService {
    return this.getVendorService();
  }

  private get shopService(): ShopService {
    return this.getShopService();
  }

  private async resolveShopIds() {
    const vendorIds = await this.vendorService.getAssociationVendorIds();
    return this.shopService.getShopIdsByVendorIds(vendorIds);
  }

  async getDashboard(): Promise<PayoutDashboardDto> {
    const shopIds = await this.resolveShopIds();

    const [bookingCount, acceptedTotals] = await Promise.all([
      this.payoutRepository.getAssocBookingCount(shopIds),
      this.payoutRepository.getAcceptedPayoutTotals(),
    ]);

    const totalCommission = bookingCount * 2;
    const owedAmount = totalCommission - acceptedTotals.totalPaid;

    return {
      owedAmount,
      totalCommission,
      totalPaid: acceptedTotals.totalPaid,
      bookingCount,
      lastPayoutDate: acceptedTotals.lastPayoutDate,
    };
  }

  async createPayout(requestedBy: string): Promise<PayoutItemDto> {
    const existing = await this.payoutRepository.findPending();
    if (existing) {
      throw new ConflictError('A payout request is already pending.');
    }

    const shopIds = await this.resolveShopIds();

    const [bookingCount, acceptedTotals] = await Promise.all([
      this.payoutRepository.getAssocBookingCount(shopIds),
      this.payoutRepository.getAcceptedPayoutTotals(),
    ]);

    const owedAmount = bookingCount * 2 - acceptedTotals.totalPaid;

    if (owedAmount <= 0) {
      throw new ConflictError('No commission is currently owed.');
    }

    const payout = await this.payoutRepository.create({
      amount: owedAmount,
      bookingCount,
      requestedBy,
    });

    return mapPayoutToDto(payout);
  }

  async getAssocSummary(): Promise<PayoutAssocSummaryDto> {
    const shopIds = await this.resolveShopIds();

    const [bookingCount, pendingAmount] = await Promise.all([
      this.payoutRepository.getAssocBookingCount(shopIds),
      this.payoutRepository.getPendingAmount(),
    ]);

    return { pendingAmount, bookingCount };
  }

  async acceptPayout(id: string, processedBy: string): Promise<PayoutItemDto> {
    const existing = await this.payoutRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Payout request not found.');
    }
    if (existing.status !== 'PENDING') {
      throw new ConflictError('Payout is not in PENDING status.');
    }

    const updated = await this.payoutRepository.acceptById(id, processedBy);
    return mapPayoutToDto(updated!);
  }

  async rejectPayout(
    id: string,
    processedBy: string,
    rejectionReason: string,
  ): Promise<PayoutItemDto> {
    const existing = await this.payoutRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Payout request not found.');
    }
    if (existing.status !== 'PENDING') {
      throw new ConflictError('Payout is not in PENDING status.');
    }

    const updated = await this.payoutRepository.rejectById(id, processedBy, rejectionReason);
    return mapPayoutToDto(updated!);
  }

  async listPayouts(params: PayoutListParams): Promise<PayoutListResponse> {
    const { payouts, total } = await this.payoutRepository.findAll(params);
    return {
      payouts: payouts.map(mapPayoutToDto),
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit),
    };
  }
}
