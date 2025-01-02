// services/refreshService.ts
import { useOptionChainStore } from "../store/optionChainStore";

export const startBackgroundRefresh = () => {
  setInterval(() => {
    const store = useOptionChainStore.getState();
    store.fetchOptionChain(); // No need to pass symbol, it uses selectedIndex.symbol internally
  }, 1 * 60 * 1000); // 5 minutes
};
