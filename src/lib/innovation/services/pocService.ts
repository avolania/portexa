import { supabaseAdmin } from '@/lib/supabaseAdmin';
import * as pocsRepo from '../repositories/pocsRepo';
import type {
  InnovationPoc, CreatePocDto, UpdatePocDto, TransitionPocDto,
  PocStatus, PocTransitionAction,
} from '../types';
import { hasInnovPerm, type InnovationPermission } from '../permissions';

// ── Transition rules ────────────────────────────────────────────────────────

type TransitionRule = {
  from: PocStatus;
  to: PocStatus;
  permission: InnovationPermission;
  ownerAllowed?: boolean;
};

const TRANSITIONS: Record<PocTransitionAction, TransitionRule> = {
  submit_for_approval: {
    from: 'draft',
    to: 'pending_sponsor_approval',
    permission: 'pocs.manage',
    ownerAllowed: true,
  },
  approve_start: {
    from: 'pending_sponsor_approval',
    to: 'active',
    permission: 'pocs.approve',
  },
  reject_start: {
    from: 'pending_sponsor_approval',
    to: 'draft',
    permission: 'pocs.approve',
  },
  hold: {
    from: 'active',
    to: 'on_hold',
    permission: 'pocs.manage',
    ownerAllowed: true,
  },
  resume: {
    from: 'on_hold',
    to: 'active',
    permission: 'pocs.manage',
    ownerAllowed: true,
  },
  submit_completion: {
    from: 'active',
    to: 'pending_completion_approval',
    permission: 'pocs.manage',
    ownerAllowed: true,
  },
  approve_completion: {
    from: 'pending_completion_approval',
    to: 'completed',
    permission: 'pocs.approve',
  },
  reject_completion: {
    from: 'pending_completion_approval',
    to: 'active',
    permission: 'pocs.approve',
  },
  cancel: {
    from: 'draft',
    to: 'cancelled',
    permission: 'pocs.manage',
  },
};

const CANCELLABLE: PocStatus[] = [
  'draft', 'pending_sponsor_approval', 'active', 'on_hold', 'pending_completion_approval',
];

// ── Service functions ────────────────────────────────────────────────────────

export async function createPoc(params: {
  orgId: string;
  userId: string;
  permissions: Set<InnovationPermission>;
  dto: CreatePocDto;
}): Promise<InnovationPoc> {
  if (!hasInnovPerm(params.permissions, 'pocs.manage') && !hasInnovPerm(params.permissions, 'pocs.approve')) {
    throw new Error('POC oluşturmak için pocs.manage veya pocs.approve yetkisi gereklidir');
  }

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

  const existing = await pocsRepo.findActivePocByIdeaId(params.dto.idea_id);
  if (existing) throw new Error("Bu fikrin zaten aktif bir POC'u var");

  return pocsRepo.createPoc({ orgId: params.orgId, dto: params.dto });
}

export async function updatePoc(params: {
  poc: InnovationPoc;
  userId: string;
  permissions: Set<InnovationPermission>;
  dto: UpdatePocDto;
}): Promise<void> {
  const canManage = hasInnovPerm(params.permissions, 'pocs.manage');
  const isOwner = params.poc.owner_id === params.userId;
  if (!canManage && !isOwner) {
    throw new Error('POC güncellemek için pocs.manage yetkisi veya POC sahibi olmanız gerekir');
  }
  if (params.poc.status === 'completed' || params.poc.status === 'cancelled') {
    throw new Error('Tamamlanan veya iptal edilen POC güncellenemez');
  }
  await pocsRepo.updatePoc(params.poc.id, params.dto);
}

export async function transitionPoc(params: {
  poc: InnovationPoc;
  userId: string;
  permissions: Set<InnovationPermission>;
  dto: TransitionPocDto;
}): Promise<void> {
  const { poc, userId, permissions, dto } = params;

  if (dto.action === 'cancel') {
    if (!hasInnovPerm(permissions, 'pocs.manage')) {
      throw new Error('İptal etmek için pocs.manage yetkisi gereklidir');
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

  const hasPerm = hasInnovPerm(permissions, rule.permission);
  const isOwner = poc.owner_id === userId;
  if (!hasPerm && !(rule.ownerAllowed && isOwner)) {
    throw new Error('Bu geçiş için yetkiniz yok');
  }

  await pocsRepo.updatePocStatus(poc.id, rule.to);
}

export async function addPocUpdate(params: {
  poc: InnovationPoc;
  userId: string;
  permissions: Set<InnovationPermission>;
  content: string;
}): Promise<void> {
  if (params.poc.status === 'cancelled') {
    throw new Error("İptal edilen POC'a güncelleme eklenemez");
  }
  const canUpdate =
    hasInnovPerm(params.permissions, 'pocs.manage') ||
    hasInnovPerm(params.permissions, 'ideas.evaluate') ||
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
