import { supabase } from '@/lib/supabase';

export type TicketPrefix = 'INC' | 'REQ' | 'CHG';

/**
 * Atomically generates the next sequential ticket number via a Supabase RPC.
 * The DB-side UPDATE ... RETURNING is safe under concurrent creates.
 * Format: INC-0001, REQ-0023, CHG-0007
 *
 * Requires: supabase-ticket-sequences.sql applied to the project.
 */
export async function generateTicketNumber(prefix: TicketPrefix): Promise<string> {
  const { data, error } = await supabase.rpc('next_ticket_number', { p_prefix: prefix });
  if (error) throw new Error(`Ticket numarası oluşturulamadı (${prefix}): ${error.message}`);
  return data as string;
}
