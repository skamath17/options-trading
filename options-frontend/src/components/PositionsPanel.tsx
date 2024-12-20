"use client";

import { useEffect, useState } from "react";
import { usePositions } from "@/context/PositionsContext";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";

export function PositionsPanel() {
  const { positions, loading, error, squareOffPosition } = usePositions();
  const [squaringOff, setSquaringOff] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<string>("");
  const [totalPnL, setTotalPnL] = useState<number>(0);
  const [isExitingAll, setIsExitingAll] = useState(false);

  // Update time only on client side
  useEffect(() => {
    // Initial set
    setLastRefreshed(new Date().toLocaleTimeString());

    // Update when positions change
    const updateTime = () => {
      setLastRefreshed(new Date().toLocaleTimeString());
    };

    updateTime();
  }, [positions]);

  // Fetch total P&L
  useEffect(() => {
    const fetchTotalPnL = async () => {
      try {
        const response = await fetch("http://localhost:8000/db-positions/1");
        if (!response.ok) throw new Error("Failed to fetch positions");
        const json = await response.json();
        setTotalPnL(json.data.total_pnl || 0);
      } catch (err) {
        console.error("Error fetching total P&L:", err);
      }
    };

    fetchTotalPnL();
  }, [positions]);

  const handleExitAll = async () => {
    if (!positions.length || isExitingAll) return;

    try {
      setIsExitingAll(true);
      const response = await fetch(
        "http://localhost:8000/exit-all-positions/1",
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to exit all positions");
      }

      // Positions panel to be updated
      // Fetch fresh positions data
      const posResponse = await fetch("http://localhost:8000/db-positions/1");
      if (!posResponse.ok) throw new Error("Failed to fetch positions");
      const json = await posResponse.json();
      setTotalPnL(json.data.total_pnl || 0);
    } catch (error) {
      console.error("Error exiting all positions:", error);
    } finally {
      setIsExitingAll(false);
    }
  };

  const handleSquareOff = async (tradeId: string) => {
    try {
      setSquaringOff(tradeId);
      await squareOffPosition(tradeId);
    } catch (err) {
      console.error("Error squaring off position:", err);
    } finally {
      setSquaringOff(null);
    }
  };

  if (loading) return <div>Loading positions...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">Open Positions</h2>
          {positions.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleExitAll}
              disabled={isExitingAll}
            >
              {isExitingAll ? "Exiting..." : "Exit All"}
            </Button>
          )}
        </div>
        <div
          className={`text-lg font-semibold ${
            totalPnL >= 0 ? "text-green-600" : "text-red-600"
          }`}
        >
          P&L: ₹{totalPnL.toFixed(2)}
        </div>
      </div>

      {positions.length === 0 ? (
        <p className="text-gray-500">No open positions</p>
      ) : (
        <div className="space-y-2">
          {positions.map((position) => (
            <div
              key={`${position.tradingsymbol}-${position.trade_id}`}
              className="border p-2 rounded"
            >
              <div className="flex justify-between items-center">
                <span className="w-52">{position.tradingsymbol}</span>
                <span className="w-34">
                  LTP: ₹{position.current_price.toFixed(2)}
                </span>
                <span
                  className={`w-30 ${
                    position.quantity > 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  Qty: {position.quantity}
                </span>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleSquareOff(position.trade_id)}
                  disabled={squaringOff === position.trade_id}
                >
                  {squaringOff === position.trade_id ? (
                    "..."
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <div className="text-sm text-gray-600">
                <div>Average: ₹{position.average_price.toFixed(2)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      {lastRefreshed && ( // Only show if we have a value
        <div className="mt-4 text-xs text-gray-500 text-right">
          Last refreshed: {lastRefreshed}
        </div>
      )}
    </div>
  );
}
