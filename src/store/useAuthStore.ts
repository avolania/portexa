import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@/types";
import { dbLoadProfiles, dbUpsertProfile } from "@/lib/db";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  profiles: Record<string, User>;
  loadProfiles: () => Promise<void>;
  login: (user: User) => void;
  logout: () => void;
  updateUser: (data: Partial<User>) => void;
  updateProfile: (email: string, data: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      profiles: {},

      loadProfiles: async () => {
        const profiles = await dbLoadProfiles();
        // Merge with local profiles so offline-created ones aren't lost
        set((s) => ({ profiles: { ...s.profiles, ...profiles } }));
      },

      login: (incoming) => {
        const saved = get().profiles[incoming.email];
        const merged: User = saved
          ? { ...incoming, ...saved, rememberMe: incoming.rememberMe }
          : incoming;
        set((s) => ({
          user: merged,
          isAuthenticated: true,
          profiles: { ...s.profiles, [merged.email]: merged },
        }));
        dbUpsertProfile(merged.email, merged);
        if (typeof window !== "undefined") {
          sessionStorage.setItem("portexa-session", "1");
        }
      },

      logout: () => {
        set({ isAuthenticated: false });
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("portexa-session");
        }
      },

      updateUser: (data) =>
        set((s) => {
          const updated = s.user ? { ...s.user, ...data } : null;
          if (updated) dbUpsertProfile(updated.email, updated);
          return {
            user: updated,
            profiles: updated
              ? { ...s.profiles, [updated.email]: updated }
              : s.profiles,
          };
        }),

      updateProfile: (email, data) =>
        set((s) => {
          const existing = s.profiles[email];
          if (!existing) return {};
          const updated = { ...existing, ...data };
          dbUpsertProfile(email, updated);
          return {
            profiles: { ...s.profiles, [email]: updated },
            user: s.user?.email === email ? { ...s.user, ...data } : s.user,
          };
        }),
    }),
    {
      name: "auth-storage",
      skipHydration: true,
      // Only persist session state locally — profiles are loaded from Supabase
      partialize: (s) => ({
        user: s.user,
        isAuthenticated: s.isAuthenticated,
        profiles: s.profiles,
      }),
    }
  )
);
