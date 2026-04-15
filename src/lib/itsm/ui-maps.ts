import {
  IncidentState,
  ServiceRequestState,
  ChangeRequestState,
  Priority,
  ChangeRisk,
  ChangeType,
  ApprovalState,
} from './types/enums';

// ─── Priority ─────────────────────────────────────────────────────────────────

export const ITSM_PRIORITY_MAP: Record<Priority, { label: string; badge: string; dot: string }> = {
  [Priority.CRITICAL]: { label: 'Kritik',  badge: 'bg-red-100 text-red-700',     dot: 'bg-red-500'     },
  [Priority.HIGH]:     { label: 'Yüksek',  badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
  [Priority.MEDIUM]:   { label: 'Orta',    badge: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-500'  },
  [Priority.LOW]:      { label: 'Düşük',   badge: 'bg-gray-100 text-gray-600',     dot: 'bg-gray-400'   },
};

// ─── Incident State ───────────────────────────────────────────────────────────

export const INCIDENT_STATE_MAP: Record<IncidentState, { label: string; badge: string }> = {
  [IncidentState.NEW]:         { label: 'Yeni',      badge: 'bg-blue-100 text-blue-700'    },
  [IncidentState.ASSIGNED]:    { label: 'Atandı',    badge: 'bg-indigo-100 text-indigo-700'},
  [IncidentState.IN_PROGRESS]: { label: 'İşlemde',   badge: 'bg-amber-100 text-amber-700'  },
  [IncidentState.PENDING]:     { label: 'Beklemede', badge: 'bg-gray-100 text-gray-600'    },
  [IncidentState.RESOLVED]:    { label: 'Çözüldü',   badge: 'bg-emerald-100 text-emerald-700' },
  [IncidentState.CLOSED]:      { label: 'Kapandı',   badge: 'bg-gray-200 text-gray-500'    },
};

// ─── Service Request State ────────────────────────────────────────────────────

export const SR_STATE_MAP: Record<ServiceRequestState, { label: string; badge: string }> = {
  [ServiceRequestState.DRAFT]:            { label: 'Taslak',           badge: 'bg-gray-100 text-gray-600'       },
  [ServiceRequestState.SUBMITTED]:        { label: 'İletildi',         badge: 'bg-blue-100 text-blue-700'       },
  [ServiceRequestState.PENDING_APPROVAL]: { label: 'Onay Bekliyor',    badge: 'bg-amber-100 text-amber-700'     },
  [ServiceRequestState.APPROVED]:         { label: 'Onaylandı',        badge: 'bg-indigo-100 text-indigo-700'   },
  [ServiceRequestState.IN_PROGRESS]:      { label: 'İşlemde',          badge: 'bg-blue-100 text-blue-700'       },
  [ServiceRequestState.PENDING]:          { label: 'Beklemede',        badge: 'bg-gray-100 text-gray-600'       },
  [ServiceRequestState.FULFILLED]:        { label: 'Karşılandı',       badge: 'bg-emerald-100 text-emerald-700' },
  [ServiceRequestState.CLOSED]:           { label: 'Kapandı',          badge: 'bg-gray-200 text-gray-500'       },
  [ServiceRequestState.REJECTED]:         { label: 'Reddedildi',       badge: 'bg-red-100 text-red-700'         },
  [ServiceRequestState.CANCELLED]:        { label: 'İptal Edildi',     badge: 'bg-gray-100 text-gray-500'       },
};

// ─── Change Request State ─────────────────────────────────────────────────────

export const CR_STATE_MAP: Record<ChangeRequestState, { label: string; badge: string }> = {
  [ChangeRequestState.PENDING_APPROVAL]: { label: 'Onay Bekliyor', badge: 'bg-amber-100 text-amber-700'   },
  [ChangeRequestState.SCHEDULED]: { label: 'Planlandı',   badge: 'bg-indigo-100 text-indigo-700'   },
  [ChangeRequestState.IMPLEMENT]: { label: 'Uygulama',    badge: 'bg-orange-100 text-orange-700'   },
  [ChangeRequestState.REVIEW]:    { label: 'İnceleme',    badge: 'bg-sky-100 text-sky-700'         },
  [ChangeRequestState.CLOSED]:    { label: 'Kapandı',     badge: 'bg-gray-200 text-gray-500'       },
  [ChangeRequestState.CANCELLED]: { label: 'İptal',       badge: 'bg-gray-100 text-gray-500'       },

};

// ─── Change Risk ──────────────────────────────────────────────────────────────

export const CHANGE_RISK_MAP: Record<ChangeRisk, { label: string; badge: string }> = {
  [ChangeRisk.CRITICAL]: { label: 'Kritik', badge: 'bg-red-100 text-red-700'       },
  [ChangeRisk.HIGH]:     { label: 'Yüksek', badge: 'bg-orange-100 text-orange-700' },
  [ChangeRisk.MODERATE]: { label: 'Orta',   badge: 'bg-amber-100 text-amber-700'   },
  [ChangeRisk.LOW]:      { label: 'Düşük',  badge: 'bg-gray-100 text-gray-600'     },
};

// ─── Change Type ──────────────────────────────────────────────────────────────

export const CHANGE_TYPE_MAP: Record<ChangeType, { label: string; badge: string }> = {
  [ChangeType.STANDARD]:  { label: 'Standart', badge: 'bg-blue-100 text-blue-700'    },
  [ChangeType.NORMAL]:    { label: 'Normal',   badge: 'bg-gray-100 text-gray-600'    },
  [ChangeType.EMERGENCY]: { label: 'Acil',     badge: 'bg-red-100 text-red-700'      },
};

// ─── Approval State ───────────────────────────────────────────────────────────

export const APPROVAL_STATE_MAP: Record<ApprovalState, { label: string; badge: string }> = {
  [ApprovalState.NOT_REQUIRED]:  { label: 'Onay Gerekmiyor', badge: 'bg-gray-100 text-gray-400'       },
  [ApprovalState.NOT_REQUESTED]: { label: 'Onay Gerekmez',   badge: 'bg-gray-100 text-gray-500'       },
  [ApprovalState.REQUESTED]:     { label: 'Onay Bekliyor',   badge: 'bg-amber-100 text-amber-700'     },
  [ApprovalState.APPROVED]:      { label: 'Onaylandı',       badge: 'bg-emerald-100 text-emerald-700' },
  [ApprovalState.REJECTED]:      { label: 'Reddedildi',      badge: 'bg-red-100 text-red-700'         },
};
