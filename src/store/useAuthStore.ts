import { create } from "zustand";
import type { User } from "@/types";
import { supabase } from "@/lib/supabase";
import { dbLoadProfiles, dbLoadProfile, dbUpsertProfile } from "@/lib/db";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  profiles: Record<string, User>;

  initAuth: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string, profileData: Partial<Omit<User, "id" | "email">>) => Promise<string | null>;
  signUpWithInvitation: (token: string, name: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<string | null>;
  loadProfiles: () => Promise<void>;
  updateUser: (data: Partial<User>) => void;
  updateProfile: (userId: string, data: Partial<User>) => void;
}

// ─── Profil oluşturma (metadata'dan) ──────────────────────────────────────────

async function buildAndSaveProfile(
  userId: string,
  email: string,
  meta: Record<string, unknown>
): Promise<User> {
  const orgId = (meta.orgId as string | undefined) ?? crypto.randomUUID();
  const profile: User = {
    id: userId,
    email,
    name: (meta.name as string | undefined) ?? "Kullanıcı",
    role: (meta.role as User["role"] | undefined) ?? "admin",
    language: "tr",
    orgId,
    company: meta.company as string | undefined,
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
        } else {
          const profile = await buildAndSaveProfile(
            session.user.id,
            session.user.email ?? "",
            session.user.user_metadata ?? {}
          );
          set({ user: profile, isAuthenticated: true, loading: false });
        }
      } else if (event === "SIGNED_OUT") {
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
    // Yeni org oluştur — orgId metadata'ya eklenir, email onayı sonrası profil yaratılır
    const orgId = crypto.randomUUID();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: profileData.name ?? "Kullanıcı",
          company: profileData.company,
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
    // Token'ı validate et ve org bilgisini al
    const res = await fetch(`/api/invite/validate?token=${encodeURIComponent(token)}`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return (body.error as string | undefined) ?? "Davet geçersiz veya süresi dolmuş.";
    }
    const { email, orgId } = await res.json() as { email: string; orgId: string };

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, orgId, role: "member" },
      },
    });
    if (error) return error.message;

    // Token'ı kullanıldı olarak işaretle
    await fetch("/api/invite/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    return null;
  },

  signOut: async () => {
    await supabase.auth.signOut();
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
    const profiles = await dbLoadProfiles();
    set({ profiles });
  },

  updateUser: (data) => {
    const current = get().user;
    if (!current) return;
    const updated = { ...current, ...data };
    set({ user: updated });
    dbUpsertProfile(current.id, updated);
  },

  updateProfile: (userId, data) =>
    set((s) => {
      const existing = s.profiles[userId];
      if (!existing) return {};
      const updated = { ...existing, ...data };
      dbUpsertProfile(userId, updated);
      return {
        profiles: { ...s.profiles, [userId]: updated },
        user: s.user?.id === userId ? { ...s.user, ...data } : s.user,
      };
    }),
}));
