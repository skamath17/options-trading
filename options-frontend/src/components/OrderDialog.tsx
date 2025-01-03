"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { usePositions } from "@/context/PositionsContext";

interface OrderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  strikePrice: number;
  optionType: "CE" | "PE";
  action: "BUY" | "SELL";
  currentPrice: number;
  symbol: string;
}

export function OrderDialog({
  isOpen,
  onClose,
  strikePrice,
  optionType,
  action,
  currentPrice,
  symbol,
}: OrderDialogProps) {
  const [quantity, setQuantity] = useState<number>(1);
  const [hedgeStrikes, setHedgeStrikes] = useState<number>(3);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { fetchPositions } = usePositions();

  // Determine lot size based on symbol
  const lotSize = symbol === "SENSEX" ? 10 : symbol === "BANKNIFTY" ? 15 : 25; // NIFTY is 25

  const totalValue = quantity * currentPrice * lotSize;

  // Calculate hedge strike price
  const hedgeStrikePrice = useMemo(() => {
    const strikeDiff =
      symbol === "SENSEX" ? 100 : symbol === "BANKNIFTY" ? 100 : 50;
    const offset = hedgeStrikes * strikeDiff;
    return optionType === "CE"
      ? strikePrice + offset // For CE, hedge is higher
      : strikePrice - offset; // For PE, hedge is lower
  }, [strikePrice, optionType, hedgeStrikes, symbol]);

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);

      if (action === "SELL") {
        // Place hedge buy order first
        const hedgeResponse = await fetch("http://localhost:8000/place-order", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id: 1,
            symbol,
            strike: hedgeStrikePrice,
            optionType,
            action: "BUY", // Hedge is always a buy
            quantity,
            lotSize,
            price: currentPrice,
          }),
        });

        if (!hedgeResponse.ok) {
          throw new Error("Failed to place hedge order");
        }
      }
      // Submit order to Kite
      const response = await fetch("http://localhost:8000/place-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: 1, // Added this line - hardcoded for now
          symbol, // Need to make this dynamic based on selected index
          strike: strikePrice,
          optionType,
          action,
          quantity,
          lotSize,
          price: currentPrice,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to place order");
      }

      const result = await response.json();

      // If order successful, add to positions
      if (result.status === "success") {
        await fetchPositions();

        onClose();
      }
    } catch (error) {
      console.error("Error placing order:", error);
      // Add error handling UI here
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {action} {symbol} {optionType} @ {strikePrice}
          </DialogTitle>
          <DialogDescription>
            Place your order for {symbol} options
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {action === "SELL" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2">
                  Hedge Strikes Away
                </label>
                <Input
                  type="number"
                  min={1}
                  value={hedgeStrikes}
                  onChange={(e) =>
                    setHedgeStrikes(parseInt(e.target.value) || 3)
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2">Hedge Strike</label>
                <div className="text-sm">
                  Buy {optionType} @ {hedgeStrikePrice}
                </div>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2">Lot Size</label>
              <div className="text-sm">{lotSize}</div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2">LTP</label>
              <div className="text-sm">₹{currentPrice.toFixed(2)}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2">
                Quantity (Lots)
              </label>
              <Input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2">Total Value</label>
              <div className="text-sm">₹{totalValue.toFixed(2)}</div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            className={
              action === "BUY"
                ? "bg-green-600 hover:bg-green-700"
                : "bg-red-600 hover:bg-red-700"
            }
          >
            {isSubmitting
              ? "Placing Order..."
              : `Confirm ${action}${action === "SELL" ? " with Hedge" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
