import { ITSMRole, ChangeType } from './enums';
import type { SLAPolicyEntry, BusinessHoursConfig } from './interfaces';
import { DEFAULT_SLA_POLICIES, DEFAULT_BUSINESS_HOURS } from './interfaces';
import { Priority } from './enums';

// ─── ITSM Group ───────────────────────────────────────────────────────────────

export type ITSMGroupType = 'all' | 'incident' | 'service_request' | 'change_request';

export interface ITSMConfigGroup {
  id: string;
  name: string;
  description?: string;
  type: ITSMGroupType;
  memberIds: string[];
  createdAt: string;
}

// ─── Approval Workflow ────────────────────────────────────────────────────────

/** Her onay adımında onaylayıcı nasıl seçilir */
export type ApproverStepType = 'user' | 'role' | 'group';

/** Grup/rol bazlı adımlarda: herhangi biri mi onaylamalı yoksa tamamı mı */
export type ApprovalStepMode = 'any' | 'all';

export interface ApprovalWorkflowStep {
  id: string;
  order: number;
  label: string;
  approverType: ApproverStepType;
  /** Sadece approverType === 'user' için */
  userId?: string;
  /** Sadece approverType === 'role' için */
  itsmRole?: ITSMRole;
  /** Sadece approverType === 'group' için */
  groupId?: string;
  /** Grup/rol adımlarında: any = birisi yeterli, all = hepsi onaylamalı */
  approvalMode: ApprovalStepMode;
}

export interface ApprovalWorkflowTemplate {
  id: string;
  name: string;
  description?: string;
  steps: ApprovalWorkflowStep[];
  createdAt: string;
}

/** CR'da her değişiklik tipine hangi workflow atandığı */
export type CRApprovalWorkflows = Record<ChangeType, string | null>;

/** SR genel onay konfigürasyonu */
export interface SRApprovalConfig {
  requireApproval: boolean;
  workflowId: string | null;
}

// ─── SR SLA ───────────────────────────────────────────────────────────────────

export interface SRSLAEntry {
  priority: Priority;
  fulfillmentMinutes: number;
  useBusinessHours: boolean;
}

// ─── ITSM Config ──────────────────────────────────────────────────────────────

export interface ITSMCategories {
  incidentCategories: string[];
  serviceRequestTypes: string[];
  changeRequestCategories: string[];
}

export interface ITSMConfig {
  groups: ITSMConfigGroup[];
  userRoles: Record<string, ITSMRole>;
  categories: ITSMCategories;
  incidentSLAPolicies: SLAPolicyEntry[];
  srSLAPolicies: SRSLAEntry[];
  businessHours: BusinessHoursConfig;
  approvalWorkflows: ApprovalWorkflowTemplate[];
  crApprovalWorkflows: CRApprovalWorkflows;
  srApprovalConfig: SRApprovalConfig;
}

// ─── Defaults ────────────────────────────────────────────────────────────────

export const DEFAULT_SR_SLA_POLICIES: SRSLAEntry[] = [
  { priority: Priority.CRITICAL, fulfillmentMinutes: 480,  useBusinessHours: false },
  { priority: Priority.HIGH,     fulfillmentMinutes: 1440, useBusinessHours: true  },
  { priority: Priority.MEDIUM,   fulfillmentMinutes: 4320, useBusinessHours: true  },
  { priority: Priority.LOW,      fulfillmentMinutes: 10080, useBusinessHours: true },
];

export const DEFAULT_ITSM_CATEGORIES: ITSMCategories = {
  incidentCategories: ['Ağ', 'Donanım', 'Yazılım', 'SAP', 'Güvenlik', 'Diğer'],
  serviceRequestTypes: ['Erişim Talebi', 'Donanım Talebi', 'Yazılım Kurulum', 'Yetki Talebi', 'Diğer'],
  changeRequestCategories: ['Yazılım Değişikliği', 'Altyapı Değişikliği', 'SAP Konfigürasyonu', 'Güvenlik Değişikliği', 'Diğer'],
};

export const DEFAULT_CR_APPROVAL_WORKFLOWS: CRApprovalWorkflows = {
  [ChangeType.STANDARD]:  null,
  [ChangeType.NORMAL]:    null,
  [ChangeType.EMERGENCY]: null,
};

export const DEFAULT_SR_APPROVAL_CONFIG: SRApprovalConfig = {
  requireApproval: false,
  workflowId: null,
};

export const DEFAULT_ITSM_CONFIG: ITSMConfig = {
  groups: [],
  userRoles: {},
  categories: DEFAULT_ITSM_CATEGORIES,
  incidentSLAPolicies: DEFAULT_SLA_POLICIES,
  srSLAPolicies: DEFAULT_SR_SLA_POLICIES,
  businessHours: DEFAULT_BUSINESS_HOURS,
  approvalWorkflows: [],
  crApprovalWorkflows: DEFAULT_CR_APPROVAL_WORKFLOWS,
  srApprovalConfig: DEFAULT_SR_APPROVAL_CONFIG,
};

// ─── UI label maps ────────────────────────────────────────────────────────────

export const ITSM_ROLE_META: Record<ITSMRole, { label: string; color: string; bg: string }> = {
  [ITSMRole.END_USER]:             { label: 'Son Kullanıcı',      color: 'text-gray-600',    bg: 'bg-gray-100'    },
  [ITSMRole.L1_AGENT]:             { label: 'L1 Destek',          color: 'text-blue-600',    bg: 'bg-blue-100'    },
  [ITSMRole.L2_L3_SPECIALIST]:     { label: 'L2/L3 Uzman',        color: 'text-indigo-600',  bg: 'bg-indigo-100'  },
  [ITSMRole.CHANGE_MANAGER]:       { label: 'Değişiklik Yöneticisi', color: 'text-violet-600', bg: 'bg-violet-100' },
  [ITSMRole.SERVICE_DESK_MANAGER]: { label: 'SD Müdürü',          color: 'text-emerald-600', bg: 'bg-emerald-100' },
  [ITSMRole.ADMIN]:                { label: 'ITSM Admin',         color: 'text-rose-600',    bg: 'bg-rose-100'    },
};

export const GROUP_TYPE_META: Record<ITSMGroupType, { label: string }> = {
  all:             { label: 'Tüm Modüller' },
  incident:        { label: 'Incident'      },
  service_request: { label: 'Servis Talebi' },
  change_request:  { label: 'Değişiklik'    },
};
