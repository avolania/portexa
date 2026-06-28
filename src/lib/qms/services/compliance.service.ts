import {
  createDocument,
  updateDocument,
  getAuditReadiness,
} from '@/lib/qms/repositories/document.repo';
import type {
  ComplianceDocument,
  CreateDocumentDto,
  ReviewDocumentDto,
  AuditReadinessReport,
} from '@/lib/qms/types';

export async function requestDocument(
  orgId: string,
  userId: string,
  dto: CreateDocumentDto
): Promise<ComplianceDocument> {
  return createDocument(orgId, {
    ...dto,
    uploaded_by: { type: 'internal', userId },
  });
}

export async function uploadDocument(
  docId: string,
  userId: string,
  fileRef: string,
  fileName: string,
  fileSizeBytes: number
): Promise<ComplianceDocument> {
  return updateDocument(docId, {
    file_ref: fileRef,
    file_name: fileName,
    file_size_bytes: fileSizeBytes,
    status: 'uploaded',
    uploaded_by: { type: 'internal', userId },
    updated_at: new Date().toISOString(),
  });
}

export async function reviewDocument(
  docId: string,
  reviewerId: string,
  dto: ReviewDocumentDto
): Promise<ComplianceDocument> {
  const newStatus = dto.decision === 'approve' ? 'approved' : 'rejected';
  return updateDocument(docId, {
    status: newStatus,
    reviewer_id: reviewerId,
    review_notes: dto.notes ?? '',
    updated_at: new Date().toISOString(),
  });
}

export async function getAuditReadinessReport(orgId: string): Promise<AuditReadinessReport> {
  return getAuditReadiness(orgId);
}
