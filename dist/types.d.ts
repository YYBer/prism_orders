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
export declare enum StrategyType {
    PRICE_DROP_DCA = 1,
    PRICE_RISE_DCA = 2,
    TIME_BASED_DCA = 3
}
export declare enum OrderStatus {
    ACTIVE = "ACTIVE",
    PARTIALLY_FILLED = "PARTIALLY_FILLED",
    FILLED = "FILLED",
    CANCELLED = "CANCELLED",
    EXPIRED = "EXPIRED",
    UNKNOWN = "UNKNOWN"
}
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
export declare class DCAError extends Error {
    code: string;
    details?: any | undefined;
    constructor(message: string, code: string, details?: any | undefined);
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
export interface OneInchSDKConfig {
    networkId: number;
    authKey: string;
    httpConnector: any;
}
export declare class Address {
    value: string;
    constructor(value: string);
    private isValidAddress;
    toString(): string;
}
export interface MakerTraitsConfig {
    allowPartialFill?: boolean;
    allowMultipleFills?: boolean;
    usePermit2?: boolean;
    unwrapWeth?: boolean;
    expiration?: bigint;
    nonce?: bigint;
}
export interface APIClient {
    getQuote(src: string, dst: string, amount: string): Promise<OneInchQuoteResponse>;
    submitOrder(order: LimitOrderStruct, signature: string): Promise<OneInchOrderResponse>;
    getOrdersByMaker(makerAddress: string, page?: number, limit?: number): Promise<OneInchOrdersResponse>;
    getOrderByHash(orderHash: string): Promise<OneInchOrderInfo>;
    cancelOrder(orderHash: string): Promise<{
        success: boolean;
    }>;
    getAllActiveOrdersCount(makerAddress: string): Promise<number>;
}
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
export declare const LIMIT_ORDER_PROTOCOL_ADDRESSES: Record<number, string>;
export declare const ONEINCH_API_BASE = "https://api.1inch.dev";
export declare const LIMIT_ORDER_API_BASE: (chainId: number) => string;
export declare const SWAP_API_BASE: (chainId: number) => string;
export interface RandomUtils {
    randBigInt(max: bigint): bigint;
    generateSalt(): bigint;
    generateNonce(): bigint;
}
//# sourceMappingURL=types.d.ts.map