import { FinanceRepository } from './finance.repository';
import {
  FinanceSummaryDto,
  RevenueChartPointDto,
  VendorRevenueTableParams,
  VendorRevenueTableResponse,
  RefundHistoryParams,
  RefundHistoryResponse,
  AssocFinanceSummaryDto,
} from './finance.types';
import VendorService from '../vendor/vendor.service';
import ShopService from '../shop/shop.service';
import { ConfigService } from '../config/config.service';
import { CONFIG_KEYS } from '../../shared/config/config.keys';

export class FinanceService {
  constructor(
    private readonly financeRepository: FinanceRepository,
    private readonly getVendorService: () => VendorService,
    private readonly getShopService: () => ShopService,
    private readonly configService: ConfigService,
  ) {}

  private get vendorService(): VendorService {
    return this.getVendorService();
  }

  private get shopService(): ShopService {
    return this.getShopService();
  }

  private async getRazorpayFeeRate(): Promise<number> {
    const feePercent = await this.configService.getValueAsNumber(CONFIG_KEYS.RAZORPAY_FEE_PERCENT);
    return feePercent / 100;
  }

  async getSummary(): Promise<FinanceSummaryDto> {
    const razorpayFeeRate = await this.getRazorpayFeeRate();

    const [stats, vendorIds, refundStats] = await Promise.all([
      this.financeRepository.getSummaryStats(razorpayFeeRate),
      this.vendorService.getAssociationVendorIds(),
      this.financeRepository.getRefundStats(),
    ]);

    const shopIds = await this.shopService.getShopIdsByVendorIds(
      vendorIds.map((id) => id.toString()),
    );

    const assocBookingCount = await this.financeRepository.getAssocBookingCount(shopIds);

    return {
      ...stats,
      associationCommission: assocBookingCount * 2,
      refundStats,
    };
  }

  async getRevenueChart(from: Date, to: Date): Promise<RevenueChartPointDto[]> {
    const razorpayFeeRate = await this.getRazorpayFeeRate();
    return this.financeRepository.getRevenueChartData(from, to, razorpayFeeRate);
  }

  async getVendorRevenueTable(
    params: VendorRevenueTableParams,
  ): Promise<VendorRevenueTableResponse> {
    const razorpayFeeRate = await this.getRazorpayFeeRate();
    const { vendors, total } = await this.financeRepository.getVendorRevenueTable(
      params,
      razorpayFeeRate,
    );
    return {
      vendors,
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit),
    };
  }

  async getAssocSummary(): Promise<AssocFinanceSummaryDto> {
    const razorpayFeeRate = await this.getRazorpayFeeRate();
    const vendorIds = await this.vendorService.getAssociationVendorIds();
    const shopIds = await this.shopService.getShopIdsByVendorIds(
      vendorIds.map((id) => id.toString()),
    );
    const stats = await this.financeRepository.getAssocSummaryStats(shopIds, razorpayFeeRate);
    return {
      vendorCount: vendorIds.length,
      today: { bookingCount: stats.today.bookingCount, revenue: stats.today.bookingCount * 2 },
      thisWeek: {
        bookingCount: stats.thisWeek.bookingCount,
        revenue: stats.thisWeek.bookingCount * 2,
      },
      thisMonth: {
        bookingCount: stats.thisMonth.bookingCount,
        revenue: stats.thisMonth.bookingCount * 2,
      },
      total: { bookingCount: stats.total.bookingCount, revenue: stats.total.bookingCount * 2 },
    };
  }

  async getAssocVendorRevenueTable(
    params: VendorRevenueTableParams,
  ): Promise<VendorRevenueTableResponse> {
    const razorpayFeeRate = await this.getRazorpayFeeRate();
    const vendorIds = await this.vendorService.getAssociationVendorIds();
    const shopIds = await this.shopService.getShopIdsByVendorIds(
      vendorIds.map((id) => id.toString()),
    );
    const { vendors, total } = await this.financeRepository.getAssocVendorRevenueTable(
      shopIds,
      params,
      razorpayFeeRate,
    );
    return {
      vendors,
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit),
    };
  }

  async getRefundHistory(params: RefundHistoryParams): Promise<RefundHistoryResponse> {
    if (params.type === 'ISSUE') {
      const { refunds, total } = await this.financeRepository.getIssueRefundHistory(params);
      return {
        refunds,
        total,
        page: params.page,
        limit: params.limit,
        totalPages: Math.ceil(total / params.limit),
      };
    }

    if (params.type === 'CANCELLATION') {
      const { refunds, total } = await this.financeRepository.getCancellationRefundHistory(params);
      return {
        refunds,
        total,
        page: params.page,
        limit: params.limit,
        totalPages: Math.ceil(total / params.limit),
      };
    }

    // Combined: fetch both (no DB-level pagination), merge, sort, then paginate in memory
    const [issueResult, cancelResult] = await Promise.all([
      this.financeRepository.getIssueRefundHistory({ ...params, page: 1, limit: 10_000 }),
      this.financeRepository.getCancellationRefundHistory({ ...params, page: 1, limit: 10_000 }),
    ]);

    const merged = [...issueResult.refunds, ...cancelResult.refunds].sort(
      (a, b) => new Date(b.refundedAt).getTime() - new Date(a.refundedAt).getTime(),
    );

    const total = merged.length;
    const skip = (params.page - 1) * params.limit;
    const refunds = merged.slice(skip, skip + params.limit);

    return {
      refunds,
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit),
    };
  }
}
