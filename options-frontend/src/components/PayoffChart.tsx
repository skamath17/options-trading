"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { Position } from "@/types/position";

export function PayoffChart() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [payoffData, setPayoffData] = useState<
    Array<{ spotPrice: number; pnl: number }>
  >([]);

  const calculatePayoff = (spotPrice: number, positions: Position[]) => {
    return positions.reduce((total, position) => {
      const matches = position.tradingsymbol.match(
        /^NIFTY(\d{2}[A-Z]\d{2})(\d{5})(CE|PE)$/
      );
      if (!matches) return total;

      const strike = parseInt(matches[2]);
      const optionType = matches[3];
      const quantity = position.quantity;
      const entryPrice = position.average_price;

      if (optionType === "CE") {
        if (quantity > 0) {
          // Long Call
          const profit = Math.max(0, spotPrice - strike) - entryPrice;
          return total + profit * quantity;
        } else {
          // Short Call
          const profit = entryPrice - Math.max(0, spotPrice - strike);
          return total + profit * Math.abs(quantity);
        }
      } else {
        // PE
        if (quantity > 0) {
          // Long Put
          const profit = Math.max(0, strike - spotPrice) - entryPrice;
          return total + profit * quantity;
        } else {
          // Short Put
          const profit = entryPrice - Math.max(0, strike - spotPrice);
          return total + profit * Math.abs(quantity);
        }
      }
    }, 0);
  };

  useEffect(() => {
    const fetchPositions = async () => {
      try {
        const response = await fetch("http://localhost:8000/db-positions/1");
        if (!response.ok) throw new Error("Failed to fetch positions");
        const json = await response.json();
        setPositions(json.data.net || []);
      } catch (err) {
        console.error("Error fetching positions:", err);
      }
    };

    fetchPositions();
  }, []);

  useEffect(() => {
    if (positions.length === 0) return;

    const calculatePayoffData = () => {
      const strikes = positions
        .map((position) => {
          const matches = position.tradingsymbol.match(
            /^NIFTY(\d{2}[A-Z]\d{2})(\d{5})(CE|PE)$/
          );
          return matches ? parseInt(matches[2]) : 0;
        })
        .filter((strike) => strike > 0);

      if (strikes.length === 0) return;

      const minStrike = Math.min(...strikes);
      const maxStrike = Math.max(...strikes);
      const range = maxStrike - minStrike;
      const points = [];

      // Generate more points for smoother curve
      for (
        let spotPrice = minStrike - 1000;
        spotPrice <= maxStrike + 1000;
        spotPrice += 50
      ) {
        points.push({
          spotPrice,
          pnl: calculatePayoff(spotPrice, positions),
        });
      }

      setPayoffData(points);
    };

    calculatePayoffData();
  }, [positions]);

  return (
    <div className="w-full h-full min-h-[300px]">
      {positions.length === 0 ? (
        <div className="flex items-center justify-center h-full text-gray-500">
          No positions to display
        </div>
      ) : (
        <LineChart
          width={500}
          height={300}
          data={payoffData}
          margin={{ top: 20, right: 30, bottom: 30, left: 50 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="spotPrice"
            label={{ value: "Spot Price", position: "bottom" }}
          />
          <YAxis label={{ value: "P&L", angle: -90, position: "insideLeft" }} />
          <Tooltip
            formatter={(value: number) => [`₹${value.toFixed(2)}`, "P&L"]}
            labelFormatter={(label: number) => `Spot Price: ${label}`}
          />
          <ReferenceLine y={0} stroke="#666" />
          <Line
            type="monotone"
            dataKey="pnl"
            stroke="#8884d8"
            dot={false}
            strokeWidth={2}
          />
        </LineChart>
      )}
    </div>
  );
}
