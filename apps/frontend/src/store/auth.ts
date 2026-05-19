import { create } from "zustand";
import { api } from "@/lib/api";
import type { UserProfile } from "@/lib/api";

interface AuthState {
  user: UserProfile | null;
  balance: number;
  isAuthenticated: boolean;
  loading: boolean;

  signin: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchBalance: () => Promise<void>;
  fetchUser: () => Promise<void>;
  updateUser: (data: Partial<UserProfile>) => void;
  setBalance: (balance: number) => void;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  balance: 0,
  isAuthenticated: false,
  loading: true,

  hydrate: async () => {
    try {
      const { user } = await api.getUser();
      localStorage.setItem("user", JSON.stringify(user));
      set({ user, isAuthenticated: true, loading: false });
      get().fetchBalance();
    } catch {
      localStorage.removeItem("user");
      set({ user: null, isAuthenticated: false, loading: false });
    }
  },

  signin: async (email, password) => {
    const res = await api.signin(email, password);
    const user: UserProfile = {
      id: res.user.id,
      email: res.user.email,
      firstName: null,
      lastName: null,
      username: null,
      usdBalance: res.user.usdBalance,
      createdAt: res.user.createdAt,
    };
    localStorage.setItem("user", JSON.stringify(user));
    set({
      user,
      balance: res.user.usdBalance / 100,
      isAuthenticated: true,
    });
  },

  signup: async (email, password) => {
    const res = await api.signup(email, password);
    const user: UserProfile = {
      id: res.user.id,
      email: res.user.email,
      firstName: null,
      lastName: null,
      username: null,
      usdBalance: res.user.usdBalance,
      createdAt: res.user.createdAt,
    };
    localStorage.setItem("user", JSON.stringify(user));
    set({
      user,
      balance: res.user.usdBalance / 100,
      isAuthenticated: true,
    });
  },

  logout: async () => {
    try {
      await api.logout();
    } catch {
      /* even if the call fails, clear local state */
    }
    localStorage.removeItem("user");
    set({ user: null, balance: 0, isAuthenticated: false });
  },

  fetchBalance: async () => {
    try {
      const res = await api.getBalance();
      set({ balance: res.usd_balance / 100 });
    } catch {
      /* session expired */
    }
  },

  fetchUser: async () => {
    try {
      const { user } = await api.getUser();
      localStorage.setItem("user", JSON.stringify(user));
      set({ user });
    } catch {
      /* session expired */
    }
  },

  updateUser: (data) => {
    const currentUser = get().user;
    if (currentUser) {
      const updatedUser = { ...currentUser, ...data };
      localStorage.setItem("user", JSON.stringify(updatedUser));
      set({ user: updatedUser });
    }
  },

  setBalance: (balance) => set({ balance }),
}));
