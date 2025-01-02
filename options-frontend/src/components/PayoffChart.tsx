import React, { useEffect, useState, useMemo } from "react";
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

type PayoffDataPoint = {
  spotPrice: number;
  pnl: number;
};

type PayoffMetrics = {
  maxProfit: number;
  maxLoss: number;
  breakEvenPoints: number[];
};

type PositionDetails = {
  symbol: string;
  strike: number;
  type: "CE" | "PE";
  quantity: number;
  entryPrice: number;
  expiry: string;
};

export function PayoffChart() {
  const { positions } = usePositions();
  const [payoffData, setPayoffData] = useState<PayoffDataPoint[]>([]);
  const [metrics, setMetrics] = useState<PayoffMetrics>({
    maxProfit: 0,
    maxLoss: 0,
    breakEvenPoints: [],
  });

  // Parse position details with corrected regex
  const positionDetails = useMemo<PositionDetails[]>(() => {
    try {
      const details = positions.reduce<PositionDetails[]>((acc, position) => {
        // Updated regex to match format: SENSEX2510378000CE
        // Group 1: Symbol (SENSEX/NIFTY)
        // Group 2: Year (25)
        // Group 3: Month (1)
        // Group 4: Day (03)
        // Group 5: Strike (78000)
        // Group 6: Option Type (CE/PE)
        const matches = position.tradingsymbol.match(
          /^(NIFTY|SENSEX)(\d{2})(\d)(\d{2})(\d+)(CE|PE)$/
        );

        console.log("Processing:", {
          symbol: position.tradingsymbol,
          matches: matches,
        });

        if (!matches) {
          console.log("No match for:", position.tradingsymbol);
          return acc;
        }

        const [_, symbol, year, month, day, strikeStr, type] = matches;
        const strike = parseInt(strikeStr);
        const expiry = `${year}-${month}-${day}`;

        console.log("Extracted:", {
          symbol,
          year,
          month,
          day,
          strike,
          type,
        });

        return [
          ...acc,
          {
            symbol,
            strike,
            type: type as "CE" | "PE",
            quantity: position.quantity,
            entryPrice: position.current_price,
            expiry,
          },
        ];
      }, []);

      console.log("Final position details:", details);
      return details;
    } catch (error) {
      console.error("Error processing positions:", error);
      return [];
    }
  }, [positions]);

  // Generate payoff data points
  useEffect(() => {
    if (positionDetails.length === 0) {
      console.log("No position details available");
      setPayoffData([]);
      setMetrics({ maxProfit: 0, maxLoss: 0, breakEvenPoints: [] });
      return;
    }

    try {
      const isNifty = positionDetails[0].symbol === "NIFTY";
      const strikeStep = isNifty ? 50 : 100;
      const rangeOffset = isNifty ? 1000 : 2000;

      const strikes = positionDetails.map((p) => p.strike);
      const minStrike = Math.min(...strikes);
      const maxStrike = Math.max(...strikes);

      console.log("Calculation range:", {
        minStrike,
        maxStrike,
        rangeOffset,
        strikeStep,
      });

      const points: PayoffDataPoint[] = [];
      for (
        let spotPrice = minStrike - rangeOffset;
        spotPrice <= maxStrike + rangeOffset;
        spotPrice += strikeStep / 2
      ) {
        let totalPnl = 0;

        positionDetails.forEach((position) => {
          const optionValue =
            position.type === "CE"
              ? Math.max(0, spotPrice - position.strike)
              : Math.max(0, position.strike - spotPrice);

          const positionPnl =
            (optionValue - position.entryPrice) * position.quantity;
          totalPnl += positionPnl;
        });

        points.push({ spotPrice, pnl: totalPnl });
      }

      console.log("Generated points:", {
        count: points.length,
        first: points[0],
        last: points[points.length - 1],
      });

      // Calculate metrics
      const pnls = points.map((p) => p.pnl);
      const maxProfit = Math.max(...pnls);
      const maxLoss = Math.min(...pnls);

      // Find break-even points
      const breakEvenPoints = points.reduce<number[]>((acc, point, index) => {
        if (index === 0) return acc;
        const prevPoint = points[index - 1];

        if (prevPoint.pnl * point.pnl < 0) {
          const ratio =
            Math.abs(prevPoint.pnl) /
            (Math.abs(prevPoint.pnl) + Math.abs(point.pnl));
          const breakEven =
            prevPoint.spotPrice +
            (point.spotPrice - prevPoint.spotPrice) * ratio;
          return [...acc, Math.round(breakEven)];
        }
        return acc;
      }, []);

      setPayoffData(points);
      setMetrics({ maxProfit, maxLoss, breakEvenPoints });
    } catch (error) {
      console.error("Error generating payoff data:", error);
    }
  }, [positionDetails]);

  if (positions.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-500">
        No positions to display
      </div>
    );
  }

  return (
    <div className="w-full h-full flex gap-4" style={{ minHeight: "300px" }}>
      <div className="flex-1">
        {payoffData.length > 0 ? (
          <LineChart
            width={600}
            height={300}
            data={payoffData}
            margin={{ top: 10, right: 30, bottom: 20, left: 40 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#666" opacity={0.3} />
            <XAxis
              dataKey="spotPrice"
              label={{ value: "Spot Price", position: "bottom" }}
              tickFormatter={(value) => value.toLocaleString()}
            />
            <YAxis
              label={{ value: "P&L", angle: -90, position: "insideLeft" }}
              tickFormatter={(value) => `₹${value.toLocaleString()}`}
            />
            <Tooltip
              formatter={(value: number) => [
                `₹${value.toLocaleString()}`,
                "P&L",
              ]}
              labelFormatter={(label: number) =>
                `Spot Price: ${label.toLocaleString()}`
              }
            />
            <ReferenceLine y={0} stroke="#666" />
            <Line
              type="monotone"
              dataKey="pnl"
              stroke="#8884d8"
              dot={false}
              strokeWidth={2}
              animationDuration={300}
            />
          </LineChart>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-500">
            Processing data...
          </div>
        )}
      </div>

      <div className="min-w-[120px] flex flex-col justify-center gap-4 p-2">
        <div>
          <div className="text-sm text-gray-500">Max Profit</div>
          <div className="font-semibold text-green-600">
            ₹{metrics.maxProfit.toLocaleString()}
          </div>
        </div>

        <div>
          <div className="text-sm text-gray-500">Max Loss</div>
          <div className="font-semibold text-red-600">
            ₹{metrics.maxLoss.toLocaleString()}
          </div>
        </div>

        <div>
          <div className="text-sm text-gray-500">Break-even Points</div>
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
    </div>
  );
}
