"use client";

import { useEffect, useState } from "react";
import { usePositions } from "@/context/PositionsContext";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";

type Position = {
  tradingsymbol: string;
  quantity: number;
  average_price: number;
  current_price: number;
  pnl: number;
  trade_id: string;
  order_type: "BUY" | "SELL";
};

type PayoffMetrics = {
  maxProfit: number;
  maxLoss: number;
  breakEvenPoints: number[];
};

export function PayoffChart() {
  const { positions } = usePositions();
  const [payoffData, setPayoffData] = useState<
    Array<{ spotPrice: number; pnl: number }>
  >([]);

  const calculatePayoff = (spotPrice: number, positions: Position[]) => {
    return positions.reduce((total, position) => {
      // Match both NIFTY and SENSEX patterns
      const matches = position.tradingsymbol.match(
        /^(NIFTY|SENSEX)(\d{2}[A-Z]\d{2})(\d+)(CE|PE)$/
      );
      if (!matches) return total;

      const strike = parseInt(matches[3]);
      const optionType = matches[4];
      const quantity = position.quantity; // This is already positive/negative based on buy/sell
      const entryPrice = position.current_price; // Use current_price from API

      let profit = 0;
      if (optionType === "CE") {
        // For Call options
        const optionValue = Math.max(0, spotPrice - strike);
        profit = (optionValue - entryPrice) * quantity; // quantity is already signed (+/-)
      } else {
        // For Put options
        const optionValue = Math.max(0, strike - spotPrice);
        profit = (optionValue - entryPrice) * quantity; // quantity is already signed (+/-)
      }

      return total + profit;
    }, 0);
  };

  useEffect(() => {
    if (positions.length === 0) return;

    const calculatePayoffData = () => {
      // ... existing calculation code ...
    };

    calculatePayoffData();
  }, [positions]); // This will now trigger whenever positions change

  useEffect(() => {
    if (positions.length === 0) return;

    const calculatePayoffData = () => {
      // Extract strikes and determine if we're dealing with NIFTY or SENSEX
      const positionDetails = positions
        .map((position) => {
          const matches = position.tradingsymbol.match(
            /^(NIFTY|SENSEX)(\d{2}[A-Z]\d{2})(\d+)(CE|PE)$/
          );
          return matches
            ? {
                symbol: matches[1],
                strike: parseInt(matches[3]),
              }
            : null;
        })
        .filter(
          (detail): detail is NonNullable<typeof detail> => detail !== null
        );

      if (positionDetails.length === 0) return;

      const isNifty = positionDetails[0].symbol === "NIFTY";
      const strikeStep = isNifty ? 50 : 100;
      const rangeOffset = isNifty ? 1000 : 2000;

      const strikes = positionDetails.map((detail) => detail.strike);
      const minStrike = Math.min(...strikes);
      const maxStrike = Math.max(...strikes);

      const points = [];
      for (
        let spotPrice = minStrike - rangeOffset;
        spotPrice <= maxStrike + rangeOffset;
        spotPrice += strikeStep
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

  const [metrics, setMetrics] = useState<PayoffMetrics>({
    maxProfit: 0,
    maxLoss: 0,
    breakEvenPoints: [],
  });

  useEffect(() => {
    if (payoffData.length === 0) return;

    // Calculate metrics
    const pnls = payoffData.map((point) => point.pnl);
    const maxProfit = Math.max(...pnls);
    const maxLoss = Math.min(...pnls);

    // Find break-even points (where PnL crosses 0)
    const breakEvenPoints = payoffData.reduce(
      (points: number[], point, index) => {
        if (index === 0) return points;
        const prevPoint = payoffData[index - 1];
        // If PnL changes sign between two points, there's a break-even point
        if (prevPoint.pnl * point.pnl < 0) {
          // Linear interpolation to find more accurate break-even point
          const ratio =
            Math.abs(prevPoint.pnl) /
            (Math.abs(prevPoint.pnl) + Math.abs(point.pnl));
          const breakEven =
            prevPoint.spotPrice +
            (point.spotPrice - prevPoint.spotPrice) * ratio;
          points.push(Math.round(breakEven));
        }
        return points;
      },
      []
    );

    setMetrics({ maxProfit, maxLoss, breakEvenPoints });
  }, [payoffData]);

  return (
    <div className="w-full h-full min-h-[300px] flex gap-2">
      <div className="flex-1">
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
            <YAxis
              label={{ value: "P&L", angle: -90, position: "insideLeft" }}
            />
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
      {positions.length > 0 && (
        <div className="min-w-[100px] text-xs flex flex-col justify-center gap-2">
          <div>
            <div className="text-gray-500">Max Profit</div>
            <div className="font-semibold text-green-600">
              ₹{metrics.maxProfit.toFixed(2)}
            </div>
          </div>

          <div>
            <div className="text-gray-500">Max Loss</div>
            <div className="font-semibold text-red-600">
              ₹{metrics.maxLoss.toFixed(2)}
            </div>
          </div>

          <div>
            <div className="text-gray-500">Break-even</div>
            {metrics.breakEvenPoints.length > 0 ? (
              metrics.breakEvenPoints.map((point, index) => (
                <div key={index} className="font-semibold">
                  ₹{point.toLocaleString()}
                </div>
              ))
            ) : (
              <div className="text-gray-400">N/A</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
