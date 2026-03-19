import type { Types } from 'mongoose';
import { Logger } from 'winston';
import VendorRepository from './vendor.repository';
import { IVendor } from './vendor.model';
import {
  SendOtpResponse,
  LoginVerifyOtpInput,
  LoginVerifyOtpResponse,
  RegisterVerifyOtpInput,
  RegisterVerifyOtpResponse,
  RegisterAssociationInput,
  RegisterAssociationResponse,
  RegisterIndependentInitiateInput,
  RegisterIndependentInitiateResponse,
  RegisterIndependentConfirmInput,
  RegisterIndependentConfirmResponse,
  RegistrationStatusResponse,
  OnboardingStatusResponse,
  VendorProfileDto,
  ListVendorsFilter,
  ListVendorsResponse,
  ListVerificationRequestsResponse,
  VerificationRequestItemDto,
  VendorAdminDetail,
  VendorRequestAdminDetail,
  RefreshTokenResponse,
  UpdateProfileInput,
  UpdateProfileResponse,
  VendorDashboardCountsDto,
} from './vendor.types';
import {
  VendorBookingListResponse,
  VendorBookingStatus,
  VendorBookingDetailDto,
} from '../booking/booking.types';
import { RegistrationPaymentSummaryResponse } from './vendor.types';
import { OtpService } from '../../shared/services/otp.service';
import { OtpSessionService } from '../../shared/services/otp-session.service';
import { JwtService, TokenPayload } from '../../shared/services/jwt.service';
import PaymentService from '../payment/payment.service';
import ShopService from '../shop/shop.service';
import { BarberService } from '../barber/barber.service';
import { BookingService } from '../booking/booking.service';
import { BarberAvailabilityService } from '../barberAvailability/barberAvailability.service';
import { formatRating } from '../../shared/utils/rating';
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
} from '../../shared/errors/index';
import { withTransaction } from '../../shared/database/transaction';
import { ConfigService } from '../config/config.service';
import { CONFIG_KEYS } from '../../shared/config/config.keys';

function last4(phone: string): string {
  return phone.slice(-4);
}

export default class VendorService {
  constructor(
    private readonly vendorRepository: VendorRepository,
    private readonly otpService: OtpService,
    private readonly otpSessionService: OtpSessionService,
    private readonly jwtService: JwtService,
    private readonly getPaymentService: () => PaymentService,
    private readonly getShopService: () => ShopService,
    private readonly getBarberService: () => BarberService,
    private readonly getBookingService: () => BookingService,
    private readonly getAvailabilityService: () => BarberAvailabilityService,
    private readonly configService: ConfigService,
    private readonly logger: Logger,
  ) {}

  private get paymentService(): PaymentService {
    return this.getPaymentService();
  }

  private get shopService(): ShopService {
    return this.getShopService();
  }

  private get barberService(): BarberService {
    return this.getBarberService();
  }

  private get bookingService(): BookingService {
    return this.getBookingService();
  }

  private get availabilityService(): BarberAvailabilityService {
    return this.getAvailabilityService();
  }

  private toVendorDto(vendor: IVendor): LoginVerifyOtpResponse['vendor'] {
    return {
      id: vendor._id.toString(),
      phone: vendor.phone,
      ownerName: vendor.ownerName,
      email: vendor.email || null,
      profilePhoto: vendor.profilePhoto || null,
      verificationStatus: vendor.verificationStatus,
    };
  }

  private toProfileDto(
    vendor: IVendor,
    onboardingStatus: VendorProfileDto['onboardingStatus'],
    shopDetails: VendorProfileDto['shopDetails'],
  ): VendorProfileDto {
    return {
      id: vendor._id.toString(),
      phone: vendor.phone,
      ownerName: vendor.ownerName,
      email: vendor.email || null,
      profilePhoto: vendor.profilePhoto || null,
      registrationType: vendor.registrationType,
      verificationStatus: vendor.verificationStatus,
      status: vendor.status,
      onboardingStatus,
      shopDetails,
    };
  }

