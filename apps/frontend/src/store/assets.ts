import { create } from "zustand";
import { api, type AssetInfo } from "@/lib/api";

interface AssetsState {
  assets: AssetInfo[];
  loaded: boolean;
  load: () => Promise<void>;
}

export const useAssetsStore = create<AssetsState>((set, get) => ({
  assets: [],
  loaded: false,

  load: async () => {
    if (get().loaded) return;
    try {
      const { assets } = await api.getAssets();
      set({ assets, loaded: true });
    } catch {
      /* ignore */
    }
  },
}));
