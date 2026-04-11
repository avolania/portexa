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

/** Move `date` forward to the next business-hours start (at most 366 day-level steps). */
function nextBusinessStart(date: Date, cfg: BusinessHoursConfig): Date {
  const startMin = cfg.startHour * 60 + cfg.startMinute;
  const endMin   = cfg.endHour   * 60 + cfg.endMinute;
  let cur = new Date(date);

  for (let i = 0; i < 366; i++) {
    if (isBusinessTime(cur, cfg)) return cur;
    const p   = getLocalParts(cur, cfg.timezone);
    const mow = p.hour * 60 + p.minute;
    if (mow < startMin) {
      // Before business hours — jump to start of today's business hours
      cur = new Date(cur.getTime() + (startMin - mow) * 60_000);
    } else if (mow >= endMin) {
      // After business hours — jump to start of next day's business hours
      const minutesToNextDayStart = (24 * 60 - mow) + startMin;
      cur = new Date(cur.getTime() + minutesToNextDayStart * 60_000);
    } else {
      // In business hours window but not a business day (holiday / non-work day)
      // Jump to midnight then loop will advance to next day's start
      const minutesToEndOfDay = 24 * 60 - mow;
      cur = new Date(cur.getTime() + minutesToEndOfDay * 60_000);
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

/**
 * Count business minutes elapsed between two dates (paused minutes excluded).
 *
 * O(days) day-based algorithm instead of the previous O(minutes) per-minute loop.
 * For a 30-day range this is ~30 iterations instead of 43,200.
 *
 * Edge cases preserved:
 *  - First/last day are counted partially (clamped to actual from/to time)
 *  - Non-work days and holidays are skipped
 *  - DST-safe: from/to minute-of-day resolved via Intl (getLocalParts);
 *    intermediate days iterated as UTC calendar dates (dayOfWeek is
 *    timezone-independent for any date string already expressed in cfg.timezone)
 */
export function countBusinessMinutesElapsed(
  from: Date,
  to: Date,
  cfg: BusinessHoursConfig,
  pausedMinutes = 0,
): number {
  if (to <= from) return 0;

  const startMin = cfg.startHour * 60 + cfg.startMinute;
  const endMin   = cfg.endHour   * 60 + cfg.endMinute;

  const fromParts    = getLocalParts(from, cfg.timezone);
  const toParts      = getLocalParts(to,   cfg.timezone);
  const fromDateStr  = toISODateStr(fromParts);
  const toDateStr    = toISODateStr(toParts);
  const fromMinOfDay = fromParts.hour * 60 + fromParts.minute;
  const toMinOfDay   = toParts.hour   * 60 + toParts.minute;

  let elapsed    = 0;
  let curDateStr = fromDateStr;

  // Max 366 iterations (one per calendar day)
  for (let d = 0; d < 366; d++) {
    if (curDateStr > toDateStr) break;

    const isFirst = curDateStr === fromDateStr;
    const isLast  = curDateStr === toDateStr;

    // dayOfWeek is a property of the calendar date string — timezone-independent
    const [cy, cm, cd] = curDateStr.split('-').map(Number);
    const dayOfWeek = new Date(Date.UTC(cy, cm - 1, cd)).getUTCDay();

    if (cfg.workDays.includes(dayOfWeek) && !cfg.holidays.includes(curDateStr)) {
      // Clamp to actual from/to times on the first and last day
      const dayStart = isFirst ? Math.max(startMin, fromMinOfDay) : startMin;
      const dayEnd   = isLast  ? Math.min(endMin,   toMinOfDay)   : endMin;

      if (dayEnd > dayStart) {
        elapsed += dayEnd - dayStart;
      }
    }

    if (isLast) break;

    // Advance to next calendar day (Date.UTC handles month/year overflow correctly)
    curDateStr = new Date(Date.UTC(cy, cm - 1, cd + 1)).toISOString().slice(0, 10);
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
  resolvedAt?: string,
): { responseBreached: boolean; resolutionBreached: boolean } {
  return {
    responseBreached:   !sla.respondedAt && now > new Date(sla.responseDeadline),
    resolutionBreached: !resolvedAt && now > new Date(sla.resolutionDeadline),
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

export function resumeIncidentSLA(
  sla: IncidentSLA,
  now = new Date(),
  cfg: BusinessHoursConfig = DEFAULT_BUSINESS_HOURS,
): IncidentSLA {
  if (!sla.pausedAt) return sla;
  const pausedMinutes = countBusinessMinutesElapsed(new Date(sla.pausedAt), now, cfg);
  return {
    ...sla,
    pausedAt:           undefined,
    totalPausedMinutes: sla.totalPausedMinutes + pausedMinutes,
  };
}
