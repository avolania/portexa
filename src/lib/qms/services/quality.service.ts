import type {
  Lot, COA, COAFlag, NCR, CAPA, CAPAAction,
  CreateLotDto, CreateNcrDto, CreateCapaDto,
  NcrState, NcrDisposition, CapaState,
} from '@/lib/qms/types';

import * as lotRepo from '@/lib/qms/repositories/lot.repo';
import * as coaRepo from '@/lib/qms/repositories/coa.repo';
import * as ncrRepo from '@/lib/qms/repositories/ncr.repo';
import * as capaRepo from '@/lib/qms/repositories/capa.repo';
import { findSpecificationById } from '@/lib/qms/repositories/specification.repo';

// ─── Lot Management ──────────────────────────────────────────────────────────

export async function receiveLot(
  orgId: string,
  userId: string,
  dto: CreateLotDto
): Promise<Lot> {
  return lotRepo.createLot(orgId, userId, dto);
}

// ─── COA Management ──────────────────────────────────────────────────────────

export async function submitCoa(
  orgId: string,
  userId: string,
  dto: {
    lotId: string;
    specId?: string;
    fileRef?: string;
    fileName?: string;
  }
): Promise<COA> {
  // Get lot to determine supplier
  const lot = await lotRepo.findLotById(dto.lotId);
  if (!lot) throw new Error('Lot bulunamadı');

  const coa = await coaRepo.createCoa(orgId, {
    lotId: dto.lotId,
    supplierId: lot.supplier_id,
    specId: dto.specId,
    fileRef: dto.fileRef,
    fileName: dto.fileName,
    submittedBy: { type: 'internal', userId },
  });

  return coa;
}

export async function compareCoaWithSpec(
  coaId: string
): Promise<{ overall: 'pass' | 'fail' | 'partial'; flags: COAFlag[] }> {
  const coa = await coaRepo.findCoaById(coaId);
  if (!coa) throw new Error('COA bulunamadı');

  if (!coa.spec_id) {
    await coaRepo.updateCoaStatus(coaId, 'manual_review');
    return { overall: 'partial', flags: [] };
  }

  const spec = await findSpecificationById(coa.spec_id);
  if (!spec) throw new Error('Spesifikasyon bulunamadı');

  const results = await coaRepo.getCoaResults(coaId);
  if (results.length === 0) {
    await coaRepo.updateCoaStatus(coaId, 'auto_checked');
    return { overall: 'partial', flags: [] };
  }

  const flags: COAFlag[] = [];

  for (const result of results) {
    const key = result.attribute_key;
    const reportedNum = parseFloat(result.reported_value);

    // Check physical_chemical attributes
    if (spec.physical_chemical && key in spec.physical_chemical) {
      const attr = spec.physical_chemical[key];
      const hasRange = attr.min !== undefined || attr.max !== undefined;

      if (hasRange && !isNaN(reportedNum)) {
        const tooLow = attr.min !== undefined && reportedNum < attr.min;
        const tooHigh = attr.max !== undefined && reportedNum > attr.max;
        const pass = !tooLow && !tooHigh;

        let specLimit = '';
        if (attr.min !== undefined && attr.max !== undefined) {
          specLimit = `${attr.min} – ${attr.max}${attr.unit ? ' ' + attr.unit : ''}`;
        } else if (attr.min !== undefined) {
          specLimit = `≥ ${attr.min}${attr.unit ? ' ' + attr.unit : ''}`;
        } else if (attr.max !== undefined) {
          specLimit = `≤ ${attr.max}${attr.unit ? ' ' + attr.unit : ''}`;
        }

        flags.push({
          attribute_key: key,
          spec_limit: specLimit,
          reported_value: `${result.reported_value}${result.unit ? ' ' + result.unit : ''}`,
          result: pass ? 'pass' : 'fail',
        });
      }
      continue;
    }

    // Check microbiological specs
    if (spec.microbiological && spec.microbiological.length > 0) {
      const micro = spec.microbiological.find(
        (m) => m.organism.toLowerCase().replace(/\s+/g, '_') === key.toLowerCase() ||
               m.organism.toLowerCase() === key.toLowerCase()
      );
      if (micro) {
        // Simple comparison: check if reported value indicates absence when limit specifies absence
        const limitLower = micro.limit.toLowerCase();
        const reportedLower = result.reported_value.toLowerCase();
        let pass = true;

        if (limitLower.includes('not detected') || limitLower.includes('absent') || limitLower.includes('negative')) {
          pass = reportedLower.includes('not detected') || reportedLower.includes('nd') ||
                 reportedLower.includes('absent') || reportedLower.includes('negative');
        } else if (!isNaN(reportedNum)) {
          // Numeric limit parsing
          const limitNum = parseFloat(micro.limit.replace(/[^0-9.]/g, ''));
          if (!isNaN(limitNum)) {
            pass = reportedNum <= limitNum;
          }
        }

        flags.push({
          attribute_key: key,
          spec_limit: micro.limit,
          reported_value: `${result.reported_value}${result.unit ? ' ' + result.unit : ''}`,
          result: pass ? 'pass' : 'fail',
        });
      }
    }
  }

  const failCount = flags.filter((f) => f.result === 'fail').length;
  const passCount = flags.filter((f) => f.result === 'pass').length;

  let overall: 'pass' | 'fail' | 'partial';
  if (flags.length === 0) {
    overall = 'partial';
  } else if (failCount === 0) {
    overall = 'pass';
  } else if (passCount === 0) {
    overall = 'fail';
  } else {
    overall = 'partial';
  }

  await coaRepo.updateCoaComparison(coaId, overall, flags);
  await coaRepo.updateCoaStatus(coaId, overall === 'pass' ? 'conforming' : overall === 'fail' ? 'nonconforming' : 'auto_checked');

  return { overall, flags };
}

