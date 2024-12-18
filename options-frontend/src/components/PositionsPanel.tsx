"use client";

import { useEffect, useState } from "react";
import { Position } from "@/types/position";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";

export function PositionsPanel() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [squaringOff, setSquaringOff] = useState<string | null>(null);

  useEffect(() => {
    const fetchPositions = async () => {
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
    };

    fetchPositions();
    const interval = setInterval(fetchPositions, 50000);

    return () => clearInterval(interval);
  }, []);

  const handleSquareOff = async (tradeId: string) => {
    try {
      setSquaringOff(tradeId);
      const response = await fetch(
        `http://localhost:8000/square-off-trade/${tradeId}`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to square off position");
      }

      const result = await response.json();
      // Refresh positions after successful square-off
      const updatedResponse = await fetch(
        "http://localhost:8000/db-positions/1"
      );
      const updatedJson = await updatedResponse.json();
      setPositions(updatedJson.data.net || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to square off position"
      );
    } finally {
      setSquaringOff(null);
    }
  };

  if (loading) return <div>Loading positions...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-4">Open Positions</h2>
      {positions.length === 0 ? (
        <p className="text-gray-500">No open positions</p>
      ) : (
        <div className="space-y-2">
          {positions.map((position) => (
            <div
              key={`${position.tradingsymbol}-${position.instrument_token}-${position.average_price}`}
              className="border p-2 rounded"
            >
              <div className="flex justify-between items-center">
                <span>{position.tradingsymbol}</span>
                <div className="flex items-center gap-2">
                  <span>Qty: {position.quantity}</span>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleSquareOff(position.trade_id)}
                    disabled={squaringOff === position.trade_id}
                    className="ml-2"
                  >
                    {squaringOff === position.trade_id ? (
                      "Squaring..."
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 mr-1" />
                        Square Off
                      </>
                    )}
                  </Button>
                </div>
              </div>
              <div className="text-sm text-gray-600">
                <div>Average: ₹{position.average_price.toFixed(2)}</div>
                <div
                  className={
                    position.pnl >= 0 ? "text-green-600" : "text-red-600"
                  }
                >
                  P&L: ₹{position.pnl.toFixed(2)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