  private async getOnboardingInfo(vendorId: string): Promise<{
    onboardingStatus: OnboardingStatusResponse['onboardingStatus'];
    shopDetails: OnboardingStatusResponse['shopDetails'];
  }> {
    const shops = await this.shopService.getMyShops(vendorId);
    const primaryShop = shops.find((s) => s.isPrimary && s.status !== 'DELETED');

    if (!primaryShop) {
      return { onboardingStatus: null, shopDetails: null };
    }

    const onboardingStatus = primaryShop.onboardingStatus;

    return {
      onboardingStatus,
      shopDetails:
        onboardingStatus === 'COMPLETED'
          ? null
          : {
              shopId: primaryShop.id,
              shopName: primaryShop.name,
              address: primaryShop.address,
              phoneNo: primaryShop.phone,
            },
    };
  }

  async sendOtp(phone: string): Promise<SendOtpResponse> {
    const phoneWithCode = `91${phone}`;
    const result = await this.otpService.sendOtp(phoneWithCode);

    await this.otpSessionService.storeSession(result.sessionId, phone);

    this.logger.info({
      action: 'VENDOR_OTP_SENT',
      module: 'vendor',
      phone: last4(phone),
    });

    return {
      sessionId: result.sessionId,
      message: 'OTP sent successfully',
    };
  }

  async loginVerifyOtp(input: LoginVerifyOtpInput): Promise<LoginVerifyOtpResponse> {
    await this.otpSessionService.verifySessionPhone(input.sessionId, input.phone);

    const otpResult = await this.otpService.verifyOtp(input.sessionId, input.otp);
    if (!otpResult.verified) {
      throw new UnauthorizedError('Invalid OTP. Please try again.');
    }

    await this.otpSessionService.deleteSession(input.sessionId);

    const vendor = await this.vendorRepository.findByPhone(input.phone);

    if (!vendor) {
      throw new NotFoundError('No vendor account found. Please register.');
    }

    if (vendor.verificationStatus === 'PENDING') {
      throw new ForbiddenError('Your account is awaiting verification.');
    }

    if (vendor.verificationStatus === 'REJECTED') {
      throw new ForbiddenError(
        'Your application was not approved: ' + (vendor.verificationNote || 'Contact support.'),
      );
    }

    if (vendor.status === 'SUSPENDED') {
      throw new ForbiddenError('Your account has been suspended. Contact support.');
    }

    if (vendor.status === 'DELETED') {
      throw new ForbiddenError('This account no longer exists.');
    }

    await this.vendorRepository.updateLastLogin(vendor._id.toString());

    const barberProfile = await this.barberService.getVendorBarberProfile(vendor._id.toString());

    const tokenPayload: TokenPayload = {
      sub: vendor._id.toString(),
      role: barberProfile ? 'VENDOR_BARBER' : 'VENDOR',
      ...(barberProfile ? { barberId: barberProfile.id } : {}),
    };

    const token = this.jwtService.signToken(tokenPayload);
    const refreshToken = this.jwtService.signRefreshToken(tokenPayload);

    const refreshTokenHash = this.jwtService.hashToken(refreshToken);
    await this.vendorRepository.updateRefreshToken(vendor._id.toString(), refreshTokenHash);

    const { onboardingStatus, shopDetails } = await this.getOnboardingInfo(vendor._id.toString());

    this.logger.info({
      action: 'VENDOR_LOGIN',
      module: 'vendor',
      vendorId: vendor._id.toString(),
      phone: last4(input.phone),
    });

    return { token, refreshToken, vendor: this.toVendorDto(vendor), onboardingStatus, shopDetails };
  }

