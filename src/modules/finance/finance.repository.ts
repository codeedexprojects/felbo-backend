import { Types, PipelineStage } from 'mongoose';
import { toZonedTime } from 'date-fns-tz';
import { BookingModel } from '../booking/booking.model';
import { BookingIssueModel } from '../issue/issue.model';
import {
  PAID_STATUSES,
  FinanceSummaryPeriodDto,
  RevenueChartPointDto,
  VendorRevenueTableParams,
  VendorRevenueRowDto,
  RefundStatsDto,
  RefundHistoryItemDto,
  RefundHistoryParams,
  AssocFinanceSummaryDto,
} from './finance.types';

const IST_TIMEZONE = 'Asia/Kolkata';

function getIstMidnight(date: Date): Date {
  const ist = toZonedTime(date, IST_TIMEZONE);
  return new Date(Date.UTC(ist.getFullYear(), ist.getMonth(), ist.getDate()));
}

function getTodayStart(): Date {
  return getIstMidnight(new Date());
}

function getWeekStart(): Date {
  const ist = toZonedTime(new Date(), IST_TIMEZONE);
  const dayOfWeek = ist.getDay(); // 0=Sun
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(ist);
  monday.setDate(monday.getDate() - daysToMonday);
  return new Date(Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate()));
}

function getMonthStart(): Date {
  const ist = toZonedTime(new Date(), IST_TIMEZONE);
  return new Date(Date.UTC(ist.getFullYear(), ist.getMonth(), 1));
}

function facetBranch(dateGte?: Date): PipelineStage.FacetPipelineStage[] {
  const pipeline: PipelineStage.FacetPipelineStage[] = [];
  if (dateGte) {
    pipeline.push({ $match: { createdAt: { $gte: dateGte } } });
  }
  pipeline.push({
    $group: {
      _id: null,
      revenue: { $sum: '$advancePaid' },
      bookingCount: { $sum: 1 },
    },
  });
  return pipeline;
}

function extractPeriod(
  raw: Array<{ revenue: number; bookingCount: number }>,
): FinanceSummaryPeriodDto {
  return raw[0] ?? { revenue: 0, bookingCount: 0 };
}

export class FinanceRepository {
  async getSummaryStats(): Promise<{
    today: FinanceSummaryPeriodDto;
    thisWeek: FinanceSummaryPeriodDto;
    thisMonth: FinanceSummaryPeriodDto;
    total: FinanceSummaryPeriodDto;
  }> {
    const todayStart = getTodayStart();
    const weekStart = getWeekStart();
    const monthStart = getMonthStart();

    const [result] = await BookingModel.aggregate([
      { $match: { status: { $in: [...PAID_STATUSES] } } },
      {
        $facet: {
          today: facetBranch(todayStart),
          thisWeek: facetBranch(weekStart),
          thisMonth: facetBranch(monthStart),
          total: facetBranch(),
        },
      },
    ]).exec();

    return {
      today: extractPeriod(result.today),
      thisWeek: extractPeriod(result.thisWeek),
      thisMonth: extractPeriod(result.thisMonth),
      total: extractPeriod(result.total),
    };
  }

  async getAssocBookingCount(shopIds: string[]): Promise<number> {
    return BookingModel.countDocuments({
      shopId: { $in: shopIds.map((id) => new Types.ObjectId(id)) },
      status: { $in: [...PAID_STATUSES] },
    }).exec();
  }

