export interface WalletCommission {
  name: string;
  slug: "mercury" | "astropay" | "belo" | "grabrfi" | "payoneer" | "santander" | "takenos";
  achIncoming: number; achIncomingMin?: number; achIncomingMax?: number;
  achOutgoing: number; achOutgoingMin?: number; achOutgoingMax?: number;
  wireIncoming: number; wireIncomingPercentage?: number; wireIncomingMin?: number;
  wireOutgoing: number;
  internalTransfer: number; conversionFee: number; monthlyFee: number;
  usdToArsRate?: number;
  lastUpdated: Date;
  rateSource?: string; feeSource?: string;
  rateIsManual?: boolean; feesAreManual?: boolean;
}

export interface TransferStep {
  from: string; to: string;
  type: "ach" | "wire" | "internal" | "conversion";
  fee: number; feeType: "fixed" | "percentage";
  amount: number; resultAmount: number;
}

export interface TransferPath {
  id: string; name: string; steps: TransferStep[];
  totalFees: number; finalAmountARS: number; effectiveRate: number;
  transferMethod: string;
}

export interface ComparisonResult {
  astropayPath: TransferPath; payoneerPath: TransferPath;
  grabrfiPath: TransferPath; santanderPath: TransferPath;
  binancePath: TransferPath; takenosPath: TransferPath;
  recommendation: "astropay" | "payoneer" | "grabrfi" | "santander" | "binance" | "takenos";
  savings: number; savingsPercentage: number;
}