  async refreshAccessToken(refreshToken: string): Promise<RefreshTokenResponse> {
    const decoded = this.jwtService.verifyRefreshToken(refreshToken);

    const vendor = await this.vendorRepository.findByIdWithRefreshToken(decoded.sub);

    if (!vendor || vendor.status === 'SUSPENDED' || vendor.status === 'DELETED') {
      throw new UnauthorizedError('Invalid refresh token. Please login again.');
    }

    if (!vendor.refreshTokenHash) {
      throw new UnauthorizedError('Invalid refresh token. Please login again.');
    }

    const isValid = this.jwtService.compareTokenHash(refreshToken, vendor.refreshTokenHash);

    if (!isValid) {
      await this.vendorRepository.updateRefreshToken(vendor._id.toString(), null);
      this.logger.warn('Refresh token reuse detected — cleared stored token', {
        vendorId: vendor._id,
      });
      throw new UnauthorizedError('Invalid refresh token. Please login again.');
    }

    const barberProfile = await this.barberService.getVendorBarberProfile(vendor._id.toString());

    const tokenPayload: TokenPayload = {
      sub: vendor._id.toString(),
      role: barberProfile ? 'VENDOR_BARBER' : 'VENDOR',
      ...(barberProfile ? { barberId: barberProfile.id } : {}),
    };

    const newToken = this.jwtService.signToken(tokenPayload);
    const newRefreshToken = this.jwtService.signRefreshToken(tokenPayload);

    const newRefreshTokenHash = this.jwtService.hashToken(newRefreshToken);
    await this.vendorRepository.updateRefreshToken(vendor._id.toString(), newRefreshTokenHash);

    return { token: newToken, refreshToken: newRefreshToken };
  }

  async logout(vendorId: string): Promise<void> {
    await this.vendorRepository.updateRefreshToken(vendorId, null);
    this.logger.info('Vendor logged out', { vendorId });
  }

  async registerVerifyOtp(input: RegisterVerifyOtpInput): Promise<RegisterVerifyOtpResponse> {
    await this.otpSessionService.verifySessionPhone(input.sessionId, input.phone);

    const otpResult = await this.otpService.verifyOtp(input.sessionId, input.otp);
    if (!otpResult.verified) {
      throw new UnauthorizedError('Invalid OTP. Please try again.');
    }

    await this.otpSessionService.deleteSession(input.sessionId);

    const existing = await this.vendorRepository.findByPhone(input.phone);
    if (existing) {
      if (existing.verificationStatus === 'APPROVED') {
        throw new ConflictError('An account already exists for this number. Please login.');
      }
      if (existing.verificationStatus === 'PENDING') {
        throw new ConflictError('Your application is already under review.');
      }
      if (existing.verificationStatus === 'REJECTED') {
        throw new ForbiddenError('Your application was not approved. Please contact support.');
      }
    }

    this.logger.info({
      action: 'VENDOR_REGISTER_OTP_VERIFIED',
      module: 'vendor',
      phone: last4(input.phone),
    });

    return { verified: true, message: 'Phone verified. Please complete your registration.' };
  }

  async registerAssociation(input: RegisterAssociationInput): Promise<RegisterAssociationResponse> {
    const existing = await this.vendorRepository.findByPhone(input.phone);

    if (existing) {
      if (existing.verificationStatus === 'APPROVED') {
        throw new ConflictError('Account already exists. Please login.');
      }

      if (existing.verificationStatus === 'PENDING') {
        throw new ConflictError('Application already under review.');
      }

      if (existing.verificationStatus === 'REJECTED') {
        throw new ForbiddenError('Contact support to reapply.');
      }
    }

    const newVendor = await this.vendorRepository.create({
      phone: input.phone,
      ownerName: input.ownerName,
      email: input.email,
      registrationType: 'ASSOCIATION',
      associationMemberId: input.associationMemberId,
      associationIdProofUrl: input.associationIdProofUrl,
      shopDetails: input.shopDetails,
      verificationStatus: 'PENDING',
      status: 'PENDING',
    });

    this.logger.info({
      action: 'VENDOR_REGISTRATION_SUBMITTED',
      module: 'vendor',
      vendorId: newVendor._id.toString(),
      type: 'ASSOCIATION',
      phone: last4(input.phone),
    });

    return { message: 'Application submitted. You will be notified once verified.' };
  }

