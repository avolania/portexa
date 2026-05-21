import { supabaseAdmin } from '@/lib/supabaseAdmin';
import * as pocsRepo from '../repositories/pocsRepo';
import type {
  InnovationPoc, CreatePocDto, UpdatePocDto, TransitionPocDto,
  PocStatus, PocTransitionAction, InnovationRole,
} from '../types';
import { hasRole } from '../utils';

// ── Transition rules ────────────────────────────────────────────────────────

type TransitionRule = {
  from: PocStatus;
  to: PocStatus;
  roles: InnovationRole[];
  ownerAllowed?: boolean;
};

const TRANSITIONS: Record<PocTransitionAction, TransitionRule> = {
  submit_for_approval: {
    from: 'draft',
    to: 'pending_sponsor_approval',
    roles: ['innovation_admin'],
    ownerAllowed: true,
  },
  approve_start: {
    from: 'pending_sponsor_approval',
    to: 'active',
    roles: ['business_sponsor', 'innovation_admin'],
  },
  reject_start: {
    from: 'pending_sponsor_approval',
    to: 'draft',
    roles: ['business_sponsor', 'innovation_admin'],
  },
  hold: {
    from: 'active',
    to: 'on_hold',
    roles: ['innovation_admin'],
    ownerAllowed: true,
  },
  resume: {
    from: 'on_hold',
    to: 'active',
    roles: ['innovation_admin'],
    ownerAllowed: true,
  },
  submit_completion: {
    from: 'active',
    to: 'pending_completion_approval',
    roles: ['innovation_admin'],
    ownerAllowed: true,
  },
  approve_completion: {
    from: 'pending_completion_approval',
    to: 'completed',
    roles: ['business_sponsor', 'innovation_admin'],
  },
  reject_completion: {
    from: 'pending_completion_approval',
    to: 'active',
    roles: ['business_sponsor', 'innovation_admin'],
  },
  cancel: {
    from: 'draft',          // placeholder — cancel checked separately
    to: 'cancelled',
    roles: ['innovation_admin'],
  },
};

const CANCELLABLE: PocStatus[] = [
  'draft', 'pending_sponsor_approval', 'active', 'on_hold', 'pending_completion_approval',
];

// ── Service functions ────────────────────────────────────────────────────────

export async function createPoc(params: {
  orgId: string;
  userId: string;
  roles: InnovationRole[];
  dto: CreatePocDto;
}): Promise<InnovationPoc> {
  if (!hasRole(params.roles, 'innovation_admin') && !hasRole(params.roles, 'business_sponsor')) {
    throw new Error('POC oluşturmak için innovation_admin veya business_sponsor rolü gereklidir');
  }

  // Verify the idea exists, belongs to this org, and is approved
  const { data: idea } = await supabaseAdmin
    .from('innovation_ideas')
    .select('id, status, org_id')
    .eq('id', params.dto.idea_id)
    .eq('org_id', params.orgId)
    .single();

  if (!idea) throw new Error('Fikir bulunamadı');
  if ((idea as Record<string, unknown>).status !== 'approved') {
    throw new Error('POC yalnızca onaylı fikirler için başlatılabilir');
  }

  // Check for existing active/pending POC
  const existing = await pocsRepo.findActivePocByIdeaId(params.dto.idea_id);
  if (existing) throw new Error('Bu fikrin zaten aktif bir POC\'u var');

  return pocsRepo.createPoc({ orgId: params.orgId, dto: params.dto });
}

export async function updatePoc(params: {
  poc: InnovationPoc;
  userId: string;
  roles: InnovationRole[];
  dto: UpdatePocDto;
}): Promise<void> {
  const isAdmin = hasRole(params.roles, 'innovation_admin');
  const isOwner = params.poc.owner_id === params.userId;
  if (!isAdmin && !isOwner) {
    throw new Error('POC güncellemek için innovation_admin veya POC sahibi olmanız gerekir');
  }
  if (params.poc.status === 'completed' || params.poc.status === 'cancelled') {
    throw new Error('Tamamlanan veya iptal edilen POC güncellenemez');
  }
  await pocsRepo.updatePoc(params.poc.id, params.dto);
}

export async function transitionPoc(params: {
  poc: InnovationPoc;
  userId: string;
  roles: InnovationRole[];
  dto: TransitionPocDto;
}): Promise<void> {
  const { poc, userId, roles, dto } = params;

  if (dto.action === 'cancel') {
    if (!hasRole(roles, 'innovation_admin')) {
      throw new Error('İptal etmek için innovation_admin rolü gereklidir');
    }
    if (!CANCELLABLE.includes(poc.status)) {
      throw new Error(`${poc.status} durumundaki POC iptal edilemez`);
    }
    await pocsRepo.updatePocStatus(poc.id, 'cancelled');
    return;
  }

  const rule = TRANSITIONS[dto.action];
  if (!rule) throw new Error('Geçersiz aksiyon');

  if (poc.status !== rule.from) {
    throw new Error(`Bu geçiş mevcut durumdan (${poc.status}) yapılamaz`);
  }

  const hasRequiredRole = rule.roles.some((r) => hasRole(roles, r));
  const isOwner = poc.owner_id === userId;
  if (!hasRequiredRole && !(rule.ownerAllowed && isOwner)) {
    throw new Error('Bu geçiş için yetkiniz yok');
  }

  await pocsRepo.updatePocStatus(poc.id, rule.to);
}

export async function addPocUpdate(params: {
  poc: InnovationPoc;
  userId: string;
  roles: InnovationRole[];
  content: string;
}): Promise<void> {
  if (params.poc.status === 'cancelled') {
    throw new Error('İptal edilen POC\'a güncelleme eklenemez');
  }
  const canUpdate =
    hasRole(params.roles, 'innovation_admin') ||
    hasRole(params.roles, 'innovation_evaluator') ||
    params.poc.owner_id === params.userId;
  if (!canUpdate) {
    throw new Error('Güncelleme eklemek için yetkiniz yok');
  }
  await pocsRepo.addPocUpdate({
    pocId: params.poc.id,
    authorId: params.userId,
    content: params.content,
  });
}
