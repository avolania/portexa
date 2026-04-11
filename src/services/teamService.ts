import type { TeamMember, UserRole } from "@/types";
import { dbLoadAll, dbUpsert, dbDelete } from "@/lib/db";

export async function loadTeamMembers(): Promise<TeamMember[]> {
  return dbLoadAll<TeamMember>("team_members");
}

export async function createMember(member: TeamMember, orgId: string): Promise<void> {
  await dbUpsert("team_members", member.id, member, orgId);
}

export async function updateMember(
  id: string,
  patch: Partial<TeamMember>,
  current: TeamMember[]
): Promise<TeamMember | null> {
  const existing = current.find((m) => m.id === id);
  if (!existing) return null;
  const updated: TeamMember = { ...existing, ...patch };
  await dbUpsert("team_members", id, updated);
  return updated;
}

export async function removeMember(id: string): Promise<void> {
  await dbDelete("team_members", id);
}

export async function changeMemberRole(
  id: string,
  role: UserRole,
  current: TeamMember[]
): Promise<TeamMember | null> {
  return updateMember(id, { role }, current);
}

export async function assignMemberToProject(
  memberId: string,
  projectId: string,
  current: TeamMember[]
): Promise<TeamMember | null> {
  const existing = current.find((m) => m.id === memberId);
  if (!existing || existing.projectIds.includes(projectId)) return null;
  return updateMember(memberId, { projectIds: [...existing.projectIds, projectId] }, current);
}

export async function unassignMemberFromProject(
  memberId: string,
  projectId: string,
  current: TeamMember[]
): Promise<TeamMember | null> {
  const existing = current.find((m) => m.id === memberId);
  if (!existing) return null;
  return updateMember(
    memberId,
    { projectIds: existing.projectIds.filter((p) => p !== projectId) },
    current
  );
}

export async function resetMembers(members: TeamMember[], orgId: string): Promise<void> {
  await Promise.all(members.map((m) => dbUpsert("team_members", m.id, m, orgId)));
}