  async registerIndependentInitiate(
    input: RegisterIndependentInitiateInput,
  ): Promise<RegisterIndependentInitiateResponse> {
    const existing = await this.vendorRepository.findByPhone(input.phone);
    if (existing) {
      if (existing.verificationStatus === 'APPROVED') {
        throw new ConflictError('Account already exists. Please login.');
      }
      if (existing.verificationStatus === 'PENDING') {
        throw new ConflictError('Application already under review.');
      }
      if (existing.verificationStatus === 'REJECTED') {
        throw new ForbiddenError('Contact support to reapply.');
      }
    }

    const amount = await this.configService.getValueAsNumber(CONFIG_KEYS.VENDOR_REGISTRATION_FEE);

    const { orderId } = await this.paymentService.createVendorRegistrationOrder({
      phone: input.phone,
      amountRupees: amount,
    });

    await this.vendorRepository.upsertByPhone(input.phone, {
      ownerName: input.ownerName,
      email: input.email,
      registrationType: 'INDEPENDENT',
      documents: input.documents,
      shopDetails: input.shopDetails,
      registrationPaymentOrderId: orderId,
      verificationStatus: 'PAYMENT_PENDING',
      status: 'PENDING',
    });

    this.logger.info({
      action: 'VENDOR_REGISTRATION_PAYMENT_INITIATED',
      module: 'vendor',
      phone: last4(input.phone),
      orderId,
    });

    return { orderId, amount };
  }

  async registerIndependentConfirm(
    input: RegisterIndependentConfirmInput,
  ): Promise<RegisterIndependentConfirmResponse> {
    const vendor = await this.vendorRepository.findByPhone(input.phone);
    if (!vendor) {
      throw new NotFoundError('Registration not found. Please start again.');
    }
    if (vendor.registrationPaymentOrderId !== input.orderId) {
      throw new ValidationError('Order ID mismatch.');
    }
    if (vendor.verificationStatus !== 'PAYMENT_PENDING') {
      throw new ConflictError('Payment already confirmed or not initiated.');
    }

    await this.paymentService.verifyVendorRegistrationPayment({
      orderId: input.orderId,
      paymentId: input.paymentId,
      signature: input.signature,
    });

    await withTransaction(async (session) => {
      const fee = await this.configService.getValueAsNumber(CONFIG_KEYS.VENDOR_REGISTRATION_FEE);
      await this.vendorRepository.updateRegistrationPayment(
        vendor._id.toString(),
        {
          amount: fee,
          paymentId: input.paymentId,
          paidAt: new Date(),
        },
        session,
      );
      await this.vendorRepository.setVerificationStatus(
        vendor._id.toString(),
        'PENDING',
        undefined,
        session,
      );
    });

    this.logger.info({
      action: 'VENDOR_REGISTRATION_PAYMENT_CONFIRMED',
      module: 'vendor',
      vendorId: vendor._id.toString(),
      paymentId: input.paymentId,
      phone: last4(input.phone),
    });

    return { message: 'Payment confirmed. Application submitted for verification.' };
  }

  async getRegistrationPaymentSummary(): Promise<RegistrationPaymentSummaryResponse> {
    const [total, gstPercentage] = await Promise.all([
      this.configService.getValueAsNumber(CONFIG_KEYS.VENDOR_REGISTRATION_FEE),
      this.configService.getValueAsNumber(CONFIG_KEYS.VENDOR_REGISTRATION_GST_PERCENTAGE),
    ]);

    const gstAmount = Number(((total * gstPercentage) / 100).toFixed(2));
    const registrationFee = Number((total - gstAmount).toFixed(2));

    return { registrationFee, gstPercentage, gstAmount, total };
  }

  async getRegistrationStatus(vendorId: string): Promise<RegistrationStatusResponse> {
    const vendor = await this.vendorRepository.findById(vendorId);
    if (!vendor) {
      throw new NotFoundError('Vendor not found.');
    }

    return {
      verificationStatus: vendor.verificationStatus,
      rejectionReason: vendor.verificationNote ?? undefined,
      registrationType: vendor.registrationType ?? undefined,
    };
  }

