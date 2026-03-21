import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@/types";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  profiles: Record<string, User>; // email → saved profile (logout sonrası da korunur)
  login: (user: User) => void;
  logout: () => void;
  updateUser: (data: Partial<User>) => void;
  // Admin: herhangi bir kullanıcının profilini günceller (rol değişikliği vb.)
  updateProfile: (email: string, data: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      profiles: {},
      login: (incoming) => {
        // Daha önce kaydedilmiş profil varsa birleştir (id, name, title vb. korunur)
        const saved = get().profiles[incoming.email];
        // saved profil öncelikli (ad, unvan vb.), sadece rememberMe güncel girişten alınır
        const merged: User = saved
          ? { ...incoming, ...saved, rememberMe: incoming.rememberMe }
          : incoming;
        set((state) => ({
          user: merged,
          isAuthenticated: true,
          profiles: { ...state.profiles, [merged.email]: merged },
        }));
        if (typeof window !== "undefined") {
          sessionStorage.setItem("portexa-session", "1");
        }
      },
      logout: () => {
        // user'ı koruyoruz — bir sonraki girişte aynı email ile girince
        // existing kontrolü gerçek adı bulabilsin
        set({ isAuthenticated: false });
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("portexa-session");
        }
      },
      updateUser: (data) =>
        set((state) => {
          const updated = state.user ? { ...state.user, ...data } : null;
          return {
            user: updated,
            profiles: updated
              ? { ...state.profiles, [updated.email]: updated }
              : state.profiles,
          };
        }),
      updateProfile: (email, data) =>
        set((state) => {
          const existing = state.profiles[email];
          if (!existing) return {};
          const updated = { ...existing, ...data };
          return {
            profiles: { ...state.profiles, [email]: updated },
            // Aktif kullanıcı aynı kişiyse onu da güncelle
            user: state.user?.email === email ? { ...state.user, ...data } : state.user,
          };
        }),
    }),
    {
      name: "auth-storage",
      skipHydration: true,
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        profiles: state.profiles,
      }),
    }
  )
);
