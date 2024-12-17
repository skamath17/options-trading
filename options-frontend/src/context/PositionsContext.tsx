"use client";

import React, { createContext, useContext, useState } from "react";

export type Position = {
  id: string;
  orderId?: string;
  strikePrice: number;
  optionType: "CE" | "PE";
  action: "BUY" | "SELL";
  quantity: number;
  entryPrice: number;
  timestamp: Date;
  lotSize: number;
};

type PositionsContextType = {
  positions: Position[];
  addPosition: (position: Omit<Position, "id" | "timestamp">) => void;
  removePosition: (id: string) => void;
};

const PositionsContext = createContext<PositionsContextType | undefined>(
  undefined
);

export function PositionsProvider({ children }: { children: React.ReactNode }) {
  const [positions, setPositions] = useState<Position[]>([]);

  const addPosition = (newPosition: Omit<Position, "id" | "timestamp">) => {
    const position: Position = {
      ...newPosition,
      id: Math.random().toString(36).substring(7),
      timestamp: new Date(),
    };
    setPositions((prev) => [...prev, position]);
  };

  const removePosition = (id: string) => {
    setPositions((prev) => prev.filter((position) => position.id !== id));
  };

  return (
    <PositionsContext.Provider
      value={{ positions, addPosition, removePosition }}
    >
      {children}
    </PositionsContext.Provider>
  );
}

export function usePositions() {
  const context = useContext(PositionsContext);
  if (context === undefined) {
    throw new Error("usePositions must be used within a PositionsProvider");
  }
  return context;
}
