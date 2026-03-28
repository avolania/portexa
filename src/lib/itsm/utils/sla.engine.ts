import type { BusinessHoursConfig, IncidentSLA, ServiceRequestSLA, SLAPolicyEntry } from '../types/interfaces';
import { DEFAULT_BUSINESS_HOURS, DEFAULT_SLA_POLICIES } from '../types/interfaces';
import { Priority } from '../types/enums';

// ─── Timezone helpers ──────────────────────────────────────────────────────────

interface LocalParts {
  year: number;
  month: number; // 0-indexed
  day: number;
  hour: number;
  minute: number;
  dayOfWeek: number; // 0=Sun
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

function getLocalParts(date: Date, tz: string): LocalParts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
    hour12: false, weekday: 'short',
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    year:      parseInt(parts.year),
    month:     parseInt(parts.month) - 1,
    day:       parseInt(parts.day),
    hour:      parseInt(parts.hour) % 24,
    minute:    parseInt(parts.minute),
    dayOfWeek: WEEKDAY_INDEX[parts.weekday] ?? 0,
  };
}

function toISODateStr(p: LocalParts): string {
  return `${p.year}-${String(p.month + 1).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

// ─── Business hours checks ────────────────────────────────────────────────────

function isBusinessTime(date: Date, cfg: BusinessHoursConfig): boolean {
  const p = getLocalParts(date, cfg.timezone);
  if (!cfg.workDays.includes(p.dayOfWeek)) return false;
  if (cfg.holidays.includes(toISODateStr(p))) return false;
  const minuteOfDay = p.hour * 60 + p.minute;
  const start = cfg.startHour * 60 + cfg.startMinute;
  const end   = cfg.endHour   * 60 + cfg.endMinute;
  return minuteOfDay >= start && minuteOfDay < end;
}

/** Move `date` forward (1-minute steps, max 10 days) to the next business-hours start. */
function nextBusinessStart(date: Date, cfg: BusinessHoursConfig): Date {
  const startMin = cfg.startHour * 60 + cfg.startMinute;
  const endMin   = cfg.endHour   * 60 + cfg.endMinute;
  let cur = new Date(date);

  for (let i = 0; i < 14400; i++) { // max 10 days * 1440 min
    if (isBusinessTime(cur, cfg)) return cur;
    const p = getLocalParts(cur, cfg.timezone);
    const mow = p.hour * 60 + p.minute;
    if (mow < startMin) {
      cur = new Date(cur.getTime() + (startMin - mow) * 60_000);
    } else if (mow >= endMin) {
      // jump to start of next day's business hours
      const minutesToNextDayStart = (24 * 60 - mow) + startMin;
      cur = new Date(cur.getTime() + minutesToNextDayStart * 60_000);
    } else {
      cur = new Date(cur.getTime() + 60_000);
    }
  }
  return cur;
}

// ─── Core calculation ─────────────────────────────────────────────────────────

/** Add `minutes` of business time starting from `start`. */
export function addBusinessMinutes(
  start: Date,
  minutes: number,
  cfg: BusinessHoursConfig,
): Date {
  let remaining = minutes;
  let cur = new Date(start);

  if (!isBusinessTime(cur, cfg)) {
    cur = nextBusinessStart(cur, cfg);
  }

  while (remaining > 0) {
    const p       = getLocalParts(cur, cfg.timezone);
    const mow     = p.hour * 60 + p.minute;
    const endMin  = cfg.endHour * 60 + cfg.endMinute;
    const leftToday = endMin - mow;

    if (remaining <= leftToday) {
      return new Date(cur.getTime() + remaining * 60_000);
    }

    remaining -= leftToday;
    cur = nextBusinessStart(
      new Date(cur.getTime() + (leftToday + 1) * 60_000),
      cfg,
    );
  }
  return cur;
}

/** Count business minutes elapsed between two dates (paused minutes excluded). */
export function countBusinessMinutesElapsed(
  from: Date,
  to: Date,
  cfg: BusinessHoursConfig,
  pausedMinutes = 0,
): number {
  let elapsed = 0;
  let cur = new Date(from);
  const endMs = to.getTime();

  // Step in 1-minute increments (capped at 30 days for safety)
  const maxSteps = 30 * 24 * 60;
  for (let i = 0; i < maxSteps && cur.getTime() < endMs; i++) {
    if (isBusinessTime(cur, cfg)) elapsed++;
    cur = new Date(cur.getTime() + 60_000);
  }
  return Math.max(0, elapsed - pausedMinutes);
}

// ─── SLA factory functions ────────────────────────────────────────────────────

export function createIncidentSLA(
  createdAt: string,
  priority: Priority,
  cfg: BusinessHoursConfig = DEFAULT_BUSINESS_HOURS,
  policies: SLAPolicyEntry[] = DEFAULT_SLA_POLICIES,
): IncidentSLA {
  const policy = policies.find((p) => p.priority === priority) ?? policies[2];
  const created = new Date(createdAt);

  const responseDeadline   = policy.useBusinessHours
    ? addBusinessMinutes(created, policy.responseMinutes, cfg)
    : new Date(created.getTime() + policy.responseMinutes * 60_000);

  const resolutionDeadline = policy.useBusinessHours
    ? addBusinessMinutes(created, policy.resolutionMinutes, cfg)
    : new Date(created.getTime() + policy.resolutionMinutes * 60_000);

  return {
    responseDeadline:          responseDeadline.toISOString(),
    resolutionDeadline:        resolutionDeadline.toISOString(),
    responseBreached:          false,
    resolutionBreached:        false,
    totalPausedMinutes:        0,
    businessTimeElapsedMinutes: 0,
  };
}

export function createServiceRequestSLA(
  createdAt: string,
  priority: Priority,
  cfg: BusinessHoursConfig = DEFAULT_BUSINESS_HOURS,
  policies: SLAPolicyEntry[] = DEFAULT_SLA_POLICIES,
): ServiceRequestSLA {
  // Service requests use resolution SLA only (no response SLA)
  const policy = policies.find((p) => p.priority === priority) ?? policies[2];
  const created = new Date(createdAt);

  const fulfillmentDeadline = policy.useBusinessHours
    ? addBusinessMinutes(created, policy.resolutionMinutes, cfg)
    : new Date(created.getTime() + policy.resolutionMinutes * 60_000);

  return {
    fulfillmentDeadline: fulfillmentDeadline.toISOString(),
    slaBreached:         false,
  };
}

// ─── SLA breach check ─────────────────────────────────────────────────────────

export function checkIncidentSLABreaches(
  sla: IncidentSLA,
  now: Date = new Date(),
): { responseBreached: boolean; resolutionBreached: boolean } {
  return {
    responseBreached:   !sla.respondedAt && now > new Date(sla.responseDeadline),
    resolutionBreached: now > new Date(sla.resolutionDeadline),
  };
}

export function checkSRSLABreach(
  sla: ServiceRequestSLA,
  now: Date = new Date(),
): boolean {
  return now > new Date(sla.fulfillmentDeadline);
}

// ─── SLA pause / resume ───────────────────────────────────────────────────────

export function pauseIncidentSLA(sla: IncidentSLA, now = new Date()): IncidentSLA {
  if (sla.pausedAt) return sla; // already paused
  return { ...sla, pausedAt: now.toISOString() };
}

export function resumeIncidentSLA(sla: IncidentSLA, now = new Date()): IncidentSLA {
  if (!sla.pausedAt) return sla;
  const pausedMs = now.getTime() - new Date(sla.pausedAt).getTime();
  const pausedMinutes = Math.floor(pausedMs / 60_000);
  return {
    ...sla,
    pausedAt:           undefined,
    totalPausedMinutes: sla.totalPausedMinutes + pausedMinutes,
  };
}
