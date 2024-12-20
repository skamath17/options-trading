"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import OptionChain from "./OptionChain";
import { PositionsPanel } from "./PositionsPanel";
import { PayoffChart } from "./PayoffChart";

const OptionsDashboard = () => {
  return (
    <div className="h-screen p-4">
      <h1 className="text-2xl font-bold mb-2">Options Trading Dashboard</h1>

      <div className="grid grid-cols-2 gap-4" style={{ height: "90vh" }}>
        {/* Left Panel - Option Chain */}
        <Card className="h-full overflow-hidden">
          <CardHeader className="py-2">
            <CardTitle className="text-lg">Option Chain</CardTitle>
          </CardHeader>
          <CardContent className="p-0 h-[calc(100%-45px)]">
            <div className="h-full overflow-hidden">
              <OptionChain />
            </div>
          </CardContent>
        </Card>

        {/* Right Panels */}
        <div className="space-y-2 h-full">
          {/* Top Right - Payoff Chart */}
          <Card className="h-[40%]">
            <CardHeader className="py-2">
              <CardTitle className="text-lg">Strategy Payoff</CardTitle>
            </CardHeader>
            <CardContent className="h-[calc(100%-45px)]">
              {" "}
              {/* Add this height calculation */}
              <PayoffChart />
            </CardContent>
          </Card>

          {/* Bottom Right - Positions */}
          <Card className="h-[58%]">
            <CardHeader className="py-2">
              <CardTitle className="text-lg">Positions & P/L</CardTitle>
            </CardHeader>
            <CardContent>
              <PositionsPanel />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default OptionsDashboard;