// ─── NCR Management ──────────────────────────────────────────────────────────

export async function createNcr(
  orgId: string,
  userId: string,
  dto: CreateNcrDto
): Promise<NCR> {
  return ncrRepo.createNcr(orgId, userId, dto);
}

export async function transitionNcr(
  id: string,
  _userId: string,
  action: 'investigate' | 'set_disposition' | 'approve_disposition' | 'link_capa' | 'close' | 'reject',
  updates?: { disposition?: NcrDisposition; capaId?: string }
): Promise<NCR> {
  const ncr = await ncrRepo.findNcrById(id);
  if (!ncr) throw new Error('NCR bulunamadı');

  switch (action) {
    case 'investigate': {
      if (ncr.state !== 'open') throw new Error('NCR açık durumda değil');
      return ncrRepo.transitionNcr(id, 'investigating');
    }

    case 'set_disposition': {
      if (ncr.state !== 'investigating') throw new Error('NCR araştırılıyor durumunda değil');
      if (!updates?.disposition) throw new Error('Elden çıkarma kararı gereklidir');
      return ncrRepo.transitionNcr(id, 'disposition_pending', { disposition: updates.disposition });
    }

    case 'approve_disposition': {
      if (ncr.state !== 'disposition_pending') throw new Error('NCR elden çıkarma bekliyor durumunda değil');
      return ncrRepo.transitionNcr(id, 'disposition_approved');
    }

    case 'link_capa': {
      if (ncr.state !== 'disposition_approved') throw new Error('NCR elden çıkarma onaylandı durumunda değil');
      if (!updates?.capaId) throw new Error('CAPA ID gereklidir');
      await ncrRepo.linkCapaToNcr(id, updates.capaId);
      const updated = await ncrRepo.findNcrById(id);
      if (!updated) throw new Error('NCR güncellenemedi');
      return updated;
    }

    case 'close': {
      if (ncr.state !== 'capa_linked') throw new Error('NCR CAPA bağlı durumunda değil');
      // Guard: check linked CAPA state
      const capas = await capaRepo.findCapas(ncr.org_id, { ncrId: id });
      const allDone = capas.every((c) => c.state === 'approved' || c.state === 'closed');
      if (!allDone && capas.length > 0) {
        throw new Error('Bağlı CAPA\'lar henüz onaylanmamış veya kapatılmamış');
      }
      return ncrRepo.transitionNcr(id, 'closed');
    }

    case 'reject': {
      if (ncr.state === 'closed' || ncr.state === 'rejected') {
        throw new Error('Kapalı veya reddedilmiş NCR tekrar reddedilemez');
      }
      return ncrRepo.transitionNcr(id, 'rejected');
    }

    default:
      throw new Error('Geçersiz aksiyon');
  }
}

// ─── CAPA Management ─────────────────────────────────────────────────────────

export async function createCapa(
  orgId: string,
  userId: string,
  dto: CreateCapaDto
): Promise<CAPA> {
  return capaRepo.createCapa(orgId, userId, dto);
}

export async function transitionCapa(
  id: string,
  _userId: string,
  action: 'start' | 'submit_verification' | 'submit_effectiveness' | 'approve' | 'close'
): Promise<CAPA> {
  const capa = await capaRepo.findCapaById(id);
  if (!capa) throw new Error('CAPA bulunamadı');

  const stateMap: Record<string, { from: CapaState; to: CapaState }> = {
    start: { from: 'draft', to: 'in_progress' },
    submit_verification: { from: 'in_progress', to: 'verification' },
    submit_effectiveness: { from: 'verification', to: 'effectiveness_check' },
    approve: { from: 'effectiveness_check', to: 'approved' },
    close: { from: 'approved', to: 'closed' },
  };

  const transition = stateMap[action];
  if (!transition) throw new Error('Geçersiz aksiyon');
  if (capa.state !== transition.from) {
    throw new Error(`CAPA ${transition.from} durumunda değil (şu an: ${capa.state})`);
  }

  const extraUpdates: Partial<CAPA> = {};
  if (action === 'approve') {
    extraUpdates.approved_by = _userId;
    extraUpdates.approved_at = new Date().toISOString();
  }

  return capaRepo.transitionCapa(id, transition.to, extraUpdates);
}

export async function updateCapaAction(
  actionId: string,
  _userId: string,
  status: 'open' | 'done' | 'verified'
): Promise<CAPAAction> {
  return capaRepo.updateCapaAction(actionId, status);
}
