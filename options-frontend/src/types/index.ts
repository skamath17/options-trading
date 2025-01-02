export type Index = {
  name: string;
  symbol: string;
  strikeDiff: number;
  spotPrice: number;
};

export type OptionData = {
  strike: number;
  CE: number | null;
  PE: number | null;
  spotPrice?: number;
};

export const indices: Index[] = [
  { name: "NIFTY", symbol: "NIFTY", strikeDiff: 50, spotPrice: 22000 },
  { name: "SENSEX", symbol: "SENSEX", strikeDiff: 100, spotPrice: 80000 },
  { name: "NIFTYBANK", symbol: "BANKNIFTY", strikeDiff: 100, spotPrice: 51000 },
];
