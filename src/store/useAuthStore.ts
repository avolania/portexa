import { create } from "zustand";
import type { User, Organization } from "@/types";
import { supabase } from "@/lib/supabase";
import { dbLoadProfiles, dbLoadProfile, dbUpsertProfile, dbLoadOrg, dbUpsertOrg } from "@/lib/db";
import { logAudit } from "@/lib/audit";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  profiles: Record<string, User>;

  initAuth: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string, profileData: Partial<Omit<User, "id" | "email">> & { orgName?: string; orgIndustry?: string; orgSize?: Organization["size"]; orgWebsite?: string }) => Promise<string | null>;
  signUpWithInvitation: (token: string, name: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<string | null>;
  loadProfiles: () => Promise<void>;
  updateUser: (data: Partial<User>) => Promise<void>;
  updateProfile: (userId: string, data: Partial<User>) => Promise<void>;
}

// ─── Profil oluşturma (metadata'dan) ──────────────────────────────────────────

async function buildAndSaveProfile(
  userId: string,
  email: string,
  meta: Record<string, unknown>
): Promise<User> {
  const orgId = (meta.orgId as string | undefined) ?? crypto.randomUUID();

  // Org kaydını oluştur/güncelle — tablo henüz yoksa sessizce geç
  try {
    const existingOrg = await dbLoadOrg(orgId);
    if (!existingOrg) {
      const org: Organization = {
        id: orgId,
        name: (meta.orgName as string | undefined) ?? (meta.company as string | undefined) ?? "Organizasyon",
        industry: meta.orgIndustry as string | undefined,
        size: meta.orgSize as Organization["size"] | undefined,
        plan: "free",
        status: "trial",
        website: meta.orgWebsite as string | undefined,
        createdAt: new Date().toISOString(),
      };
      await dbUpsertOrg(orgId, org);
    }
  } catch {
    // organizations tablosu henüz oluşturulmamışsa auth akışı engellenmez
  }

  // L-5: meta.role'a güvenme — self-signup her zaman 'admin', sistem rolleri
  // (system_admin, approver, vb.) hiçbir zaman metadata'dan alınmaz.
  const allowedSelfSignupRoles: User["role"][] = ["admin", "pm", "member", "viewer"];
  const rawRole = meta.role as string | undefined;
  const role: User["role"] = allowedSelfSignupRoles.includes(rawRole as User["role"])
    ? (rawRole as User["role"])
    : "admin";

  const profile: User = {
    id: userId,
    email,
    name: (meta.name as string | undefined) ?? "Kullanıcı",
    role,
    language: "tr",
    orgId,
    company: (meta.company as string | undefined) ?? (meta.orgName as string | undefined),
    title: meta.title as string | undefined,
    department: meta.department as string | undefined,
    phone: meta.phone as string | undefined,
  };
  await dbUpsertProfile(userId, profile);
  return profile;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  isAuthenticated: false,
  loading: true,
  profiles: {},

  initAuth: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const existing = await dbLoadProfile(session.user.id);
      if (existing) {
        set({ user: existing, isAuthenticated: true, loading: false });
      } else {
        const profile = await buildAndSaveProfile(
          session.user.id,
          session.user.email ?? "",
          session.user.user_metadata ?? {}
        );
        set({ user: profile, isAuthenticated: true, loading: false });
      }
    } else {
      set({ loading: false });
    }

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        const existing = await dbLoadProfile(session.user.id);
        if (existing) {
          set({ user: existing, isAuthenticated: true, loading: false });
          logAudit(existing, "user.login");
        } else {
          const profile = await buildAndSaveProfile(
            session.user.id,
            session.user.email ?? "",
            session.user.user_metadata ?? {}
          );
          set({ user: profile, isAuthenticated: true, loading: false });
          logAudit(profile, "user.login");
        }
      } else if (event === "SIGNED_OUT") {
        const current = get().user;
        if (current) logAudit(current, "user.logout");
        set({ user: null, isAuthenticated: false, loading: false, profiles: {} });
      }
    });
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return error.message;
    return null;
  },

  signUp: async (email, password, profileData) => {
    // Yeni org oluştur — orgId metadata'ya eklenir, email onayı sonrası profil + org yaratılır
    const orgId = crypto.randomUUID();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: profileData.name ?? "Kullanıcı",
          company: profileData.orgName ?? profileData.company,
          orgName: profileData.orgName ?? profileData.company,
          orgIndustry: profileData.orgIndustry,
          orgSize: profileData.orgSize,
          orgWebsite: profileData.orgWebsite,
          title: profileData.title,
          department: profileData.department,
          phone: profileData.phone,
          orgId,
          role: "admin", // ilk kayıt olan kişi admin
        },
      },
    });
    if (error) return error.message;
    return null;
  },

  signUpWithInvitation: async (token, name, password) => {
    // Sunucu tarafında kullanıcıyı e-posta onayı olmadan oluştur
    const res = await fetch("/api/invite/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, name, password }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return (body.error as string | undefined) ?? "Hesap oluşturulamadı.";
    }

    // Hesap oluşturuldu — direkt giriş yap (e-posta onayı gerekmez)
    const email = body.email as string;
    if (email) {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) return signInError.message;
    }

    return null;
  },

  signOut: async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // signOut hatası local state'i temizlememizi engellememeli
    }
    if (typeof window !== "undefined") sessionStorage.clear();
    set({ user: null, isAuthenticated: false, profiles: {} });
  },

  resetPassword: async (email) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/sifre-sifirla`,
    });
    if (error) return error.message;
    return null;
  },

  loadProfiles: async () => {
    const orgId = get().user?.orgId;
    const profiles = await dbLoadProfiles(orgId);
    set({ profiles });
  },

  updateUser: async (data) => {
    const current = get().user;
    if (!current) return;
    const updated = { ...current, ...data };
    set({ user: updated });
    try {
      await dbUpsertProfile(current.id, updated);
    } catch (err) {
      set({ user: current });
      throw err;
    }
  },

  updateProfile: async (userId, data) => {
    const existing = get().profiles[userId];
    if (!existing) return;
    const updated = { ...existing, ...data };
    set((s) => ({
      profiles: { ...s.profiles, [userId]: updated },
      user: s.user?.id === userId ? { ...s.user, ...data } : s.user,
    }));
    try {
      await dbUpsertProfile(userId, updated);
      const actor = get().user;
      if (actor) {
        if (data.role && data.role !== existing.role) {
          logAudit(actor, "user.role_changed", {
            resourceType: "user",
            resourceId: userId,
            resourceName: existing.email,
            changes: { before: { role: existing.role }, after: { role: data.role } },
          });
        } else {
          logAudit(actor, "user.profile_updated", {
            resourceType: "user",
            resourceId: userId,
            resourceName: existing.email,
          });
        }
      }
    } catch (err) {
      set((s) => ({
        profiles: { ...s.profiles, [userId]: existing },
        user: s.user?.id === userId ? existing : s.user,
      }));
      throw err;
    }
  },
}));
