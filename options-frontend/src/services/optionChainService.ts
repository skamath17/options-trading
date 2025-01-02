import { useOptionChainStore } from "@/store/optionChainStore";
import { indices } from "@/types";

const fetchOptionChain = async (symbol: string) => {
  const store = useOptionChainStore.getState();

  try {
    const response = await fetch(
      `http://localhost:8000/option-chain/${symbol}`
    );
    if (!response.ok) throw new Error("Failed to fetch data");
    const json = await response.json();

    // Update cache without setting loading state
    store.setOptionDataForSymbol(symbol, json.data);
    store.setSpotPriceForSymbol(symbol, json.spotPrice);
  } catch (err) {
    console.error("Error updating cache:", err);
  }
};

const initializeCache = async () => {
  console.log("Initializing cache for all indices");
  for (const index of indices) {
    await fetchOptionChain(index.symbol);
  }
};

export const startOptionChainRefresh = (): (() => void) => {
  // Initial cache population
  initializeCache();

  // Set up periodic cache refresh
  const interval = setInterval(initializeCache, 60 * 1000); // every minute

  return () => clearInterval(interval);
};

// Add function for manual refresh
export const refreshOptionChain = async () => {
  const store = useOptionChainStore.getState();
  store.setLoading(true);

  try {
    await initializeCache();
    store.setError(null);
  } catch (err) {
    store.setError(err instanceof Error ? err.message : "Failed to fetch data");
  } finally {
    store.setLoading(false);
  }
};
