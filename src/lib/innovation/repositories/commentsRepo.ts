import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { IdeaComment, CreateCommentDto } from '../types';

const mapProfile = (p: Record<string, unknown> | null | undefined) =>
  p ? { id: p.id as string, name: ((p.data as Record<string, unknown>)?.name ?? 'Bilinmiyor') as string } : undefined;

export async function findCommentsByIdea(ideaId: string): Promise<IdeaComment[]> {
  const { data, error } = await supabaseAdmin
    .from('innovation_comments')
    .select('*, author:auth_profiles!innovation_comments_author_id_fkey(id, data)')
    .eq('idea_id', ideaId)
    .order('created_at');
  if (error) throw new Error(error.message);

  return ((data ?? []) as Record<string, unknown>[]).map((c) => ({
    ...c,
    author: mapProfile(c.author as Record<string, unknown>),
  })) as IdeaComment[];
}

export async function createComment(params: {
  ideaId: string;
  authorId: string;
  dto: CreateCommentDto;
}): Promise<IdeaComment> {
  const { data, error } = await supabaseAdmin
    .from('innovation_comments')
    .insert({
      id: crypto.randomUUID(),
      idea_id: params.ideaId,
      author_id: params.authorId,
      parent_id: params.dto.parent_id ?? null,
      body: params.dto.body,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  const { count } = await supabaseAdmin
    .from('innovation_comments')
    .select('id', { count: 'exact', head: true })
    .eq('idea_id', params.ideaId);
  await supabaseAdmin
    .from('innovation_ideas')
    .update({ comment_count: count ?? 0, updated_at: new Date().toISOString() })
    .eq('id', params.ideaId);

  return data as unknown as IdeaComment;
}
