"use client";

import { useState } from "react";
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
}

export function OrderDialog({
  isOpen,
  onClose,
  strikePrice,
  optionType,
  action,
  currentPrice,
}: OrderDialogProps) {
  const [quantity, setQuantity] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addPosition } = usePositions();

  const lotSize = 25;

  const totalValue = quantity * currentPrice * lotSize;

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);

      // Submit order to Kite
      const response = await fetch("http://localhost:8000/place-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          symbol: "NIFTY", // Need to make this dynamic based on selected index
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
        addPosition({
          strikePrice,
          optionType,
          action,
          quantity,
          entryPrice: currentPrice,
          lotSize,
        });
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
            {action} {optionType} @ {strikePrice}
          </DialogTitle>
          <DialogDescription>
            Place your order for NIFTY options
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
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
            Confirm {action}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
