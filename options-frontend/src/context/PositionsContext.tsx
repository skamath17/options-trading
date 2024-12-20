"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";

type Position = {
  tradingsymbol: string;
  quantity: number;
  average_price: number;
  pnl: number;
  trade_id: string;
  current_price: number;
  order_type: "BUY" | "SELL";
  instrument_token?: number;
};

type PositionsContextType = {
  positions: Position[];
  loading: boolean;
  error: string | null;
  fetchPositions: () => Promise<void>;
  squareOffPosition: (tradeId: string) => Promise<void>;
  refreshData: () => Promise<void>;
};

const PositionsContext = createContext<PositionsContextType | undefined>(
  undefined
);

export function PositionsProvider({ children }: { children: React.ReactNode }) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPositions = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("http://localhost:8000/db-positions/1");
      if (!response.ok) throw new Error("Failed to fetch positions");
      const json = await response.json();
      setPositions(json.data.net || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch positions"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const squareOffPosition = useCallback(
    async (tradeId: string) => {
      try {
        const response = await fetch(
          `http://localhost:8000/square-off-trade/${tradeId}`,
          {
            method: "POST",
          }
        );

        if (!response.ok) {
          throw new Error("Failed to square off position");
        }

        await fetchPositions(); // Refresh positions after square-off
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to square off position"
        );
        throw err;
      }
    },
    [fetchPositions]
  );

  const refreshData = useCallback(async () => {
    await fetchPositions();
    // Emit a refresh event that Option Chain can listen to
    const event = new CustomEvent("dataRefresh");
    window.dispatchEvent(event);
  }, [fetchPositions]);

  useEffect(() => {
    // Initial fetch
    refreshData();

    // Set up 5-minute interval
    const interval = setInterval(refreshData, 3 * 60 * 1000);

    return () => clearInterval(interval);
  }, [refreshData]);

  return (
    <PositionsContext.Provider
      value={{
        positions,
        loading,
        error,
        fetchPositions,
        squareOffPosition,
        refreshData,
      }}
    >
      {children}
    </PositionsContext.Provider>
  );
}

export function usePositions() {
  const context = useContext(PositionsContext);
  if (context === undefined) {
    throw new Error("usePositions must be used within a PositionsProvider");
  }
  return context;
}