  async getOnboardingStatus(vendorId: string): Promise<OnboardingStatusResponse> {
    const vendor = await this.vendorRepository.findById(vendorId);
    if (!vendor) {
      throw new NotFoundError('Vendor not found.');
    }

    const { onboardingStatus, shopDetails } = await this.getOnboardingInfo(vendorId);

    return {
      vendorName: vendor.ownerName,
      onboardingStatus,
      shopDetails,
    };
  }

  async getProfile(vendorId: string): Promise<VendorProfileDto> {
    const vendor = await this.vendorRepository.findById(vendorId);
    if (!vendor) {
      throw new NotFoundError('Vendor not found.');
    }

    const { onboardingStatus, shopDetails } = await this.getOnboardingInfo(vendorId);

    return this.toProfileDto(vendor, onboardingStatus, shopDetails ?? null);
  }

  async approveVendor(vendorId: string, approvedBy: string): Promise<void> {
    const vendor = await this.vendorRepository.findById(vendorId);
    if (!vendor) {
      throw new NotFoundError('Vendor not found.');
    }

    if (vendor.verificationStatus !== 'PENDING') {
      throw new ConflictError('Vendor is not awaiting verification.');
    }

    if (!vendor.shopDetails) {
      throw new ValidationError('Cannot approve: vendor has no shop details.');
    }

    await withTransaction(async (session) => {
      await this.vendorRepository.setVerificationStatus(vendorId, 'APPROVED', undefined, session);
      await this.vendorRepository.setStatus(vendorId, 'ACTIVE', session);

      await this.shopService.createShopForVendor(
        {
          vendorId: vendor._id.toString(),
          name: vendor.shopDetails!.name,
          shopType: vendor.shopDetails!.type,
          phone: vendor.phone,
          address: vendor.shopDetails!.address,
          location: vendor.shopDetails!.location,
          isPrimary: true,
        },
        session,
      );
    });

    this.logger.info({
      action: 'VENDOR_APPROVED',
      module: 'vendor',
      vendorId,
      approvedBy,
    });

    // TODO: Queue FCM push notification via Bull queue
    // "Your Felbo vendor account has been approved. You can now log in."
  }

  async rejectVendor(vendorId: string, rejectedBy: string, reason: string): Promise<void> {
    const vendor = await this.vendorRepository.findById(vendorId);
    if (!vendor) {
      throw new NotFoundError('Vendor not found.');
    }
    if (vendor.verificationStatus !== 'PENDING') {
      throw new ConflictError('Vendor is not awaiting verification.');
    }

    await withTransaction(async (session) => {
      await this.vendorRepository.setVerificationStatus(vendorId, 'REJECTED', reason, session);
    });

    if (vendor.registrationType === 'INDEPENDENT' && vendor.registrationPayment?.paymentId) {
      await this.paymentService.refundVendorRegistrationPayment(
        vendor.registrationPayment.paymentId,
      );
      this.logger.info({
        action: 'VENDOR_REGISTRATION_REFUND_INITIATED',
        module: 'vendor',
        vendorId,
        paymentId: vendor.registrationPayment.paymentId,
      });
    }

    this.logger.info({
      action: 'VENDOR_REJECTED',
      module: 'vendor',
      vendorId,
      rejectedBy,
      reason,
    });
  }

  async flagVendor(vendorId: string): Promise<void> {
    const vendor = await this.vendorRepository.findById(vendorId);
    if (!vendor) throw new NotFoundError('Vendor not found.');
    await this.vendorRepository.flagById(vendorId);
  }

