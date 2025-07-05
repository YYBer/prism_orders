import { BigNumber } from 'ethers';

export interface NetworkConfig {
  chainId: number;
  rpcUrl: string;
  limitOrderProtocolAddress: string;
  oneInchApiKey: string;
}

export interface TokenInfo {
  address: string;
  symbol: string;
  decimals: number;
  name?: string;
}

export interface StrategyConfig {
  fromToken: TokenInfo;
  toToken: TokenInfo;
  totalAmount: string;
  numberOfOrders: number;
  strategyType: StrategyType;
  priceDropPercent?: number;
  priceRisePercent?: number;
  intervalHours?: number;
  buyPercent: number;
  slippageTolerance: number;
  gasPrice?: string;
}

export enum StrategyType {
  PRICE_DROP_DCA = 1,
  PRICE_RISE_DCA = 2,
  TIME_BASED_DCA = 3
}

export enum OrderStatus {
  ACTIVE = 'ACTIVE',
  PARTIALLY_FILLED = 'PARTIALLY_FILLED',
  FILLED = 'FILLED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
  UNKNOWN = 'UNKNOWN'
}

// 1inch Limit Order Protocol v4 Types
export interface LimitOrderStruct {
  salt: bigint;
  maker: string;
  receiver: string;
  makerAsset: string;
  takerAsset: string;
  makingAmount: bigint;
  takingAmount: bigint;
  makerTraits: bigint;
}

export interface OrderData {
  order: LimitOrderStruct;
  orderHash: string;
  signature: string;
  targetPrice: number;
  orderIndex: number;
  status: OrderStatus;
  createdAt: Date;
  expiresAt: Date;
  remainingMakingAmount?: bigint;
}

export interface PriceInfo {
  price: number;
  timestamp: Date;
  source: 'oneInch' | 'fallback';
}

// 1inch API Response Types
export interface OneInchQuoteResponse {
  dstAmount: string;
  srcAmount: string;
  protocols: any[];
  gas: string;
}

export interface OneInchOrderResponse {
  success: boolean;
  orderHash: string;
  quoteId?: string;
}

export interface OneInchOrderInfo {
  orderHash: string;
  signature: string;
  data: LimitOrderStruct;
  createDateTime: string;
  fillableBalance: string;
  orderInvalidReason?: number;
  auctionStartDate?: number;
  auctionEndDate?: number;
  remainingMakerAmount?: string;
  makerBalance?: string;
  makerAllowance?: string;
}

export interface OneInchOrdersResponse {
  orders: OneInchOrderInfo[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}

export interface ExecutionResult {
  success: boolean;
  transactionHash?: string;
  blockNumber?: number;
  gasUsed?: string;
  error?: string;
  makingAmount?: string;
  takingAmount?: string;
}

export interface BalanceInfo {
  balance: string;
  allowance: string;
  formatted: {
    balance: string;
    allowance: string;
  };
}

export interface OrderEventListener {
  onOrderFilled: (orderHash: string, makingAmount: string, takingAmount: string) => void;
  onOrderCancelled: (orderHash: string) => void;
  onOrderPartiallyFilled: (orderHash: string, filledAmount: string) => void;
}

export interface MonitoringConfig {
  priceCheckInterval: number;
  orderStatusCheckInterval: number;
  eventListenerEnabled: boolean;
  autoRebalance: boolean;
}

export interface DCAStats {
  totalInvested: string;
  totalReceived: string;
  averagePrice: number;
  totalOrders: number;
  filledOrders: number;
  activeOrders: number;
  cancelledOrders: number;
  profitLoss: string;
  profitLossPercent: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface GasConfig {
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  gasLimit?: string;
}

export class DCAError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'DCAError';
  }
}

export interface OrderFilledEvent {
  orderHash: string;
  maker: string;
  makingAmount: string;
  takingAmount: string;
  blockNumber: number;
  transactionHash: string;
  timestamp: Date;
}

export interface OrderCancelledEvent {
  orderHash: string;
  maker: string;
  blockNumber: number;
  transactionHash: string;
  timestamp: Date;
}

export interface StrategyParams {
  basePrice: number;
  currentPrice: number;
  orderIndex: number;
  totalOrders: number;
  remainingAmount: string;
}

export interface OrderCreationParams {
  amountPerOrder: string;
  targetPrice: number;
  orderIndex: number;
  expirationDays: number;
}

// 1inch SDK Configuration
export interface OneInchSDKConfig {
  networkId: number;
  authKey: string;
  httpConnector: any; // FetchProviderConnector or AxiosProviderConnector
}

// Address class for 1inch SDK compatibility
export class Address {
  constructor(public value: string) {
    if (!value || !this.isValidAddress(value)) {
      throw new Error(`Invalid address: ${value}`);
    }
  }

  private isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  toString(): string {
    return this.value;
  }
}

// MakerTraits for order configuration
export interface MakerTraitsConfig {
  allowPartialFill?: boolean;
  allowMultipleFills?: boolean;
  usePermit2?: boolean;
  unwrapWeth?: boolean;
  expiration?: bigint;
  nonce?: bigint;
}

// API Client interface for 1inch integration
export interface APIClient {
  getQuote(src: string, dst: string, amount: string): Promise<OneInchQuoteResponse>;
  submitOrder(order: LimitOrderStruct, signature: string): Promise<OneInchOrderResponse>;
  getOrdersByMaker(makerAddress: string, page?: number, limit?: number): Promise<OneInchOrdersResponse>;
  getOrderByHash(orderHash: string): Promise<OneInchOrderInfo>;
  cancelOrder(orderHash: string): Promise<{success: boolean}>;
  getAllActiveOrdersCount(makerAddress: string): Promise<number>;
}

// TypedData structure for EIP-712 signing
export interface TypedData {
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: string;
  };
  types: {
    Order: Array<{
      name: string;
      type: string;
    }>;
  };
  message: any;
}

// 1inch Protocol Addresses for different chains
export const LIMIT_ORDER_PROTOCOL_ADDRESSES: Record<number, string> = {
  1: '0x111111125421cA6dc452d289314280a0f8842A65', // Ethereum
  56: '0x111111125421cA6dc452d289314280a0f8842A65', // BSC
  137: '0x111111125421cA6dc452d289314280a0f8842A65', // Polygon
  8453: '0x111111125421cA6dc452d289314280a0f8842A65', // Base
  42161: '0x111111125421cA6dc452d289314280a0f8842A65', // Arbitrum
  10: '0x111111125421cA6dc452d289314280a0f8842A65', // Optimism
  43114: '0x111111125421cA6dc452d289314280a0f8842A65', // Avalanche
  250: '0x111111125421cA6dc452d289314280a0f8842A65', // Fantom
};

// API Base URLs
export const ONEINCH_API_BASE = 'https://api.1inch.dev';
export const LIMIT_ORDER_API_BASE = (chainId: number) => `${ONEINCH_API_BASE}/orderbook/v4.0/${chainId}`;
export const SWAP_API_BASE = (chainId: number) => `${ONEINCH_API_BASE}/swap/v6.0/${chainId}`;

// Random generation utility types
export interface RandomUtils {
  randBigInt(max: bigint): bigint;
  generateSalt(): bigint;
  generateNonce(): bigint;
}