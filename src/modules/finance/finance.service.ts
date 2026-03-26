import { FinanceRepository } from './finance.repository';
import {
  FinanceSummaryDto,
  RevenueChartPointDto,
  VendorRevenueTableParams,
  VendorRevenueTableResponse,
  RefundHistoryParams,
  RefundHistoryResponse,
  CoinRefundHistoryResponse,
  AssocFinanceSummaryDto,
  IndependentRegistrationListParams,
  IndependentRegistrationListResponse,
} from './finance.types';
import VendorService from '../vendor/vendor.service';
import ShopService from '../shop/shop.service';
import { config } from '../../shared/config/config.service';

export class FinanceService {
  constructor(
    private readonly financeRepository: FinanceRepository,
    private readonly getVendorService: () => VendorService,
    private readonly getShopService: () => ShopService,
  ) {}

  private get vendorService(): VendorService {
    return this.getVendorService();
  }

  private get shopService(): ShopService {
    return this.getShopService();
  }

  private getRazorpayFeeRate(): number {
    const charge = config.razorpay.chargePercentage;
    const tax = config.razorpay.taxPercentage;
    const totalPercent = charge + (charge * tax) / 100;
    return totalPercent / 100;
  }

  async getSummary(): Promise<FinanceSummaryDto> {
    const razorpayFeeRate = this.getRazorpayFeeRate();

    const [stats, vendorIds, refundStats, registrationRevenue] = await Promise.all([
      this.financeRepository.getSummaryStats(razorpayFeeRate),
      this.vendorService.getAssociationVendorIds(),
      this.financeRepository.getRefundStats(),
      this.financeRepository.getRegistrationRevenueStats(razorpayFeeRate),
    ]);

    const shopIds = await this.shopService.getShopIdsByVendorIds(
      vendorIds.map((id) => id.toString()),
    );

    const assocBookingCount = await this.financeRepository.getAssocBookingCount(shopIds);

    return {
      today: {
        revenue: Number((stats.today.revenue + registrationRevenue.today).toFixed(2)),
        bookingCount: stats.today.bookingCount,
      },
      thisWeek: {
        revenue: Number((stats.thisWeek.revenue + registrationRevenue.thisWeek).toFixed(2)),
        bookingCount: stats.thisWeek.bookingCount,
      },
      thisMonth: {
        revenue: Number((stats.thisMonth.revenue + registrationRevenue.thisMonth).toFixed(2)),
        bookingCount: stats.thisMonth.bookingCount,
      },
      total: {
        revenue: Number((stats.total.revenue + registrationRevenue.total).toFixed(2)),
        bookingCount: stats.total.bookingCount,
      },
      associationCommission: assocBookingCount * 2,
      refundStats,
      registrationRevenue,
    };
  }

  async getTodayRegistrationRevenue(): Promise<number> {
    const razorpayFeeRate = this.getRazorpayFeeRate();
    const stats = await this.financeRepository.getRegistrationRevenueStats(razorpayFeeRate);
    return stats.today;
  }

  async getRevenueChart(from: Date, to: Date): Promise<RevenueChartPointDto[]> {
    const razorpayFeeRate = this.getRazorpayFeeRate();
    return this.financeRepository.getRevenueChartData(from, to, razorpayFeeRate);
  }

  async getVendorRevenueTable(
    params: VendorRevenueTableParams,
  ): Promise<VendorRevenueTableResponse> {
    const razorpayFeeRate = this.getRazorpayFeeRate();
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
    const razorpayFeeRate = this.getRazorpayFeeRate();
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
    const razorpayFeeRate = this.getRazorpayFeeRate();
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

  async getIndependentRegistrationList(
    params: IndependentRegistrationListParams,
  ): Promise<IndependentRegistrationListResponse> {
    const razorpayFeeRate = this.getRazorpayFeeRate();
    const { registrations, total } = await this.financeRepository.getIndependentRegistrationList(
      params,
      razorpayFeeRate,
    );
    return {
      registrations,
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit),
    };
  }

  async getRefundHistory(
    params: RefundHistoryParams,
  ): Promise<RefundHistoryResponse | CoinRefundHistoryResponse> {
    if (params.type === 'COIN') {
      const { refunds, total } = await this.financeRepository.getCoinRefundHistory(params);
      return {
        refunds,
        total,
        page: params.page,
        limit: params.limit,
        totalPages: Math.ceil(total / params.limit),
      };
    }

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

    // Combined cash refunds: merge ISSUE + CANCELLATION, sort, paginate in memory
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