  async getVendorDetailForAdmin(vendorId: string): Promise<VendorAdminDetail> {
    const vendor = await this.vendorRepository.findById(vendorId);

    if (!vendor) {
      throw new NotFoundError('Vendor not found.');
    }

    const shopDtos = await this.shopService.getMyShops(vendorId);

    const shopIds = shopDtos.map((shop) => shop.id);

    let shops: VendorAdminDetail['shops'] = [];

    if (shopIds.length > 0) {
      const [allBarbers, allServices] = await Promise.all([
        this.shopService.getBarbersByShopIds(shopIds),
        this.shopService.getServicesByShopIds(shopIds),
      ]);

      const barbersByShop = new Map<string, typeof allBarbers>();
      const servicesByShop = new Map<string, typeof allServices>();

      for (const barber of allBarbers) {
        const key = barber.shopId.toString();
        if (!barbersByShop.has(key)) barbersByShop.set(key, []);
        barbersByShop.get(key)!.push(barber);
      }

      for (const service of allServices) {
        const key = service.shopId.toString();
        if (!servicesByShop.has(key)) servicesByShop.set(key, []);
        servicesByShop.get(key)!.push(service);
      }

      shops = shopDtos.map((shopDto) => {
        const barberList = barbersByShop.get(shopDto.id) ?? [];
        const serviceList = servicesByShop.get(shopDto.id) ?? [];

        return {
          id: shopDto.id,
          name: shopDto.name,
          shopType: shopDto.shopType,
          phone: shopDto.phone,
          address: shopDto.address,
          rating: {
            average: formatRating(shopDto.rating.average),
            count: shopDto.rating.count,
          },
          onboardingStatus: shopDto.onboardingStatus,
          status: shopDto.status,
          isAvailable: shopDto.isAvailable,
          photos: shopDto.photos,
          workingHours: shopDto.workingHours,

          barbers: barberList.map((b) => ({
            id: b.id.toString(),
            name: b.name,
            phone: b.phone,
            photo: b.photo,
            isAvailable: b.isAvailable,
          })),
          barberCount: barberList.length,

          services: serviceList.map((s) => ({
            id: s.id.toString(),
            name: s.name,
            basePrice: s.basePrice,
            baseDurationMinutes: s.baseDurationMinutes,
            description: s.description,
          })),
          serviceCount: serviceList.length,
        };
      });
    }

    return {
      id: vendor._id.toString(),
      phone: vendor.phone,
      email: vendor.email || null,
      ownerName: vendor.ownerName,
      registrationType: vendor.registrationType,
      registrationDate: vendor.createdAt,
      verificationStatus: vendor.verificationStatus,
      verificationNote: vendor.verificationNote,
      verifiedAt: vendor.verifiedAt,
      status: vendor.status,
      isBlocked: vendor.isBlocked,
      isFlagged: vendor.isFlagged,
      documents: vendor.documents,
      associationMemberId: vendor.associationMemberId,
      associationIdProofUrl: vendor.associationIdProofUrl,
      cancellationCount: vendor.cancellationCount,
      cancellationsThisWeek: vendor.cancellationsThisWeek,
      shops,
      recentBookings: [],
    };
  }

  async getVendorRequestDetailForAdmin(vendorId: string): Promise<VendorRequestAdminDetail> {
    const vendor = await this.vendorRepository.findById(vendorId);
    if (!vendor) throw new NotFoundError('Vendor not found.');

    return {
      id: vendor._id.toString(),
      phone: vendor.phone,
      email: vendor.email || null,
      ownerName: vendor.ownerName,
      registrationType: vendor.registrationType,
      registrationDate: vendor.createdAt,
      verificationStatus: vendor.verificationStatus,
      verificationNote: vendor.verificationNote,
      associationMemberId: vendor.associationMemberId,
      associationIdProofUrl: vendor.associationIdProofUrl,
      registrationPayment: vendor.registrationPayment
        ? {
            amount: vendor.registrationPayment.amount,
            paymentId: vendor.registrationPayment.paymentId,
            paidAt: vendor.registrationPayment.paidAt,
          }
        : undefined,
      documents: vendor.documents,
      shopDetails: vendor.shopDetails
        ? {
            name: vendor.shopDetails.name,
            type: vendor.shopDetails.type,
            address: vendor.shopDetails.address,
            location: vendor.shopDetails.location,
            photos: vendor.shopDetails.photos || [],
          }
        : undefined,
    };
  }

