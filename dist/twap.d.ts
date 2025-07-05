#!/usr/bin/env node
import { ethers } from 'ethers';
import { StrategyConfig, OrderData, ValidationResult, OneInchOrderInfo } from './types';
export declare class TWAPStrategy {
    private provider;
    private signer;
    private oneInchApi;
    private activeOrders;
    private config;
    private strategyConfig;
    private executionSchedule;
    private isExecuting;
    constructor(provider: ethers.providers.Provider, signer: ethers.Signer);
    /**
     * Set configuration (for programmatic setup)
     */
    setConfiguration(config: StrategyConfig): void;
    /**
     * Initialize the TWAP strategy
     */
    initialize(): Promise<void>;
    /**
     * Generate execution schedule for TWAP orders
     */
    private generateExecutionSchedule;
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
     * Create TWAP orders using 1inch SDK
     */
    createTWAPOrders(): Promise<OrderData[]>;
    /**
     * Create a single TWAP order
     */
    private createSingleTWAPOrder;
    /**
     * Execute TWAP strategy with automatic scheduling
     */
    executeTWAPStrategy(): Promise<void>;
    /**
     * Monitor TWAP execution progress
     */
    private monitorTWAPExecution;
    /**
     * Check execution status of all orders
     */
    private checkExecutionStatus;
    /**
     * Handle order expirations
     */
    private handleOrderExpirations;
    /**
     * Ensure sufficient token approval for 1inch protocol
     */
    private ensureTokenApproval;
    /**
     * Submit orders to 1inch protocol
     */
    private submitOrdersToProtocol;
    /**
     * Get current price using 1inch API
     */
    private getCurrentPrice;
    /**
     * Calculate taking amount based on price and slippage
     */
    private calculateTakingAmountBigInt;
    /**
     * Get order status from 1inch API
     */
    getOrderStatus(orderHash: string): Promise<OneInchOrderInfo | null>;
    /**
     * Get all active orders
     */
    getActiveOrders(): OrderData[];
    /**
     * Cancel a specific order
     */
    cancelOrder(orderHash: string): Promise<boolean>;
    /**
     * Get strategy statistics
     */
    getStrategyStats(): {
        totalOrders: number;
        activeOrders: number;
        filledOrders: number;
        expiredOrders: number;
        cancelledOrders: number;
        averageOrderSize: string;
        nextExecutionTime?: Date;
    };
}
//# sourceMappingURL=twap.d.ts.map