  async getRevenueChartData(from: Date, to: Date): Promise<RevenueChartPointDto[]> {
    const results = await BookingModel.aggregate([
      {
        $match: {
          status: { $in: [...PAID_STATUSES] },
          createdAt: { $gte: from, $lte: to },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt',
              timezone: '+05:30',
            },
          },
          revenue: { $sum: '$advancePaid' },
          bookingCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, date: '$_id', revenue: 1, bookingCount: 1 } },
    ]).exec();

    return results as RevenueChartPointDto[];
  }

  async getVendorRevenueTable(
    params: VendorRevenueTableParams,
  ): Promise<{ vendors: VendorRevenueRowDto[]; total: number }> {
    const { from, to, search, sortOrder, minRevenue, maxRevenue, page, limit } = params;
    const skip = (page - 1) * limit;
    const sortDir = sortOrder === 'asc' ? 1 : -1;

    const pipeline: PipelineStage[] = [
      {
        $match: {
          status: { $in: [...PAID_STATUSES] },
          createdAt: { $gte: from, $lte: to },
        },
      },
      {
        $group: {
          _id: '$shopId',
          revenue: { $sum: '$advancePaid' },
          bookingCount: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'shops',
          localField: '_id',
          foreignField: '_id',
          pipeline: [{ $project: { vendorId: 1 } }],
          as: 'shop',
        },
      },
      { $unwind: '$shop' },
      {
        $group: {
          _id: '$shop.vendorId',
          revenue: { $sum: '$revenue' },
          bookingCount: { $sum: '$bookingCount' },
          shopCount: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'vendors',
          localField: '_id',
          foreignField: '_id',
          pipeline: [{ $project: { ownerName: 1, phone: 1, registrationType: 1 } }],
          as: 'vendor',
        },
      },
      { $unwind: '$vendor' },
    ];

    if (search) {
      const regex = new RegExp(search, 'i');
      pipeline.push({
        $match: {
          $or: [{ 'vendor.ownerName': { $regex: regex } }, { 'vendor.phone': { $regex: regex } }],
        },
      });
    }

    if (minRevenue !== undefined || maxRevenue !== undefined) {
      const revenueFilter: Record<string, number> = {};
      if (minRevenue !== undefined) revenueFilter.$gte = minRevenue;
      if (maxRevenue !== undefined) revenueFilter.$lte = maxRevenue;
      pipeline.push({ $match: { revenue: revenueFilter } });
    }

    pipeline.push({
      $facet: {
        data: [
          { $sort: { revenue: sortDir } },
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              _id: 0,
              vendorId: { $toString: '$_id' },
              vendorName: '$vendor.ownerName',
              vendorPhone: '$vendor.phone',
              registrationType: '$vendor.registrationType',
              shopCount: 1,
              bookingCount: 1,
              revenue: 1,
            },
          },
        ],
        total: [{ $count: 'count' }],
      },
    });

    const [result] = await BookingModel.aggregate(pipeline).exec();

    return {
      vendors: (result?.data ?? []) as VendorRevenueRowDto[],
      total: result?.total?.[0]?.count ?? 0,
    };
  }

  async getRefundStats(): Promise<RefundStatsDto> {
    const monthStart = getMonthStart();

    // Issue refunds: sum advancePaid from linked bookings where refundStatus = 'ISSUED'
    const [issueResult] = await BookingIssueModel.aggregate([
      { $match: { refundStatus: 'ISSUED' } },
      {
        $lookup: {
          from: 'bookings',
          localField: 'bookingId',
          foreignField: '_id',
          pipeline: [{ $project: { advancePaid: 1 } }],
          as: 'booking',
        },
      },
      { $unwind: '$booking' },
      {
        $facet: {
          total: [{ $group: { _id: null, amount: { $sum: '$booking.advancePaid' } } }],
          thisMonth: [
            { $match: { updatedAt: { $gte: monthStart } } },
            { $group: { _id: null, amount: { $sum: '$booking.advancePaid' } } },
          ],
        },
      },
    ]).exec();

    // Cancellation refunds: sum refundAmount where refundStatus = 'COMPLETED'
    const [cancelResult] = await BookingModel.aggregate([
      { $match: { 'cancellation.refundStatus': 'COMPLETED' } },
      {
        $facet: {
          total: [{ $group: { _id: null, amount: { $sum: '$cancellation.refundAmount' } } }],
          thisMonth: [
            { $match: { 'cancellation.cancelledAt': { $gte: monthStart } } },
            { $group: { _id: null, amount: { $sum: '$cancellation.refundAmount' } } },
          ],
        },
      },
    ]).exec();

    const issueTotal: number = issueResult?.total?.[0]?.amount ?? 0;
    const issueThisMonth: number = issueResult?.thisMonth?.[0]?.amount ?? 0;
    const cancelTotal: number = cancelResult?.total?.[0]?.amount ?? 0;
    const cancelThisMonth: number = cancelResult?.thisMonth?.[0]?.amount ?? 0;

    return {
      total: issueTotal + cancelTotal,
      thisMonth: issueThisMonth + cancelThisMonth,
    };
  }

  async getIssueRefundHistory(
    params: RefundHistoryParams,
  ): Promise<{ refunds: RefundHistoryItemDto[]; total: number }> {
    const matchStage: Record<string, unknown> = {
      refundStatus: { $in: ['PENDING', 'ISSUED', 'FAILED'] },
    };
    if (params.from || params.to) {
      const dateFilter: Record<string, Date> = {};
      if (params.from) dateFilter.$gte = params.from;
      if (params.to) dateFilter.$lte = params.to;
      matchStage.updatedAt = dateFilter;
    }

    const skip = (params.page - 1) * params.limit;

    const pipeline: PipelineStage[] = [
      { $match: matchStage },
      {
        $lookup: {
          from: 'bookings',
          localField: 'bookingId',
          foreignField: '_id',
          pipeline: [{ $project: { bookingNumber: 1, userName: 1, shopName: 1, advancePaid: 1 } }],
          as: 'booking',
        },
      },
      { $unwind: '$booking' },
      {
        $facet: {
          data: [
            { $sort: { updatedAt: -1 } },
            { $skip: skip },
            { $limit: params.limit },
            {
              $project: {
                _id: 0,
                type: { $literal: 'ISSUE' },
                amount: '$booking.advancePaid',
                refundStatus: '$refundStatus',
                bookingId: { $toString: '$bookingId' },
                bookingNumber: '$booking.bookingNumber',
                userName: '$booking.userName',
                shopName: '$booking.shopName',
                refundedAt: '$updatedAt',
                issueType: '$type',
              },
            },
          ],
          total: [{ $count: 'count' }],
        },
      },
    ];

    const [result] = await BookingIssueModel.aggregate(pipeline).exec();
    return {
      refunds: (result?.data ?? []) as RefundHistoryItemDto[],
      total: result?.total?.[0]?.count ?? 0,
    };
  }

  async getAssocSummaryStats(
    shopIds: string[],
  ): Promise<Omit<AssocFinanceSummaryDto, 'vendorCount'>> {
    const todayStart = getTodayStart();
    const weekStart = getWeekStart();
    const monthStart = getMonthStart();

    const objectIds = shopIds.map((id) => new Types.ObjectId(id));

    const [result] = await BookingModel.aggregate([
      { $match: { status: { $in: [...PAID_STATUSES] }, shopId: { $in: objectIds } } },
      {
        $facet: {
          today: facetBranch(todayStart),
          thisWeek: facetBranch(weekStart),
          thisMonth: facetBranch(monthStart),
          total: facetBranch(),
        },
      },
    ]).exec();

    return {
      today: extractPeriod(result.today),
      thisWeek: extractPeriod(result.thisWeek),
      thisMonth: extractPeriod(result.thisMonth),
      total: extractPeriod(result.total),
    };
  }

  async getAssocVendorRevenueTable(
    shopIds: string[],
    params: VendorRevenueTableParams,
  ): Promise<{ vendors: VendorRevenueRowDto[]; total: number }> {
    const { from, to, search, sortOrder, minRevenue, maxRevenue, page, limit } = params;
    const skip = (page - 1) * limit;
    const sortDir = sortOrder === 'asc' ? 1 : -1;

    const objectIds = shopIds.map((id) => new Types.ObjectId(id));

    const pipeline: PipelineStage[] = [
      {
        $match: {
          status: { $in: [...PAID_STATUSES] },
          createdAt: { $gte: from, $lte: to },
          shopId: { $in: objectIds },
        },
      },
      {
        $group: {
          _id: '$shopId',
          revenue: { $sum: '$advancePaid' },
          bookingCount: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'shops',
          localField: '_id',
          foreignField: '_id',
          pipeline: [{ $project: { vendorId: 1 } }],
          as: 'shop',
        },
      },
      { $unwind: '$shop' },
      {
        $group: {
          _id: '$shop.vendorId',
          revenue: { $sum: '$revenue' },
          bookingCount: { $sum: '$bookingCount' },
          shopCount: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'vendors',
          localField: '_id',
          foreignField: '_id',
          pipeline: [{ $project: { ownerName: 1, phone: 1, registrationType: 1 } }],
          as: 'vendor',
        },
      },
      { $unwind: '$vendor' },
    ];

    if (search) {
      const regex = new RegExp(search, 'i');
      pipeline.push({
        $match: {
          $or: [{ 'vendor.ownerName': { $regex: regex } }, { 'vendor.phone': { $regex: regex } }],
        },
      });
    }

    if (minRevenue !== undefined || maxRevenue !== undefined) {
      const revenueFilter: Record<string, number> = {};
      if (minRevenue !== undefined) revenueFilter.$gte = minRevenue;
      if (maxRevenue !== undefined) revenueFilter.$lte = maxRevenue;
      pipeline.push({ $match: { revenue: revenueFilter } });
    }

    pipeline.push({
      $facet: {
        data: [
          { $sort: { revenue: sortDir } },
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              _id: 0,
              vendorId: { $toString: '$_id' },
              vendorName: '$vendor.ownerName',
              vendorPhone: '$vendor.phone',
              registrationType: '$vendor.registrationType',
              shopCount: 1,
              bookingCount: 1,
              revenue: 1,
            },
          },
        ],
        total: [{ $count: 'count' }],
      },
    });

    const [result] = await BookingModel.aggregate(pipeline).exec();

    return {
      vendors: (result?.data ?? []) as VendorRevenueRowDto[],
      total: result?.total?.[0]?.count ?? 0,
    };
  }

  async getCancellationRefundHistory(
    params: RefundHistoryParams,
  ): Promise<{ refunds: RefundHistoryItemDto[]; total: number }> {
    const matchStage: Record<string, unknown> = {
      'cancellation.refundStatus': { $in: ['PENDING', 'COMPLETED'] },
    };
    if (params.from || params.to) {
      const dateFilter: Record<string, Date> = {};
      if (params.from) dateFilter.$gte = params.from;
      if (params.to) dateFilter.$lte = params.to;
      matchStage['cancellation.cancelledAt'] = dateFilter;
    }

    const skip = (params.page - 1) * params.limit;

    const pipeline: PipelineStage[] = [
      { $match: matchStage },
      {
        $facet: {
          data: [
            { $sort: { 'cancellation.cancelledAt': -1 } },
            { $skip: skip },
            { $limit: params.limit },
            {
              $project: {
                _id: 0,
                type: { $literal: 'CANCELLATION' },
                amount: '$cancellation.refundAmount',
                refundStatus: '$cancellation.refundStatus',
                bookingId: { $toString: '$_id' },
                bookingNumber: '$bookingNumber',
                userName: '$userName',
                shopName: '$shopName',
                refundedAt: '$cancellation.cancelledAt',
                reason: '$cancellation.reason',
              },
            },
          ],
          total: [{ $count: 'count' }],
        },
      },
    ];

    const [result] = await BookingModel.aggregate(pipeline).exec();
    return {
      refunds: (result?.data ?? []) as RefundHistoryItemDto[],
      total: result?.total?.[0]?.count ?? 0,
    };
  }
}