  async listVendors(filter: ListVendorsFilter): Promise<ListVendorsResponse> {
    const query: Record<string, unknown> = {};

    if (filter.verificationStatus) {
      query.verificationStatus = filter.verificationStatus;
    }

    if (filter.status) {
      query.status = filter.status;
    }

    if (filter.registrationType) {
      query.registrationType = filter.registrationType;
    }

    if (filter.search) {
      const regex = new RegExp(filter.search, 'i');
      query.$or = [{ phone: regex }, { ownerName: regex }, { 'shopDetails.name': regex }];
    }

    const { vendors, total } = await this.vendorRepository.findAll(
      query,
      filter.page,
      filter.limit,
    );
    const counts = await this.vendorRepository.getStatusCounts(filter.registrationType);

    return {
      vendors: vendors.map((v, i) => ({
        slNo: total - (filter.page - 1) * filter.limit - i,
        id: v._id.toString(),
        ownerName: v.ownerName,
        phone: v.phone,
        type: v.registrationType,
        verificationStatus: v.verificationStatus,
        status: v.status,
        registered: v.createdAt,
      })),
      total,
      page: filter.page,
      limit: filter.limit,
      totalPages: Math.ceil(total / filter.limit),
      counts,
    };
  }

  async listVerificationRequests(
    page: number,
    limit: number,
    search?: string,
  ): Promise<ListVerificationRequestsResponse> {
    const query: Record<string, unknown> = { verificationStatus: 'PENDING' };

    if (search) {
      const regex = new RegExp(search, 'i');
      query.$or = [{ phone: regex }, { ownerName: regex }, { 'shopDetails.name': regex }];
    }

    const { vendors, total } = await this.vendorRepository.findAll(query, page, limit);
    const counts = await this.vendorRepository.getVerificationRequestCounts();

    return {
      vendors: vendors.map(
        (v, i): VerificationRequestItemDto => ({
          slNo: total - (page - 1) * limit - i,
          id: v._id.toString(),
          shopName: v.shopDetails?.name ?? null,
          ownerName: v.ownerName,
          phone: v.phone,
          type: v.registrationType,
          submitted: v.createdAt,
        }),
      ),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      counts,
    };
  }

  async updateProfile(vendorId: string, input: UpdateProfileInput): Promise<UpdateProfileResponse> {
    const vendor = await this.vendorRepository.findById(vendorId);
    if (!vendor) {
      throw new NotFoundError('Vendor not found.');
    }

    const updateData: { ownerName?: string; email?: string; profilePhoto?: string } = {};
    if (input.ownerName !== undefined) updateData.ownerName = input.ownerName;
    if (input.email !== undefined) updateData.email = input.email;
    if (input.profilePhoto !== undefined) updateData.profilePhoto = input.profilePhoto;

    const updated = await this.vendorRepository.updateProfile(vendorId, updateData);
    if (!updated) {
      throw new NotFoundError('Vendor not found.');
    }

    this.logger.info({
      action: 'VENDOR_PROFILE_UPDATED',
      module: 'vendor',
      vendorId,
    });

    return {
      id: updated._id.toString(),
      phone: updated.phone,
      ownerName: updated.ownerName,
      email: updated.email || null,
      profilePhoto: updated.profilePhoto || null,
    };
  }

  async getAllPhotoKeys(): Promise<string[]> {
    const [vendorKeys, shopPhotoUrls, barberPhotoUrls] = await Promise.all([
      this.vendorRepository.getAllPhotoKeys(),
      this.shopService.getAllPhotoUrls(),
      this.barberService.getAllPhotoUrls(),
    ]);

    const extractKey = (url: string): string => new URL(url).pathname.slice(1);

    const shopKeys = shopPhotoUrls.map(extractKey);
    const barberKeys = barberPhotoUrls.map(extractKey);

    return [...new Set([...vendorKeys, ...shopKeys, ...barberKeys])];
  }

