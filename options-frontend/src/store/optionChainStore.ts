import { create } from "zustand";
import { Index, OptionData, indices } from "@/types";

interface OptionChainState {
  selectedIndex: Index;
  optionDataMap: Record<string, OptionData[]>; // Data for each symbol
  spotPriceMap: Record<string, number | null>; // Spot price for each symbol
  loading: boolean;
  error: string | null;
  setSelectedIndex: (index: Index) => void;
  setOptionDataForSymbol: (symbol: string, data: OptionData[]) => void;
  setSpotPriceForSymbol: (symbol: string, price: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useOptionChainStore = create<OptionChainState>((set) => ({
  selectedIndex: indices[0],
  optionDataMap: {},
  spotPriceMap: {},
  loading: true,
  error: null,

  setSelectedIndex: (index: Index) => {
    set({ selectedIndex: index });
  },

  setOptionDataForSymbol: (symbol: string, data: OptionData[]) => {
    set((state) => ({
      optionDataMap: {
        ...state.optionDataMap,
        [symbol]: data,
      },
    }));
  },

  setSpotPriceForSymbol: (symbol: string, price: number) => {
    set((state) => ({
      spotPriceMap: {
        ...state.spotPriceMap,
        [symbol]: price,
      },
    }));
  },

  setLoading: (loading: boolean) => {
    set({ loading });
  },

  setError: (error: string | null) => {
    set({ error });
  },
}));
