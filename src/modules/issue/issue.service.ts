import { IssueRepository } from './issue.repository';
import { PopulatedBookingIssue } from './issue.repository';
import { IBookingIssue } from './issue.model';
import { ListIssuesFilter, ListIssuesResponse, IssueDTO, IssueDetailDTO } from './issue.types';
import { NotFoundError } from '../../shared/errors';

export class IssueService {
  constructor(private readonly issueRepository: IssueRepository) {}

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
      userLocation: issue.userLocation ?? null,
      photoUrl: issue.photoUrl ?? null,
      reviewedBy: issue.reviewedBy?.toString() ?? null,
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
}
