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
  VendorProfileDto,
} from './vendor.types';
import { OtpService } from '../../shared/services/otp.service';
import { OtpSessionService } from '../../shared/services/otp-session.service';
import { JwtService, TokenPayload } from '../../shared/services/jwt.service';
import PaymentService from '../payment/payment.service';
import ShopService from '../shop/shop.service';
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
} from '../../shared/errors/index';
import { withTransaction } from '../../shared/database/transaction';

function last4(phone: string): string {
  return phone.slice(-4);
}

export default class VendorService {
  constructor(
    private readonly vendorRepository: VendorRepository,
    private readonly otpService: OtpService,
    private readonly otpSessionService: OtpSessionService,
    private readonly jwtService: JwtService,
    private readonly paymentService: PaymentService,
    private readonly shopService: ShopService,
    private readonly registrationFee: number,
    private readonly logger: Logger,
  ) {}

  private toVendorDto(vendor: IVendor): LoginVerifyOtpResponse['vendor'] {
    return {
      id: vendor._id.toString(),
      phone: vendor.phone,
      ownerName: vendor.ownerName,
      email: vendor.email || null,
    };
  }

  private toProfileDto(vendor: IVendor): VendorProfileDto {
    return {
      id: vendor._id.toString(),
      phone: vendor.phone,
      ownerName: vendor.ownerName,
      email: vendor.email || null,
      registrationType: vendor.registrationType,
      verificationStatus: vendor.verificationStatus,
      status: vendor.status,
    };
  }

  async sendOtp(phone: string): Promise<SendOtpResponse> {
    const phoneWithCode = `91${phone}`;
    const result = await this.otpService.sendOtp(phoneWithCode, 'VENDOR');

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

    const tokenPayload: TokenPayload = {
      userId: vendor._id.toString(),
      phone: vendor.phone,
      role: 'VENDOR',
    };

    const token = this.jwtService.signToken(tokenPayload);

    this.logger.info({
      action: 'VENDOR_LOGIN',
      module: 'vendor',
      vendorId: vendor._id.toString(),
      phone: last4(input.phone),
    });

    return { token, vendor: this.toVendorDto(vendor) };
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

    const amount = this.registrationFee;

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
      verificationStatus: 'PENDING',
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

    await this.paymentService.verifyVendorRegistrationPayment({
      orderId: input.orderId,
      paymentId: input.paymentId,
      signature: input.signature,
    });

    await withTransaction(async (session) => {
      await this.vendorRepository.updateRegistrationPayment(
        vendor._id.toString(),
        {
          amount: this.registrationFee,
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

  async getProfile(vendorId: string): Promise<VendorProfileDto> {
    const vendor = await this.vendorRepository.findById(vendorId);
    if (!vendor) {
      throw new NotFoundError('Vendor not found.');
    }

    return this.toProfileDto(vendor);
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

    // TODO: Queue FCM push notification via Bull queue
    // `Your Felbo vendor application was not approved. Reason: ${reason}. Contact support.`
  }
}
