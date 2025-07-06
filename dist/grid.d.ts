#!/usr/bin/env node
import { ethers } from 'ethers';
import { StrategyConfig, OrderData, ValidationResult, OneInchOrderInfo } from './types';
declare enum GridOrderType {
    BUY = "BUY",
    SELL = "SELL"
}
interface GridOrderData extends OrderData {
    gridType: GridOrderType;
    gridLevel: number;
    triggerPrice: number;
    pairOrderHash?: string;
}
export declare class VolatilityGridStrategy {
    private provider;
    private signer;
    private oneInchApi;
    private activeOrders;
    private config;
    private isRunning;
    private gridLevels;
    private filledOrders;
    private profits;
    constructor(provider: ethers.providers.Provider, signer: ethers.Signer);
    /**
     * Set configuration (for programmatic setup)
     */
    setConfiguration(config: StrategyConfig): void;
    /**
     * Initialize the Volatility Grid strategy
     */
    initialize(): Promise<void>;
    /**
     * Generate grid price levels
     */
    private generateGridLevels;
    /**
     * Get user configuration through CLI prompts
     */
    private getUserConfiguration;
    /**
     * Get token information from contract
     */
    private getTokenInfo;
    /**
     * Validate the user configuration
     */
    private validateConfiguration;
    /**
     * Validate configuration and return detailed result
     */
    validateConfigurationWithResult(): Promise<ValidationResult>;
    /**
     * Create initial grid orders
     */
    createGridOrders(): Promise<GridOrderData[]>;
    /**
     * Create a single grid order
     */
    private createSingleGridOrder;
    /**
     * Execute the volatility grid strategy
     */
    executeGridStrategy(): Promise<void>;
    /**
     * Monitor grid execution and handle rebalancing
     */
    private monitorGridExecution;
    /**
     * Check for order fills and create new orders
     */
    private checkOrderFills;
    /**
     * Create opposite order when a grid order fills
     */
    private createOppositeOrder;
    /**
     * Handle rebalancing logic
     */
    private handleRebalancing;
    /**
     * Rebalance the entire grid
     */
    private rebalanceGrid;
    /**
     * Calculate profit from filled order
     */
    private calculateProfit;
    /**
     * Display current grid status
     */
    private displayGridStatus;
    /**
     * Ensure sufficient token approvals for both tokens
     */
    private ensureTokenApprovals;
    /**
     * Submit all orders to 1inch protocol
     */
    private submitOrdersToProtocol;
    /**
     * Submit a single order to 1inch protocol
     */
    private submitSingleOrder;
    /**
     * Get current price using 1inch API
     */
    private getCurrentPrice;
    /**
     * Calculate quote amount from base amount and price
     */
    private calculateQuoteAmount;
    /**
     * Calculate base amount from quote amount and price
     */
    private calculateBaseAmount;
    /**
     * Get order status from 1inch API
     */
    getOrderStatus(orderHash: string): Promise<OneInchOrderInfo | null>;
    /**
     * Cancel all active orders
     */
    cancelAllOrders(): Promise<void>;
    /**
     * Get all active grid orders
     */
    getActiveOrders(): GridOrderData[];
    /**
     * Get grid strategy statistics
     */
    getGridStats(): {
        totalOrders: number;
        activeOrders: number;
        filledOrders: number;
        buyOrders: number;
        sellOrders: number;
        totalProfit: number;
        averageOrderSize: string;
        currentPrice: number;
        priceRange: number;
    };
    /**
     * Emergency stop - cancel all orders and stop strategy
     */
    emergencyStop(): Promise<void>;
    /**
     * Get detailed grid status
     */
    getDetailedStatus(): Promise<{
        gridLevels: Array<{
            level: number;
            buyPrice: number;
            sellPrice: number;
            hasActiveBuy: boolean;
            hasActiveSell: boolean;
        }>;
        performance: {
            totalTrades: number;
            successfulTrades: number;
            totalProfit: number;
            averageProfit: number;
        };
    }>;
}
export {};
//# sourceMappingURL=grid.d.ts.map