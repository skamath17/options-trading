"use client";

import React, { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OrderDialog } from "./OrderDialog";

type Index = {
  name: string;
  symbol: string;
  strikeDiff: number;
  spotPrice: number;
};

type OptionData = {
  strike: number;
  CE: number | null;
  PE: number | null;
  spotPrice?: number;
};

const indices: Index[] = [
  { name: "NIFTY", symbol: "NIFTY", strikeDiff: 50, spotPrice: 22000 },
  { name: "SENSEX", symbol: "SENSEX", strikeDiff: 100, spotPrice: 80000 },
];

const OptionChain = () => {
  const [selectedIndex, setSelectedIndex] = useState<Index>(indices[0]);
  const [optionData, setOptionData] = useState<OptionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showOrderDialog, setShowOrderDialog] = useState(false);
  const [spotPrice, setSpotPrice] = useState<number | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<{
    strike: number;
    type: "CE" | "PE";
    action: "BUY" | "SELL";
    price: number;
  } | null>(null);

  const fetchOptionChain = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `http://localhost:8000/option-chain/${selectedIndex.symbol}`
      );
      if (!response.ok) throw new Error("Failed to fetch data");
      const json = await response.json();
      setOptionData(json.data);
      setSpotPrice(json.spotPrice);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOptionChain();

    // Listen for refresh events
    const handleRefresh = () => {
      fetchOptionChain();
    };

    window.addEventListener("dataRefresh", handleRefresh);

    return () => {
      window.removeEventListener("dataRefresh", handleRefresh);
    };
  }, [selectedIndex.symbol]);

  const handleTrade = (
    strike: number,
    type: "CE" | "PE",
    action: "BUY" | "SELL",
    price: number
  ) => {
    setSelectedOrder({ strike, type, action, price });
    setShowOrderDialog(true);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 p-2 border-b bg-white flex items-center space-x-4">
        <div className="flex items-center gap-4">
          <Select
            value={selectedIndex.symbol}
            onValueChange={(value) => {
              const index = indices.find((i) => i.symbol === value);
              if (index) setSelectedIndex(index);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select Index" />
            </SelectTrigger>
            <SelectContent>
              {indices.map((index) => (
                <SelectItem key={index.symbol} value={index.symbol}>
                  {index.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="text-sm font-medium">
            Spot: {spotPrice?.toFixed(2) || "-"}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            Loading option chain...
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full text-red-600">
            {error}
          </div>
        ) : (
          <Table>
            <TableHeader className="sticky top-0 bg-white z-10">
              <TableRow>
                <TableHead className="text-center font-bold h-7 py-1">
                  CE LTP
                </TableHead>
                <TableHead className="text-center font-bold h-7 py-1">
                  Strike
                </TableHead>
                <TableHead className="text-center font-bold h-7 py-1">
                  PE LTP
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="overflow-auto">
              {optionData.map((row) => (
                <TableRow key={row.strike} className="h-6">
                  <TableCell className="py-0.5">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() =>
                          handleTrade(row.strike, "CE", "BUY", row.CE || 0)
                        }
                        className="w-5 h-5 rounded flex items-center justify-center opacity-40 hover:opacity-100 bg-green-100 text-green-700 font-semibold text-xs"
                      >
                        B
                      </button>
                      <button
                        onClick={() =>
                          handleTrade(row.strike, "CE", "SELL", row.CE || 0)
                        }
                        className="w-5 h-5 rounded flex items-center justify-center opacity-40 hover:opacity-100 bg-red-100 text-red-700 font-semibold text-xs"
                      >
                        S
                      </button>
                      <span
                        className={`font-mono font-semibold ${
                          row.CE ? "text-green-600" : ""
                        }`}
                      >
                        {row.CE?.toFixed(2) || "-"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-medium py-0.5">
                    {row.strike.toLocaleString()}
                  </TableCell>
                  <TableCell className="py-0.5">
                    <div className="flex items-center justify-start gap-2">
                      <span
                        className={`font-mono font-semibold ${
                          row.PE ? "text-red-600" : ""
                        }`}
                      >
                        {row.PE?.toFixed(2) || "-"}
                      </span>
                      <button
                        onClick={() =>
                          handleTrade(row.strike, "PE", "BUY", row.PE || 0)
                        }
                        className="w-5 h-5 rounded flex items-center justify-center opacity-40 hover:opacity-100 bg-green-100 text-green-700 font-semibold text-xs"
                      >
                        B
                      </button>
                      <button
                        onClick={() =>
                          handleTrade(row.strike, "PE", "SELL", row.PE || 0)
                        }
                        className="w-5 h-5 rounded flex items-center justify-center opacity-40 hover:opacity-100 bg-red-100 text-red-700 font-semibold text-xs"
                      >
                        S
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* OrderDialog moved outside the table */}
      {selectedOrder && (
        <OrderDialog
          isOpen={showOrderDialog}
          onClose={() => setShowOrderDialog(false)}
          strikePrice={selectedOrder.strike}
          optionType={selectedOrder.type}
          action={selectedOrder.action}
          currentPrice={selectedOrder.price}
          symbol={selectedIndex.symbol}
        />
      )}
    </div>
  );
};

export default OptionChain;