  async registerFcmToken(vendorId: string, token: string): Promise<void> {
    if (!token) {
      throw new ValidationError('Token is required');
    }
    await this.vendorRepository.addFcmToken(vendorId, token);
  }

  async unregisterFcmToken(vendorId: string, token: string): Promise<void> {
    await this.vendorRepository.removeFcmToken(vendorId, token);
  }

  async getVendorStatusCounts(): Promise<{
    total: number;
    active: number;
    pendingVerification: number;
    suspended: number;
  }> {
    return this.vendorRepository.getStatusCounts();
  }

  async getPendingVerificationCount(): Promise<number> {
    const counts = await this.vendorRepository.getVerificationRequestCounts();
    return counts.pending;
  }

  async getVendorDashboardStats(): Promise<{ total: number; pendingVerifications: number }> {
    return this.vendorRepository.getDashboardStats();
  }

  async getAssociationVendorIds(): Promise<Types.ObjectId[]> {
    return this.vendorRepository.findIdsByRegistrationType('ASSOCIATION');
  }

  async getDashboardCounts(vendorId: string, shopId?: string): Promise<VendorDashboardCountsDto> {
    let shopIds: string[];

    if (shopId) {
      const shop = await this.shopService.getShopById(shopId);
      if (shop.vendorId !== vendorId) {
        throw new ForbiddenError('You do not own this shop.');
      }
      shopIds = [shopId];
    } else {
      const shops = await this.shopService.getMyShops(vendorId);
      shopIds = shops.map((s) => s.id);
    }

    if (shopIds.length === 0) {
      return {
        dailyBookings: 0,
        staffWorking: { count: 0, staff: [] },
        staffOnLeave: { count: 0, staff: [] },
      };
    }

    const [bookingStats, workingBarberIds, allActiveStaff] = await Promise.all([
      this.bookingService.getStatsByShopIds(shopIds),
      this.availabilityService.getWorkingBarberIdsByShopIds(shopIds),
      this.barberService.getActiveStaffByShopIds(shopIds),
    ]);

    const workingSet = new Set(workingBarberIds);
    const workingStaff = allActiveStaff.filter((b) => workingSet.has(b.id));
    const onLeaveStaff = allActiveStaff.filter((b) => !workingSet.has(b.id));

    return {
      dailyBookings: bookingStats.todaysBookings,
      staffWorking: { count: workingStaff.length, staff: workingStaff },
      staffOnLeave: { count: onLeaveStaff.length, staff: onLeaveStaff },
    };
  }

  async getVendorBookings(
    vendorId: string,
    query: {
      shopId?: string;
      status?: VendorBookingStatus;
      page: number;
      limit: number;
      startDate?: Date;
      endDate?: Date;
    },
  ): Promise<VendorBookingListResponse> {
    let shopIds: string[];

    if (query.shopId) {
      const shop = await this.shopService.getShopById(query.shopId);
      if (shop.vendorId !== vendorId) {
        throw new ForbiddenError('You do not own this shop.');
      }
      shopIds = [query.shopId];
    } else {
      const shops = await this.shopService.getMyShops(vendorId);
      shopIds = shops.map((s) => s.id);
    }

    if (shopIds.length === 0) {
      return { bookings: [], total: 0, page: query.page, limit: query.limit, totalPages: 0 };
    }

    return this.bookingService.vendorGetBookings({
      shopIds,
      status: query.status,
      page: query.page,
      limit: query.limit,
      startDate: query.startDate,
      endDate: query.endDate,
    });
  }

  async getVendorBookingDetail(
    vendorId: string,
    bookingId: string,
  ): Promise<VendorBookingDetailDto> {
    const shops = await this.shopService.getMyShops(vendorId);
    const shopIds = shops.map((s) => s.id);

    if (shopIds.length === 0) {
      throw new NotFoundError('Booking not found.');
    }

    return this.bookingService.vendorGetBookingDetail(bookingId, shopIds);
  }
}
