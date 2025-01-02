import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { Index, OptionData, indices } from "@/types";

interface OptionChainState {
  selectedIndex: Index;
  optionDataMap: Record<string, OptionData[]>;
  spotPriceMap: Record<string, number | null>;
  lastUpdated: Record<string, number>;
  loading: boolean;
  error: string | null;
  setSelectedIndex: (index: Index) => void;
  setOptionDataForSymbol: (symbol: string, data: OptionData[]) => void;
  setSpotPriceForSymbol: (symbol: string, price: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  fetchOptionChain: () => Promise<void>;
}

export const useOptionChainStore = create<OptionChainState>()(
  persist(
    (set, get) => ({
      selectedIndex: indices[0],
      optionDataMap: {},
      spotPriceMap: {},
      lastUpdated: {},
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
          lastUpdated: {
            ...state.lastUpdated,
            [symbol]: Date.now(),
          },
        }));
      },

      setSpotPriceForSymbol: (symbol: string, price: number) => {
        set((state) => ({
          spotPriceMap: {
            ...state.spotPriceMap,
            [symbol]: price,
          },
          lastUpdated: {
            ...state.lastUpdated,
            [symbol]: Date.now(),
          },
        }));
      },

      setLoading: (loading: boolean) => {
        set({ loading });
      },

      setError: (error: string | null) => {
        set({ error });
      },

      fetchOptionChain: async () => {
        const { selectedIndex, optionDataMap, lastUpdated } = get();
        const symbol = selectedIndex.symbol;

        try {
          // Check if we have cached data less than 1 minute old
          const lastUpdate = lastUpdated[symbol] || 0;
          const isCacheValid = Date.now() - lastUpdate < 60000; // 1 minute

          if (isCacheValid && optionDataMap[symbol]?.length > 0) {
            console.log(`Using cached data for ${symbol}`);
            return;
          }

          const response = await fetch(
            `http://localhost:8000/option-chain/${symbol}`
          );

          if (!response.ok) {
            throw new Error("Failed to fetch data");
          }

          const json = await response.json();

          set((state) => ({
            optionDataMap: {
              ...state.optionDataMap,
              [symbol]: json.data,
            },
            spotPriceMap: {
              ...state.spotPriceMap,
              [symbol]: json.spotPrice,
            },
            lastUpdated: {
              ...state.lastUpdated,
              [symbol]: Date.now(),
            },
          }));
        } catch (err) {
          console.error("Error fetching option chain:", err);

          // If we have cached data, use it and don't show error
          if (optionDataMap[symbol]?.length > 0) {
            console.log(`Falling back to cached data for ${symbol}`);
            return;
          }

          // Only set error if we have no cached data
          set({
            error: err instanceof Error ? err.message : "Failed to fetch data",
          });
        }
      },
    }),
    {
      name: "option-chain-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        optionDataMap: state.optionDataMap,
        spotPriceMap: state.spotPriceMap,
        lastUpdated: state.lastUpdated,
      }),
    }
  )
);
