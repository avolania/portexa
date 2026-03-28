import { dbLoadAll } from '@/lib/db';

type TicketPrefix = 'INC' | 'REQ' | 'CHG';

const PREFIX_TABLE: Record<TicketPrefix, string> = {
  INC: 'itsm_incidents',
  REQ: 'itsm_service_requests',
  CHG: 'itsm_change_requests',
};

/**
 * Generates the next sequential ticket number for the org.
 * Format: INC-0001, REQ-0023, CHG-0007
 *
 * NOTE: Not atomic — safe for low-concurrency usage.
 */
export async function generateTicketNumber(prefix: TicketPrefix): Promise<string> {
  const table = PREFIX_TABLE[prefix];
  const existing = await dbLoadAll<{ number: string }>(table);
  // Find max sequence from existing numbers like "INC-0042"
  const max = existing.reduce((acc, item) => {
    const match = item.number?.match(/-(\d+)$/);
    const seq = match ? parseInt(match[1], 10) : 0;
    return Math.max(acc, seq);
  }, 0);
  return `${prefix}-${String(max + 1).padStart(4, '0')}`;
}
