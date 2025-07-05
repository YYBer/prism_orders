#!/usr/bin/env node
import { ethers } from 'ethers';
import { StrategyConfig, OrderData, ValidationResult, OneInchOrderInfo } from './types';
export declare class HodlLadderDCA {
    private provider;
    private signer;
    private oneInchApi;
    private activeOrders;
    private config;
    private strategyConfig;
    constructor(provider: ethers.providers.Provider, signer: ethers.Signer);
    /**
     * Set configuration (for programmatic setup)
     */
    setConfiguration(config: StrategyConfig): void;
    /**
     * Initialize the DCA Hodl Ladder strategy
     */
    initialize(): Promise<void>;
    /**
     * Get Base mainnet tokens
     */
    private getBaseTokens;
    /**
     * Get suggested token pairs for Base mainnet
     */
    private suggestTokenPairs;
    /**
     * Get user configuration through CLI prompts
     */
    private getUserConfiguration;
    /**
     * Validate the user configuration
     */
    private validateConfiguration;
    /**
     * Validate configuration and return detailed result
     */
    validateConfigurationWithResult(): Promise<ValidationResult>;
    /**
     * Approve token spending
     */
    private approveToken;
    /**
     * Create DCA orders based on strategy using 1inch SDK
     */
    createDCAOrders(): Promise<OrderData[]>;
    /**
     * Ensure sufficient token approval for 1inch protocol
     */
    private ensureTokenApproval;
    /**
     * Create a single limit order using 1inch SDK
     */
    private createSingleOrderWithSDK;
    /**
     * Calculate target price based on strategy
     */
    private calculateTargetPrice;
    /**
     * Calculate taking amount based on price and slippage (BigInt version)
     */
    private calculateTakingAmountBigInt;
    /**
     * Get current price using 1inch API
     */
    private getCurrentPrice;
    /**
     * Get mock price for fallback
     */
    private getMockPrice;
    /**
     * Get active orders from 1inch API
     */
    getActiveOrdersFromAPI(): Promise<OneInchOrderInfo[]>;
    /**
     * Monitor and manage active orders using 1inch API
     */
    monitorOrders(): Promise<void>;
    /**
     * Submit orders to 1inch protocol using SDK
     */
    submitOrdersToProtocol(): Promise<{
        success: boolean;
        orderHash?: string;
        error?: string;
    }[]>;
    /**
     * Monitor and execute orders (enhanced monitoring with 1inch API)
     */
    monitorAndExecute(): Promise<void>;
    /**
     * Check if any orders should be executed using 1inch API
     */
    private checkOrderExecutionWithAPI;
    /**
     * Determine if an order should be executed
     */
    private shouldExecuteOrder;
    /**
     * Rebalance strategy if needed
     */
    private rebalanceIfNeeded;
    /**
     * Cancel all active orders using 1inch API
     */
    cancelAllOrders(): Promise<void>;
    /**
     * Display current strategy status with 1inch API data
     */
    displayStatus(): Promise<void>;
    /**
     * Get strategy type name
     */
    private getStrategyTypeName;
    /**
     * Get order by hash from 1inch API
     */
    getOrderStatus(orderHash: string): Promise<OneInchOrderInfo | null>;
    /**
     * Update local order status based on API data
     */
    syncOrdersWithAPI(): Promise<void>;
}
//# sourceMappingURL=dca.d.ts.map