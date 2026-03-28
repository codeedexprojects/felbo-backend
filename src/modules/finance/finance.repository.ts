import { Types, PipelineStage } from 'mongoose';
import { toZonedTime } from 'date-fns-tz';
import { BookingModel } from '../booking/booking.model';
import { BookingIssueModel } from '../issue/issue.model';
import { VendorModel } from '../vendor/vendor.model';
import { FelboCoinTransactionModel } from '../felbocoin/felbocoin.model';
import {
  PAID_STATUSES,
  COMMISSION_STATUSES,
  FinanceSummaryPeriodDto,
  RevenueChartPointDto,
  VendorRevenueTableParams,
  VendorRevenueRowDto,
  RefundStatsDto,
  RefundHistoryItemDto,
  RefundHistoryParams,
  CoinRefundHistoryItemDto,
  AssocFinanceSummaryDto,
  RegistrationRevenueSummaryDto,
  IndependentRegistrationListParams,
  IndependentRegistrationRowDto,
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

/**
 * Net profit per booking (RAZORPAY only):
 *   CANCELLED_BY_VENDOR → 0 (full cash refund issued, platform neutral)
 *   otherwise → advancePaid - razorpay fee
 *
 * FelboCoin bookings are excluded upstream via paymentMethod filter.
 * Coin refunds (refundCoins) are tracked solely in the FelboCoin module.
 */
function netProfitExpr(razorpayFeeRate: number) {
  return {
    $cond: {
      if: { $eq: ['$status', 'CANCELLED_BY_VENDOR'] },
      then: 0,
      else: {
        $subtract: ['$advancePaid', { $multiply: ['$advancePaid', razorpayFeeRate] }],
      },
    },
  };
}

function facetBranch(razorpayFeeRate: number, dateGte?: Date): PipelineStage.FacetPipelineStage[] {
  const pipeline: PipelineStage.FacetPipelineStage[] = [];
  if (dateGte) {
    pipeline.push({ $match: { createdAt: { $gte: dateGte } } });
  }
  pipeline.push({
    $group: {
      _id: null,
      revenue: { $sum: netProfitExpr(razorpayFeeRate) },
      bookingCount: { $sum: 1 },
    },
  });
  pipeline.push({
    $project: {
      _id: 0,
      revenue: { $round: ['$revenue', 2] },
      bookingCount: 1,
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
  async getSummaryStats(razorpayFeeRate: number): Promise<{
    today: FinanceSummaryPeriodDto;
    thisWeek: FinanceSummaryPeriodDto;
    thisMonth: FinanceSummaryPeriodDto;
    total: FinanceSummaryPeriodDto;
  }> {
    const todayStart = getTodayStart();
    const weekStart = getWeekStart();
    const monthStart = getMonthStart();

    const [result] = await BookingModel.aggregate([
      { $match: { status: { $in: [...PAID_STATUSES] }, paymentMethod: 'RAZORPAY' } },
      {
        $facet: {
          today: facetBranch(razorpayFeeRate, todayStart),
          thisWeek: facetBranch(razorpayFeeRate, weekStart),
          thisMonth: facetBranch(razorpayFeeRate, monthStart),
          total: facetBranch(razorpayFeeRate),
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
      status: { $in: [...COMMISSION_STATUSES] },
    }).exec();
  }

  async getRegistrationRevenueStats(
    razorpayFeeRate: number,
  ): Promise<RegistrationRevenueSummaryDto> {
    const todayStart = getTodayStart();
    const weekStart = getWeekStart();
    const monthStart = getMonthStart();

    const netRegRevenue = {
      $round: [
        {
          $subtract: [
            '$registrationPayment.amount',
            { $multiply: ['$registrationPayment.amount', razorpayFeeRate] },
          ],
        },
        2,
      ],
    };

    const [result] = await VendorModel.aggregate([
      {
        $match: {
          registrationType: 'INDEPENDENT',
          registrationPayment: { $exists: true },
          verificationStatus: { $ne: 'REJECTED' },
        },
      },
      { $addFields: { netRevenue: netRegRevenue } },
      {
        $facet: {
          today: [
            { $match: { 'registrationPayment.paidAt': { $gte: todayStart } } },
            { $group: { _id: null, revenue: { $sum: '$netRevenue' } } },
          ],
          thisWeek: [
            { $match: { 'registrationPayment.paidAt': { $gte: weekStart } } },
            { $group: { _id: null, revenue: { $sum: '$netRevenue' } } },
          ],
          thisMonth: [
            { $match: { 'registrationPayment.paidAt': { $gte: monthStart } } },
            { $group: { _id: null, revenue: { $sum: '$netRevenue' } } },
          ],
          total: [{ $group: { _id: null, revenue: { $sum: '$netRevenue' } } }],
        },
      },
    ]).exec();

    return {
      today: Number((result?.today?.[0]?.revenue ?? 0).toFixed(2)),
      thisWeek: Number((result?.thisWeek?.[0]?.revenue ?? 0).toFixed(2)),
      thisMonth: Number((result?.thisMonth?.[0]?.revenue ?? 0).toFixed(2)),
      total: Number((result?.total?.[0]?.revenue ?? 0).toFixed(2)),
    };
  }

  async getRevenueChartData(
    from: Date,
    to: Date,
    razorpayFeeRate: number,
  ): Promise<RevenueChartPointDto[]> {
    const [bookingResults, regResults] = await Promise.all([
      BookingModel.aggregate([
        {
          $match: {
            status: { $in: [...PAID_STATUSES] },
            paymentMethod: 'RAZORPAY',
            createdAt: { $gte: from, $lte: to },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: '+05:30' },
            },
            revenue: { $sum: netProfitExpr(razorpayFeeRate) },
            bookingCount: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        {
          $project: {
            _id: 0,
            date: '$_id',
            revenue: { $round: ['$revenue', 2] },
            bookingCount: 1,
          },
        },
      ]).exec(),

      VendorModel.aggregate([
        {
          $match: {
            registrationType: 'INDEPENDENT',
            registrationPayment: { $exists: true },
            verificationStatus: { $ne: 'REJECTED' },
            'registrationPayment.paidAt': { $gte: from, $lte: to },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$registrationPayment.paidAt',
                timezone: '+05:30',
              },
            },
            registrationRevenue: {
              $sum: {
                $subtract: [
                  '$registrationPayment.amount',
                  { $multiply: ['$registrationPayment.amount', razorpayFeeRate] },
                ],
              },
            },
          },
        },
        { $sort: { _id: 1 } },
        {
          $project: {
            _id: 0,
            date: '$_id',
            registrationRevenue: { $round: ['$registrationRevenue', 2] },
          },
        },
      ]).exec(),
    ]);

    const regByDate = new Map<string, number>(
      (regResults as Array<{ date: string; registrationRevenue: number }>).map((r) => [
        r.date,
        r.registrationRevenue,
      ]),
    );

    const bookByDate = new Map<string, { revenue: number; bookingCount: number }>(
      (bookingResults as Array<{ date: string; revenue: number; bookingCount: number }>).map(
        (b) => [b.date, { revenue: b.revenue, bookingCount: b.bookingCount }],
      ),
    );

    const allDates = new Set([...bookByDate.keys(), ...regByDate.keys()]);

    return Array.from(allDates)
      .sort()
      .map((date) => {
        const bookingRevenue = bookByDate.get(date)?.revenue ?? 0;
        const regRevenue = regByDate.get(date) ?? 0;
        return {
          date,
          revenue: Number((bookingRevenue + regRevenue).toFixed(2)),
          bookingCount: bookByDate.get(date)?.bookingCount ?? 0,
          registrationRevenue: regRevenue,
        };
      });
  }

  async getVendorRevenueTable(
    params: VendorRevenueTableParams,
    razorpayFeeRate: number,
  ): Promise<{ vendors: VendorRevenueRowDto[]; total: number }> {
    const { from, to, search, sortOrder, minRevenue, maxRevenue, page, limit } = params;
    const skip = (page - 1) * limit;
    const sortDir = sortOrder === 'asc' ? 1 : -1;

    const pipeline: PipelineStage[] = [
      {
        $match: {
          status: { $in: [...PAID_STATUSES] },
          paymentMethod: 'RAZORPAY',
          createdAt: { $gte: from, $lte: to },
        },
      },
      {
        $group: {
          _id: '$shopId',
          revenue: { $sum: netProfitExpr(razorpayFeeRate) },
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
          pipeline: [
            { $project: { ownerName: 1, phone: 1, registrationType: 1, registrationPayment: 1 } },
          ],
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
              revenue: { $round: ['$revenue', 2] },
              registrationAmount: {
                $cond: {
                  if: { $eq: ['$vendor.registrationType', 'INDEPENDENT'] },
                  then: { $ifNull: ['$vendor.registrationPayment.amount', null] },
                  else: null,
                },
              },
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

    // Cancellation refunds: sum refundAmount where refundStatus = 'COMPLETED' (RAZORPAY only)
    const [cancelResult] = await BookingModel.aggregate([
      { $match: { 'cancellation.refundStatus': 'COMPLETED', paymentMethod: 'RAZORPAY' } },
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
    razorpayFeeRate: number,
  ): Promise<Omit<AssocFinanceSummaryDto, 'vendorCount'>> {
    const todayStart = getTodayStart();
    const weekStart = getWeekStart();
    const monthStart = getMonthStart();

    const objectIds = shopIds.map((id) => new Types.ObjectId(id));

    const [result] = await BookingModel.aggregate([
      {
        $match: {
          status: { $in: [...COMMISSION_STATUSES] },
          paymentMethod: 'RAZORPAY',
          shopId: { $in: objectIds },
        },
      },
      {
        $facet: {
          today: facetBranch(razorpayFeeRate, todayStart),
          thisWeek: facetBranch(razorpayFeeRate, weekStart),
          thisMonth: facetBranch(razorpayFeeRate, monthStart),
          total: facetBranch(razorpayFeeRate),
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
    razorpayFeeRate: number,
  ): Promise<{ vendors: VendorRevenueRowDto[]; total: number }> {
    const { from, to, search, sortOrder, minRevenue, maxRevenue, page, limit } = params;
    const skip = (page - 1) * limit;
    const sortDir = sortOrder === 'asc' ? 1 : -1;

    const objectIds = shopIds.map((id) => new Types.ObjectId(id));

    const pipeline: PipelineStage[] = [
      {
        $match: {
          status: { $in: [...COMMISSION_STATUSES] },
          paymentMethod: 'RAZORPAY',
          createdAt: { $gte: from, $lte: to },
          shopId: { $in: objectIds },
        },
      },
      {
        $group: {
          _id: '$shopId',
          revenue: { $sum: netProfitExpr(razorpayFeeRate) },
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
              revenue: { $round: ['$revenue', 2] },
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

  async getIndependentRegistrationList(
    params: IndependentRegistrationListParams,
    razorpayFeeRate: number,
  ): Promise<{ registrations: IndependentRegistrationRowDto[]; total: number }> {
    const { page, limit, search, from, to, verificationStatus } = params;
    const skip = (page - 1) * limit;

    const match: Record<string, unknown> = {
      registrationType: 'INDEPENDENT',
      registrationPayment: { $exists: true },
    };

    if (verificationStatus) {
      match.verificationStatus = verificationStatus;
    }

    if (from || to) {
      const dateFilter: Record<string, Date> = {};
      if (from) dateFilter.$gte = from;
      if (to) dateFilter.$lte = to;
      match['registrationPayment.paidAt'] = dateFilter;
    }

    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      match.$or = [
        { ownerName: { $regex: escaped, $options: 'i' } },
        { phone: { $regex: escaped, $options: 'i' } },
      ];
    }

    const [result] = await VendorModel.aggregate([
      { $match: match },
      {
        $facet: {
          data: [
            { $sort: { 'registrationPayment.paidAt': -1 } },
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                _id: 0,
                vendorId: { $toString: '$_id' },
                vendorName: '$ownerName',
                vendorPhone: '$phone',
                verificationStatus: 1,
                registrationAmount: '$registrationPayment.amount',
                netRevenue: {
                  $round: [
                    {
                      $subtract: [
                        '$registrationPayment.amount',
                        { $multiply: ['$registrationPayment.amount', razorpayFeeRate] },
                      ],
                    },
                    2,
                  ],
                },
                paidAt: '$registrationPayment.paidAt',
              },
            },
          ],
          total: [{ $count: 'count' }],
        },
      },
    ]).exec();

    return {
      registrations: (result?.data ?? []) as IndependentRegistrationRowDto[],
      total: result?.total?.[0]?.count ?? 0,
    };
  }

  async getCancellationRefundHistory(
    params: RefundHistoryParams,
  ): Promise<{ refunds: RefundHistoryItemDto[]; total: number }> {
    const matchStage: Record<string, unknown> = {
      'cancellation.refundStatus': { $in: ['PENDING', 'COMPLETED'] },
      paymentMethod: 'RAZORPAY',
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

  async getCoinRefundHistory(
    params: RefundHistoryParams,
  ): Promise<{ refunds: CoinRefundHistoryItemDto[]; total: number }> {
    const matchStage: Record<string, unknown> = {
      type: { $in: ['COIN_REVERSAL', 'COIN_REFUND'] },
    };
    if (params.from || params.to) {
      const dateFilter: Record<string, Date> = {};
      if (params.from) dateFilter.$gte = params.from;
      if (params.to) dateFilter.$lte = params.to;
      matchStage.createdAt = dateFilter;
    }

    const skip = (params.page - 1) * params.limit;

    const pipeline: PipelineStage[] = [
      { $match: matchStage },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          pipeline: [{ $project: { name: 1, phone: 1 } }],
          as: 'user',
        },
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      {
        $facet: {
          data: [
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: params.limit },
            {
              $project: {
                _id: 0,
                type: 1,
                coins: 1,
                bookingId: { $toString: '$bookingId' },
                bookingNumber: 1,
                userName: { $ifNull: ['$user.name', 'Unknown'] },
                userPhone: { $ifNull: ['$user.phone', ''] },
                refundedAt: '$createdAt',
                description: 1,
              },
            },
          ],
          total: [{ $count: 'count' }],
        },
      },
    ];

    const [result] = await FelboCoinTransactionModel.aggregate(pipeline).exec();
    return {
      refunds: (result?.data ?? []) as CoinRefundHistoryItemDto[],
      total: result?.total?.[0]?.count ?? 0,
    };
  }
}
