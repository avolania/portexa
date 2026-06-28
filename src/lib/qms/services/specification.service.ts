import {
  findSpecificationById,
  createSpecification,
  updateSpecification,
  transitionSpecStatus,
  createImpactReviews,
  getSpecChanges,
  resolveImpactReview,
} from '../repositories/specification.repo';
import type { Specification, SpecChange, CreateSpecDto, UpdateSpecDto } from '../types';

export async function createSpec(
  orgId: string,
  userId: string,
  dto: CreateSpecDto
): Promise<Specification> {
  return createSpecification(orgId, userId, dto);
}

export async function updateSpec(
  id: string,
  userId: string,
  dto: UpdateSpecDto
): Promise<Specification> {
  const updated = await updateSpecification(id, userId, dto);

  // If raw_material with linked finished goods, create impact reviews
  if (
    updated.type === 'raw_material' &&
    updated.linked_finished_good_ids &&
    updated.linked_finished_good_ids.length > 0
  ) {
    await createImpactReviews(id, updated.linked_finished_good_ids, userId);
  }

  return updated;
}

export async function submitForReview(id: string, userId: string): Promise<Specification> {
  const spec = await findSpecificationById(id);
  if (!spec) throw new Error('Spesifikasyon bulunamadı');
  if (spec.status !== 'draft') {
    throw new Error(`Yalnızca taslak spesifikasyonlar incelemeye gönderilebilir (mevcut durum: ${spec.status})`);
  }
  return transitionSpecStatus(id, userId, 'submit');
}

export async function approveSpec(id: string, userId: string): Promise<Specification> {
  const spec = await findSpecificationById(id);
  if (!spec) throw new Error('Spesifikasyon bulunamadı');
  if (spec.status !== 'in_review') {
    throw new Error(`Yalnızca incelemede olan spesifikasyonlar onaylanabilir (mevcut durum: ${spec.status})`);
  }
  return transitionSpecStatus(id, userId, 'approve');
}

export async function publishSpec(id: string, userId: string): Promise<Specification> {
  const spec = await findSpecificationById(id);
  if (!spec) throw new Error('Spesifikasyon bulunamadı');
  if (spec.status !== 'approved') {
    throw new Error(`Yalnızca onaylı spesifikasyonlar yayınlanabilir (mevcut durum: ${spec.status})`);
  }

  // Guard: allergens must not be empty for raw_material and finished_good
  if (spec.type !== 'packaging') {
    const allergenEntries = Object.keys(spec.allergens ?? {});
    if (allergenEntries.length === 0) {
      throw new Error('Ham madde ve bitmiş ürün spesifikasyonları için en az bir alerjen tanımlanmalıdır');
    }
  }

  return transitionSpecStatus(id, userId, 'publish');
}

export async function archiveSpec(id: string, userId: string): Promise<Specification> {
  const spec = await findSpecificationById(id);
  if (!spec) throw new Error('Spesifikasyon bulunamadı');
  return transitionSpecStatus(id, userId, 'archive');
}

export async function getSpecHistory(id: string): Promise<SpecChange[]> {
  return getSpecChanges(id);
}

export { resolveImpactReview };
