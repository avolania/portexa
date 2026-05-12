export type IdeaStatus =
  | 'draft' | 'submitted' | 'under_review' | 'approved'
  | 'rejected' | 'implemented' | 'archived';

export type InnovationRole = 'innovation_evaluator' | 'innovation_admin' | null;

export interface InnovationStage {
  id: string;
  order_index: number;
  name: string;
  description: string;
  color: string;
  min_score_to_advance: number;
  required_evaluations: number;
  is_active: boolean;
}

export interface IdeaAuthor {
  id: string;
  name: string;
  avatar?: string;
}

export interface IdeaTag {
  id: string;
  name: string;
  color: string;
}

export interface EvaluationCriterion {
  id: string;
  name: string;
  description: string;
  weight: number;
  max_score: number;
  order_index: number;
  is_active: boolean;
}

export interface EvaluationScore {
  id: string;
  evaluation_id: string;
  criterion_id: string;
  criterion?: EvaluationCriterion;
  score: number;
  comment?: string;
}

export interface IdeaEvaluation {
  id: string;
  idea_id: string;
  evaluator_id: string;
  evaluator?: IdeaAuthor;
  stage_id: string;
  notes: string;
  total_score: number;
  created_at: string;
  scores?: EvaluationScore[];
}

export interface IdeaComment {
  id: string;
  idea_id: string;
  author_id: string;
  author?: IdeaAuthor;
  parent_id: string | null;
  body: string;
  created_at: string;
  replies?: IdeaComment[];
}

export interface StageHistoryEntry {
  id: string;
  idea_id: string;
  from_stage_id: string | null;
  to_stage_id: string;
  from_stage?: Pick<InnovationStage, 'id' | 'name' | 'color'>;
  to_stage?: Pick<InnovationStage, 'id' | 'name' | 'color'>;
  changed_by: string;
  changer?: IdeaAuthor;
  reason: string;
  created_at: string;
}

export interface InnovationIdea {
  id: string;
  idea_number: string;
  org_id: string;
  submitter_id: string;
  submitter?: IdeaAuthor;
  stage_id: string;
  stage?: InnovationStage;
  status: IdeaStatus;
  title: string;
  description: string;
  category: string;
  impact_score: number;
  feasibility_score: number;
  composite_score: number;
  vote_count: number;
  comment_count: number;
  estimated_value?: number;
  currency_code: string;
  created_at: string;
  updated_at: string;
  tags?: IdeaTag[];
  comments?: IdeaComment[];
  evaluations?: IdeaEvaluation[];
  stage_history?: StageHistoryEntry[];
  user_vote?: number | null;
}

export interface InnovationStats {
  total_ideas: number;
  this_month: number;
  under_review: number;
  implemented: number;
  user_role: InnovationRole;
  by_stage: Array<{
    stage_id: string;
    stage_name: string;
    stage_color: string;
    count: number;
  }>;
  top_ideas: Array<{
    id: string;
    idea_number: string;
    title: string;
    vote_count: number;
    composite_score: number;
    stage_name: string;
    stage_color: string;
  }>;
  recent_activity: Array<{
    type: 'new_idea' | 'stage_change' | 'evaluation';
    idea_id: string;
    idea_number: string;
    idea_title: string;
    actor_name: string;
    detail?: string;
    created_at: string;
  }>;
}

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface CreateIdeaDto {
  title: string;
  description: string;
  category: string;
  estimated_value?: number;
  currency_code?: string;
  tag_ids?: string[];
}

export interface UpdateIdeaDto {
  title?: string;
  description?: string;
  category?: string;
  estimated_value?: number;
  currency_code?: string;
  status?: IdeaStatus;
}

export interface CreateCommentDto {
  body: string;
  parent_id?: string | null;
}

export interface CreateEvaluationDto {
  notes: string;
  scores: Array<{ criterion_id: string; score: number; comment?: string }>;
}

export interface AdvanceStageDto {
  reason: string;
}

export interface CreateStageDto {
  name: string;
  color: string;
  min_score_to_advance: number;
  required_evaluations: number;
}

export interface UpdateStageDto {
  name?: string;
  color?: string;
  min_score_to_advance?: number;
  required_evaluations?: number;
  is_active?: boolean;
  order_index?: number;
}

export interface CreateCriterionDto {
  name: string;
  description?: string;
  weight: number;
  max_score: number;
}

export interface UpdateCriterionDto {
  name?: string;
  description?: string;
  weight?: number;
  max_score?: number;
  is_active?: boolean;
  order_index?: number;
}

export interface IdeasListParams {
  org_id: string;
  stage_id?: string;
  status?: string;
  search?: string;
  sort?: 'date' | 'score' | 'votes';
  page?: number;
  limit?: number;
}
