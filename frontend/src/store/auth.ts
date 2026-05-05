import { create } from "zustand";
import { api } from "@/lib/api";
import type { UserProfile } from "@/lib/api";

interface AuthState {
  token: string | null;
  user: UserProfile | null;
  balance: number;
  isAuthenticated: boolean;
  loading: boolean;

  signin: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => void;
  fetchBalance: () => Promise<void>;
  fetchUser: () => Promise<void>;
  updateUser: (data: Partial<UserProfile>) => void;
  setBalance: (balance: number) => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  balance: 0,
  isAuthenticated: false,
  loading: true,

  hydrate: () => {
    const token = localStorage.getItem("token");
    const userStr = localStorage.getItem("user");
    if (token && userStr) {
      const user = JSON.parse(userStr);
      set({ token, user, isAuthenticated: true, loading: false });
      get().fetchUser();
      get().fetchBalance();
    } else {
      set({ loading: false });
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
    localStorage.setItem("token", res.token);
    localStorage.setItem("user", JSON.stringify(user));
    set({
      token: res.token,
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
    localStorage.setItem("token", res.token);
    localStorage.setItem("user", JSON.stringify(user));
    set({
      token: res.token,
      user,
      balance: res.user.usdBalance / 100,
      isAuthenticated: true,
    });
  },

  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    set({ token: null, user: null, balance: 0, isAuthenticated: false });
  },

  fetchBalance: async () => {
    try {
      const res = await api.getBalance();
      set({ balance: res.usd_balance / 100 });
    } catch {
      /* token expired */
    }
  },

  fetchUser: async () => {
    try {
      const { user } = await api.getUser();
      localStorage.setItem("user", JSON.stringify(user));
      set({ user });
    } catch {
      /* token expired */
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
