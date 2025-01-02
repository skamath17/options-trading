"use client";

import React, { useState } from "react";
import { useOptionChainStore } from "@/store/optionChainStore";
import { indices } from "@/types";
import { RefreshCw, Loader } from "lucide-react";
import { Button } from "./ui/button";
import { refreshOptionChain } from "@/services/optionChainService";
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

const OptionChain = () => {
  const {
    selectedIndex,
    optionDataMap,
    spotPriceMap,
    loading,
    error,
    setSelectedIndex,
  } = useOptionChainStore();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showOrderDialog, setShowOrderDialog] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<{
    strike: number;
    type: "CE" | "PE";
    action: "BUY" | "SELL";
    price: number;
  } | null>(null);

  // Get current data from cache
  const currentOptionData = optionDataMap[selectedIndex.symbol] || [];
  const currentSpotPrice = spotPriceMap[selectedIndex.symbol];

  // Handle manual refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshOptionChain();
    setIsRefreshing(false);
  };

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
            Spot: {currentSpotPrice?.toFixed(2) || "-"}
          </div>
        </div>
        <Button
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="ml-4"
        >
          <div className="flex items-center">
            {isRefreshing ? (
              <>
                <Loader className="h-4 w-4 animate-spin mr-2" />
                <span>Refreshing...</span>
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                <span>Refresh</span>
              </>
            )}
          </div>
        </Button>
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
              {currentOptionData.map((row) => (
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
