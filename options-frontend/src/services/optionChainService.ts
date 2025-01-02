import { useOptionChainStore } from "@/store/optionChainStore";
import { indices } from "@/types";

const fetchOptionChain = async (
  symbol: string,
  forceRefresh: boolean = false
) => {
  const store = useOptionChainStore.getState();
  const lastUpdate = store.lastUpdated[symbol] || 0;
  const isCacheValid = Date.now() - lastUpdate < 60000;

  // Check cache only if not forcing refresh
  if (
    !forceRefresh &&
    isCacheValid &&
    store.optionDataMap[symbol]?.length > 0
  ) {
    console.log(`Using cached data for ${symbol}`);
    return;
  }

  try {
    const response = await fetch(
      `http://localhost:8000/option-chain/${symbol}`
    );
    if (!response.ok) throw new Error("Failed to fetch data");
    const json = await response.json();

    store.setOptionDataForSymbol(symbol, json.data);
    store.setSpotPriceForSymbol(symbol, json.spotPrice);
  } catch (err) {
    console.error("Error updating cache:", err);
    if (!store.optionDataMap[symbol]) {
      throw err;
    }
  }
};

export const fetchInitialData = async () => {
  const store = useOptionChainStore.getState();
  store.setLoading(true);

  try {
    // Force refresh on initial load
    await fetchOptionChain(store.selectedIndex.symbol, true);
    store.setError(null);
  } catch (err) {
    store.setError(err instanceof Error ? err.message : "Failed to fetch data");
  } finally {
    store.setLoading(false);
  }
};

const initializeCache = async () => {
  console.log("Initializing cache for all indices");
  const promises = indices.map((index) => fetchOptionChain(index.symbol));
  await Promise.allSettled(promises);
};

export const startOptionChainRefresh = (): (() => void) => {
  // Initial cache population
  initializeCache();

  // Set up periodic cache refresh
  const interval = setInterval(initializeCache, 60 * 1000);

  return () => clearInterval(interval);
};

export const refreshOptionChain = async () => {
  const store = useOptionChainStore.getState();
  store.setLoading(true);

  try {
    await fetchOptionChain(store.selectedIndex.symbol);
    store.setError(null);
  } catch (err) {
    store.setError(err instanceof Error ? err.message : "Failed to fetch data");
  } finally {
    store.setLoading(false);
  }
};
