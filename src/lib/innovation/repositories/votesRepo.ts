import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function findUserVote(ideaId: string, userId: string): Promise<number | null> {
  const { data } = await supabaseAdmin
    .from('innovation_votes')
    .select('value')
    .eq('idea_id', ideaId)
    .eq('user_id', userId)
    .single();
  return data ? (data.value as number) : null;
}

export async function upsertVote(ideaId: string, userId: string, value: 1 | -1): Promise<void> {
  const { error } = await supabaseAdmin
    .from('innovation_votes')
    .upsert(
      { id: crypto.randomUUID(), idea_id: ideaId, user_id: userId, value, created_at: new Date().toISOString() },
      { onConflict: 'idea_id,user_id' }
    );
  if (error) throw new Error(error.message);
}

export async function deleteVote(ideaId: string, userId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('innovation_votes')
    .delete()
    .eq('idea_id', ideaId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}

export async function getNetVoteCount(ideaId: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from('innovation_votes')
    .select('value')
    .eq('idea_id', ideaId);
  if (error || !data) return 0;
  return data.reduce((sum, r) => sum + (r.value as number), 0);
}

export async function syncVoteCount(ideaId: string): Promise<void> {
  const net = await getNetVoteCount(ideaId);
  const { error } = await supabaseAdmin
    .from('innovation_ideas')
    .update({ vote_count: net, updated_at: new Date().toISOString() })
    .eq('id', ideaId);
  if (error) throw new Error(error.message);
}
