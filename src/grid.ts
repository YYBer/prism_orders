#!/usr/bin/env node

import { ethers } from 'ethers';
import axios from 'axios';
import * as readline from 'readline';
import * as dotenv from 'dotenv';

// Import 1inch SDK
import { 
    Api, 
    FetchProviderConnector,
    LimitOrder,
    MakerTraits,
    Address as OneInchAddress,
    randBigInt
} from '@1inch/limit-order-sdk';

// Import types
import {
    StrategyConfig,
    OrderData,
    ValidationResult,
    OrderStatus,
    OneInchOrderInfo,
    LIMIT_ORDER_PROTOCOL_ADDRESSES,
    SWAP_API_BASE,
    LIMIT_ORDER_API_BASE
} from './types';

// Load environment variables
dotenv.config();

// Grid-specific configuration interface
interface GridConfig {
    baseToken: string; // Token to trade (base)
    quoteToken: string; // Quote token (usually stablecoin)
    baseAmount: string; // Total base token amount for sell orders
    quoteAmount: string; // Total quote token amount for buy orders
    gridLevels: number; // Number of grid levels (buy + sell)
    priceRange: number; // Price range percentage around current price
    currentPrice: number; // Current market price
    slippageTolerance: number;
    gasPrice: string;
    baseTokenDecimals: number;
    quoteTokenDecimals: number;
    baseTokenSymbol: string;
    quoteTokenSymbol: string;
    rebalanceThreshold: number; // % threshold to trigger rebalancing
    autoRebalance: boolean; // Whether to auto-rebalance when orders fill
    profitTarget: number; // Minimum profit target per trade
}

// Grid order types
enum GridOrderType {
    BUY = 'BUY',
    SELL = 'SELL'
}

interface GridOrderData extends OrderData {
    gridType: GridOrderType;
    gridLevel: number;
    triggerPrice: number;
    pairOrderHash?: string; // Hash of the opposite order that gets created when this fills
}

// 1inch API Configuration
const ONEINCH_API_KEY = process.env.ONEINCH_API_KEY || 'dyqTRYbTBcOMYmZitPfJ9FP2j1dQVgBv';
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '8453'); // Base mainnet
const LIMIT_ORDER_PROTOCOL_ADDRESS = LIMIT_ORDER_PROTOCOL_ADDRESSES[CHAIN_ID];

const ERC20_ABI = [
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function allowance(address owner, address spender) external view returns (uint256)',
    'function balanceOf(address account) external view returns (uint256)',
    'function decimals() external view returns (uint8)',
    'function symbol() external view returns (string)'
];

export class VolatilityGridStrategy {
    private provider: ethers.providers.Provider;
    private signer: ethers.Signer;
    private oneInchApi: Api;
    private activeOrders: Map<string, GridOrderData>;
    private config: GridConfig;
    private isRunning: boolean = false;
    private gridLevels: Map<number, { buyPrice: number; sellPrice: number }> = new Map();
    private filledOrders: Map<string, GridOrderData> = new Map();
    private profits: number = 0;

    constructor(provider: ethers.providers.Provider, signer: ethers.Signer) {
        this.provider = provider;
        this.signer = signer;
        
        // Initialize 1inch SDK API
        this.oneInchApi = new Api({
            networkId: CHAIN_ID,
            authKey: ONEINCH_API_KEY,
            httpConnector: new FetchProviderConnector()
        });
        
        this.activeOrders = new Map();
        this.config = {} as GridConfig;
    }

    /**
     * Set configuration (for programmatic setup)
     */
    public setConfiguration(config: StrategyConfig): void {
        
        // Convert StrategyConfig to internal GridConfig format
        this.config = {
            baseToken: config.fromToken.address,
            quoteToken: config.toToken.address,
            baseAmount: config.totalAmount,
            quoteAmount: config.totalAmount, // For grid, we need both base and quote amounts
            gridLevels: config.numberOfOrders || 10,
            priceRange: config.priceDropPercent || 20, // Use price drop as range %
            currentPrice: 0, // Will be fetched
            slippageTolerance: config.slippageTolerance,
            gasPrice: config.gasPrice || 'auto',
            baseTokenDecimals: config.fromToken.decimals,
            quoteTokenDecimals: config.toToken.decimals,
            baseTokenSymbol: config.fromToken.symbol,
            quoteTokenSymbol: config.toToken.symbol,
            rebalanceThreshold: 50, // 50% of orders filled triggers rebalance
            autoRebalance: true,
            profitTarget: 0.5 // 0.5% minimum profit per trade
        };
        
        console.log('🔧 Grid configuration set:');
        console.log(`  Pair: ${this.config.baseTokenSymbol}/${this.config.quoteTokenSymbol}`);
        console.log(`  Grid levels: ${this.config.gridLevels}`);
        console.log(`  Price range: ${this.config.priceRange}%`);
        console.log(`  Base amount: ${this.config.baseAmount}`);
        console.log(`  Quote amount: ${this.config.quoteAmount}`);
    }

    /**
     * Initialize the Volatility Grid strategy
     */
    async initialize(): Promise<void> {
        console.log('🌈 1inch Volatility Grid Strategy');
        console.log('==================================\n');
        
        await this.getUserConfiguration();
        await this.validateConfiguration();
        console.log('\n✅ Grid Configuration validated successfully!');
        
        // Fetch current market price
        this.config.currentPrice = await this.getCurrentPrice();
        
        // Generate grid levels
        this.generateGridLevels();
        
        console.log('\n📋 Volatility Grid Summary:');
        console.log(`  📊 Grid Levels: ${this.config.gridLevels}`);
        console.log(`  💰 Base Amount: ${this.config.baseAmount} ${this.config.baseTokenSymbol}`);
        console.log(`  💵 Quote Amount: ${this.config.quoteAmount} ${this.config.quoteTokenSymbol}`);
        console.log(`  📈 Price Range: ±${this.config.priceRange}%`);
        console.log(`  🎯 Current Price: ${this.config.currentPrice.toFixed(6)} ${this.config.quoteTokenSymbol}`);
        console.log(`  🔄 Auto-rebalance: ${this.config.autoRebalance ? 'Enabled' : 'Disabled'}`);
        console.log(`  📈 Profit Target: ${this.config.profitTarget}%`);
    }

    /**
     * Generate grid price levels
     */
    private generateGridLevels(): void {
        const currentPrice = this.config.currentPrice;
        const priceRange = this.config.priceRange / 100;
        const gridLevels = this.config.gridLevels;
        
        // Split grid levels between buy and sell orders
        const buyLevels = Math.floor(gridLevels / 2);
        const sellLevels = Math.ceil(gridLevels / 2);
        
        this.gridLevels.clear();
        
        console.log('\n📊 Grid Price Levels:');
        console.log('===================');
        
        // Generate sell levels (above current price)
        for (let i = 1; i <= sellLevels; i++) {
            const priceMultiplier = 1 + (priceRange * i / sellLevels);
            const sellPrice = currentPrice * priceMultiplier;
            const buyPrice = sellPrice * (1 - this.config.profitTarget / 100);
            
            this.gridLevels.set(i, { buyPrice, sellPrice });
            console.log(`  Level +${i}: Sell at ${sellPrice.toFixed(6)}, Buy at ${buyPrice.toFixed(6)}`);
        }
        
        // Generate buy levels (below current price)
        for (let i = 1; i <= buyLevels; i++) {
            const priceMultiplier = 1 - (priceRange * i / buyLevels);
            const buyPrice = currentPrice * priceMultiplier;
            const sellPrice = buyPrice * (1 + this.config.profitTarget / 100);
            
            this.gridLevels.set(-i, { buyPrice, sellPrice });
            console.log(`  Level -${i}: Buy at ${buyPrice.toFixed(6)}, Sell at ${sellPrice.toFixed(6)}`);
        }
    }

    /**
     * Get user configuration through CLI prompts
     */
    private async getUserConfiguration(): Promise<void> {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const question = (query: string): Promise<string> => {
            return new Promise(resolve => {
                rl.question(query, (answer) => {
                    resolve(answer.trim());
                });
            });
        };

        try {
            console.log('📝 Volatility Grid Configuration');
            console.log('=================================\n');

            // Token Configuration
            const baseToken = await question('Base Token Address (or press enter for 1INCH): ') || 
                process.env.DEFAULT_FROM_TOKEN || '0xc5fecC3a29Fb57B5024eEc8a2239d4621e111CBE';
            const quoteToken = await question('Quote Token Address (or press enter for USDC): ') ||
                process.env.DEFAULT_TO_TOKEN || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

            this.config.baseToken = baseToken;
            this.config.quoteToken = quoteToken;

            // Get token information
            const [baseTokenInfo, quoteTokenInfo] = await Promise.all([
                this.getTokenInfo(baseToken),
                this.getTokenInfo(quoteToken)
            ]);

            this.config.baseTokenDecimals = baseTokenInfo.decimals;
            this.config.quoteTokenDecimals = quoteTokenInfo.decimals;
            this.config.baseTokenSymbol = baseTokenInfo.symbol;
            this.config.quoteTokenSymbol = quoteTokenInfo.symbol;

            console.log(`\n🔄 Trading pair: ${this.config.baseTokenSymbol} ↔ ${this.config.quoteTokenSymbol}`);

            // Grid-specific configuration
            this.config.baseAmount = await question(`Base token amount for sell orders (${this.config.baseTokenSymbol}): `);
            this.config.quoteAmount = await question(`Quote token amount for buy orders (${this.config.quoteTokenSymbol}): `);
            this.config.gridLevels = parseInt(await question('Number of grid levels (e.g., 10): '));
            this.config.priceRange = parseFloat(await question('Price range % around current price (e.g., 20 for ±20%): '));
            this.config.profitTarget = parseFloat(await question('Minimum profit target % per trade (e.g., 0.5): ') || '0.5');

            // Advanced configuration
            const autoRebalanceInput = await question('Enable auto-rebalancing? (y/N): ');
            this.config.autoRebalance = autoRebalanceInput.toLowerCase() === 'y' || autoRebalanceInput.toLowerCase() === 'yes';
            
            if (this.config.autoRebalance) {
                this.config.rebalanceThreshold = parseFloat(await question('Rebalance threshold % (e.g., 50 for 50% of orders filled): ') || '50');
            }

            // Additional parameters
            const slippageInput = await question('Slippage Tolerance % (e.g., 1 for 1%): ');
            this.config.slippageTolerance = parseFloat(slippageInput || '1');
            const gasPriceInput = await question('Gas Price (gwei, press enter for auto): ');
            this.config.gasPrice = gasPriceInput || 'auto';

        } finally {
            rl.close();
        }
    }

    /**
     * Get token information from contract
     */
    private async getTokenInfo(tokenAddress: string): Promise<{ symbol: string; decimals: number }> {
        try {
            const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
            const [symbol, decimals] = await Promise.all([
                tokenContract.symbol(),
                tokenContract.decimals()
            ]);
            return { symbol, decimals };
        } catch (error) {
            console.warn(`⚠️ Could not fetch token info for ${tokenAddress}, using defaults`);
            return { symbol: 'UNKNOWN', decimals: 18 };
        }
    }

    /**
     * Validate the user configuration
     */
    private async validateConfiguration(): Promise<void> {
        const result = await this.validateConfigurationWithResult();
        if (!result.isValid) {
            throw new Error(result.errors.join(', '));
        }
        
        if (result.warnings.length > 0) {
            result.warnings.forEach(warning => console.warn(`⚠️  ${warning}`));
        }
    }

    /**
     * Validate configuration and return detailed result
     */
    public async validateConfigurationWithResult(): Promise<ValidationResult> {
        const errors: string[] = [];
        const warnings: string[] = [];

        try {
            // Validate token addresses
            if (!ethers.utils.isAddress(this.config.baseToken)) {
                errors.push('Invalid base token address');
            }
            if (!ethers.utils.isAddress(this.config.quoteToken)) {
                errors.push('Invalid quote token address');
            }

            // Validate amounts and numbers
            if (parseFloat(this.config.baseAmount) <= 0) {
                errors.push('Base amount must be greater than 0');
            }
            if (parseFloat(this.config.quoteAmount) <= 0) {
                errors.push('Quote amount must be greater than 0');
            }
            if (this.config.gridLevels <= 2) {
                errors.push('Grid levels must be greater than 2');
            }
            if (this.config.priceRange <= 0 || this.config.priceRange > 50) {
                errors.push('Price range must be between 0% and 50%');
            }

            // Check wallet balances
            const walletAddress = await this.signer.getAddress();
            
            // Check base token balance
            const baseTokenContract = new ethers.Contract(this.config.baseToken, ERC20_ABI, this.provider);
            const baseBalance = await baseTokenContract.balanceOf(walletAddress);
            const baseBalanceFormatted = Number(ethers.utils.formatUnits(baseBalance, this.config.baseTokenDecimals));
            const requiredBaseAmount = parseFloat(this.config.baseAmount);

            if (baseBalanceFormatted < requiredBaseAmount) {
                errors.push(`Insufficient ${this.config.baseTokenSymbol} balance. Required: ${requiredBaseAmount}, Available: ${baseBalanceFormatted.toFixed(6)}`);
            }

            // Check quote token balance
            const quoteTokenContract = new ethers.Contract(this.config.quoteToken, ERC20_ABI, this.provider);
            const quoteBalance = await quoteTokenContract.balanceOf(walletAddress);
            const quoteBalanceFormatted = Number(ethers.utils.formatUnits(quoteBalance, this.config.quoteTokenDecimals));
            const requiredQuoteAmount = parseFloat(this.config.quoteAmount);

            if (quoteBalanceFormatted < requiredQuoteAmount) {
                errors.push(`Insufficient ${this.config.quoteTokenSymbol} balance. Required: ${requiredQuoteAmount}, Available: ${quoteBalanceFormatted.toFixed(6)}`);
            }

            // Grid-specific validations
            if (this.config.gridLevels > 30) {
                warnings.push('Large number of grid levels may result in high gas costs');
            }
            if (this.config.profitTarget < 0.1) {
                warnings.push('Very low profit target may result in frequent but small profits');
            }
            if (this.config.priceRange > 30) {
                warnings.push('Large price range may result in orders far from market price');
            }

            console.log(`✅ Balance check: ${baseBalanceFormatted.toFixed(6)} ${this.config.baseTokenSymbol}, ${quoteBalanceFormatted.toFixed(6)} ${this.config.quoteTokenSymbol} available`);

        } catch (error) {
            errors.push(`Validation error: ${(error as Error).message}`);
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Create initial grid orders
     */
    async createGridOrders(): Promise<GridOrderData[]> {
        console.log('\n🚀 Creating Volatility Grid orders...');
        
        const orders: GridOrderData[] = [];
        const buyLevels = Math.floor(this.config.gridLevels / 2);
        const sellLevels = Math.ceil(this.config.gridLevels / 2);

        // Ensure token approvals
        await this.ensureTokenApprovals();

        // Create sell orders (above current price)
        for (let i = 1; i <= sellLevels; i++) {
            try {
                const gridLevel = this.gridLevels.get(i);
                if (!gridLevel) {
                    console.error(`❌ Grid level ${i} not found. Available levels:`, Array.from(this.gridLevels.keys()));
                    continue;
                }
                
                const orderAmount = ethers.utils.parseUnits(
                    (parseFloat(this.config.baseAmount) / sellLevels).toString(),
                    this.config.baseTokenDecimals
                );

                console.log(`\n📋 Creating sell order at level +${i}...`);
                const orderData = await this.createSingleGridOrder(
                    orderAmount,
                    GridOrderType.SELL,
                    i,
                    gridLevel.sellPrice
                );
                
                if (orderData) {
                    orders.push(orderData);
                    this.activeOrders.set(orderData.orderHash, orderData);
                    console.log(`✅ Sell order ${i} created at ${gridLevel.sellPrice.toFixed(6)} ${this.config.quoteTokenSymbol}`);
                }
                
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                console.error(`❌ Failed to create sell order ${i}:`, (error as Error).message);
            }
        }

        // Create buy orders (below current price)
        for (let i = 1; i <= buyLevels; i++) {
            try {
                const gridLevel = this.gridLevels.get(-i);
                if (!gridLevel) {
                    console.error(`❌ Grid level -${i} not found. Available levels:`, Array.from(this.gridLevels.keys()));
                    continue;
                }
                
                const orderAmount = ethers.utils.parseUnits(
                    (parseFloat(this.config.quoteAmount) / buyLevels).toString(),
                    this.config.quoteTokenDecimals
                );

                console.log(`\n📋 Creating buy order at level -${i}...`);
                const orderData = await this.createSingleGridOrder(
                    orderAmount,
                    GridOrderType.BUY,
                    -i,
                    gridLevel.buyPrice
                );
                
                if (orderData) {
                    orders.push(orderData);
                    this.activeOrders.set(orderData.orderHash, orderData);
                    console.log(`✅ Buy order ${i} created at ${gridLevel.buyPrice.toFixed(6)} ${this.config.quoteTokenSymbol}`);
                }
                
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                console.error(`❌ Failed to create buy order ${i}:`, (error as Error).message);
            }
        }

        console.log(`\n🎉 Created ${orders.length}/${this.config.gridLevels} grid orders successfully!`);
        return orders;
    }

    /**
     * Create a single grid order
     */
    private async createSingleGridOrder(
        makingAmount: ethers.BigNumber,
        orderType: GridOrderType,
        gridLevel: number,
        targetPrice: number
    ): Promise<GridOrderData | null> {
        try {
            const walletAddress = await this.signer.getAddress();
            
            let makerAsset: string, takerAsset: string, takingAmount: bigint;
            
            if (orderType === GridOrderType.SELL) {
                // Selling base token for quote token
                makerAsset = this.config.baseToken;
                takerAsset = this.config.quoteToken;
                takingAmount = this.calculateQuoteAmount(makingAmount.toBigInt(), targetPrice);
            } else {
                // Buying base token with quote token
                makerAsset = this.config.quoteToken;
                takerAsset = this.config.baseToken;
                takingAmount = this.calculateBaseAmount(makingAmount.toBigInt(), targetPrice);
            }

            // Set long expiration (1 month)
            const expirationTimestamp = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);
            const UINT_40_MAX = (1n << 40n) - 1n;
            
            // Create maker traits with proper expiration and nonce
            const makerTraits = MakerTraits.default()
                .withExpiration(BigInt(expirationTimestamp))
                .withNonce(randBigInt(UINT_40_MAX))
                .allowPartialFills()
                .allowMultipleFills();

            // Create limit order using 1inch SDK
            const limitOrder = new LimitOrder({
                makerAsset: new OneInchAddress(makerAsset),
                takerAsset: new OneInchAddress(takerAsset),
                makingAmount: makingAmount.toBigInt(),
                takingAmount: takingAmount,
                maker: new OneInchAddress(walletAddress),
                salt: randBigInt(2n ** 256n - 1n), // Random salt
                receiver: new OneInchAddress(walletAddress)
            }, makerTraits);

            // Get typed data for signing
            const typedData = limitOrder.getTypedData(CHAIN_ID);

            // Sign the order using EIP-712
            const signature = await (this.signer as any)._signTypedData(
                typedData.domain,
                { Order: typedData.types.Order },
                typedData.message
            );

            // Get order hash
            const orderHash = limitOrder.getOrderHash(CHAIN_ID);

            // Helper function to safely convert to string
            const safeToString = (value: any) => {
                if (typeof value === 'bigint') {
                    return value.toString();
                }
                if (value && typeof value.toString === 'function') {
                    return value.toString();
                }
                return String(value);
            };

            const orderData: GridOrderData = {
                order: {
                    salt: safeToString(limitOrder.salt),
                    maker: safeToString(limitOrder.maker),
                    receiver: safeToString(limitOrder.receiver),
                    makerAsset: safeToString(limitOrder.makerAsset),
                    takerAsset: safeToString(limitOrder.takerAsset),
                    makingAmount: safeToString(limitOrder.makingAmount),
                    takingAmount: safeToString(limitOrder.takingAmount),
                    makerTraits: safeToString(limitOrder.makerTraits)
                },
                orderHash: orderHash,
                signature,
                targetPrice,
                orderIndex: Math.abs(gridLevel),
                status: OrderStatus.ACTIVE,
                createdAt: new Date(),
                expiresAt: new Date(expirationTimestamp * 1000),
                remainingMakingAmount: makingAmount.toBigInt(),
                gridType: orderType,
                gridLevel,
                triggerPrice: targetPrice,
                limitOrderInstance: limitOrder // Store the original instance
            };

            return orderData;

        } catch (error) {
            console.error('❌ Error creating grid order:', error);
            return null;
        }
    }

    /**
     * Execute the volatility grid strategy
     */
    async executeGridStrategy(): Promise<void> {
        console.log('\n🚀 Starting Volatility Grid Strategy...');
        console.log('======================================');
        
        if (this.isRunning) {
            console.log('⚠️ Grid strategy is already running');
            return;
        }

        this.isRunning = true;
        
        try {
            // Ensure we have current price and grid levels generated
            if (this.config.currentPrice === 0 || this.gridLevels.size === 0) {
                console.log('🔄 Initializing grid parameters...');
                
                // Fetch current market price
                this.config.currentPrice = await this.getCurrentPrice();
                
                // Generate grid levels
                this.generateGridLevels();
                
                console.log('\n📋 Volatility Grid Summary:');
                console.log(`  📊 Grid Levels: ${this.config.gridLevels}`);
                console.log(`  💰 Base Amount: ${this.config.baseAmount} ${this.config.baseTokenSymbol}`);
                console.log(`  💵 Quote Amount: ${this.config.quoteAmount} ${this.config.quoteTokenSymbol}`);
                console.log(`  📈 Price Range: ±${this.config.priceRange}%`);
                console.log(`  🎯 Current Price: ${this.config.currentPrice.toFixed(6)} ${this.config.quoteTokenSymbol}`);
                console.log(`  🔄 Auto-rebalance: ${this.config.autoRebalance ? 'Enabled' : 'Disabled'}`);
                console.log(`  📈 Profit Target: ${this.config.profitTarget}%`);
            }
            
            // Create initial grid orders
            const orders = await this.createGridOrders();
            
            if (orders.length === 0) {
                console.log('❌ No orders created. Grid strategy cannot proceed.');
                return;
            }

            // Submit orders to 1inch protocol
            console.log('\n📤 Submitting orders to 1inch protocol...');
            await this.submitOrdersToProtocol();

            // Start monitoring and rebalancing
            console.log('\n👀 Starting grid monitoring...');
            await this.monitorGridExecution();

        } catch (error) {
            console.error('❌ Grid strategy execution failed:', (error as Error).message);
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Monitor grid execution and handle rebalancing
     */
    private async monitorGridExecution(): Promise<void> {
        console.log('\n🔍 Grid Monitoring Active');
        console.log('Press Ctrl+C to stop monitoring\n');

        const monitoringInterval = setInterval(async () => {
            try {
                await this.checkOrderFills();
                await this.handleRebalancing();
                await this.displayGridStatus();
                
            } catch (error) {
                console.error('❌ Monitoring error:', (error as Error).message);
            }
        }, 30000); // Check every 30 seconds

        // Keep monitoring until stopped
        process.on('SIGINT', () => {
            clearInterval(monitoringInterval);
            this.isRunning = false;
            console.log('\n🛑 Grid monitoring stopped');
        });
    }

    /**
     * Check for order fills and create new orders
     */
    private async checkOrderFills(): Promise<void> {
        for (const [orderHash, orderData] of this.activeOrders) {
            if (orderData.status !== OrderStatus.ACTIVE) continue;
            
            try {
                const status = await this.getOrderStatus(orderHash);
                if (status) {
                    const fillableBalance = status.fillableBalance || '0';
                    const remainingAmount = ethers.BigNumber.from(fillableBalance);
                    
                    if (remainingAmount.isZero()) {
                        // Order completely filled
                        orderData.status = OrderStatus.FILLED;
                        this.filledOrders.set(orderHash, orderData);
                        this.activeOrders.delete(orderHash);
                        
                        console.log(`✅ Grid order filled: ${orderData.gridType} at level ${orderData.gridLevel}`);
                        
                        // Create opposite order if auto-rebalance is enabled
                        if (this.config.autoRebalance) {
                            await this.createOppositeOrder(orderData);
                        }
                        
                        // Calculate profit
                        this.calculateProfit(orderData);
                        
                    } else if (remainingAmount.lt(orderData.remainingMakingAmount || 0)) {
                        // Partially filled
                        orderData.status = OrderStatus.PARTIALLY_FILLED;
                        orderData.remainingMakingAmount = remainingAmount.toBigInt();
                    }
                }
            } catch (error) {
                console.log(`⚠️ Could not check status for grid order ${orderData.gridLevel}`);
            }
        }
    }

    /**
     * Create opposite order when a grid order fills
     */
    private async createOppositeOrder(filledOrder: GridOrderData): Promise<void> {
        try {
            const gridLevel = this.gridLevels.get(filledOrder.gridLevel);
            if (!gridLevel) return;

            let newOrderType: GridOrderType;
            let newTargetPrice: number;
            let newAmount: ethers.BigNumber;

            if (filledOrder.gridType === GridOrderType.BUY) {
                // If buy order filled, create sell order at higher price
                newOrderType = GridOrderType.SELL;
                newTargetPrice = gridLevel.sellPrice;
                // Use the base tokens we just bought
                newAmount = ethers.utils.parseUnits(
                    ethers.utils.formatUnits(filledOrder.remainingMakingAmount || 0, this.config.quoteTokenDecimals),
                    this.config.baseTokenDecimals
                );
            } else {
                // If sell order filled, create buy order at lower price  
                newOrderType = GridOrderType.BUY;
                newTargetPrice = gridLevel.buyPrice;
                // Use the quote tokens we just received
                newAmount = ethers.utils.parseUnits(
                    ethers.utils.formatUnits(filledOrder.remainingMakingAmount || 0, this.config.baseTokenDecimals),
                    this.config.quoteTokenDecimals
                );
            }

            console.log(`🔄 Creating opposite ${newOrderType.toLowerCase()} order at level ${filledOrder.gridLevel}`);
            
            const newOrder = await this.createSingleGridOrder(
                newAmount,
                newOrderType,
                filledOrder.gridLevel,
                newTargetPrice
            );

            if (newOrder) {
                this.activeOrders.set(newOrder.orderHash, newOrder);
                await this.submitSingleOrder(newOrder);
                console.log(`✅ Opposite order created: ${newOrderType} at ${newTargetPrice.toFixed(6)}`);
            }

        } catch (error) {
            console.error('❌ Failed to create opposite order:', (error as Error).message);
        }
    }

    /**
     * Handle rebalancing logic
     */
    private async handleRebalancing(): Promise<void> {
        if (!this.config.autoRebalance) return;

        const totalOrders = this.filledOrders.size + this.activeOrders.size;
        const filledRatio = this.filledOrders.size / totalOrders * 100;

        if (filledRatio >= this.config.rebalanceThreshold) {
            console.log(`🔄 Rebalancing triggered: ${filledRatio.toFixed(1)}% of orders filled`);
            await this.rebalanceGrid();
        }
    }

    /**
     * Rebalance the entire grid
     */
    private async rebalanceGrid(): Promise<void> {
        try {
            console.log('🔄 Rebalancing grid...');
            
            // Cancel all active orders
            await this.cancelAllOrders();
            
            // Update current price
            this.config.currentPrice = await this.getCurrentPrice();
            
            // Regenerate grid levels
            this.generateGridLevels();
            
            // Create new grid orders
            await this.createGridOrders();
            await this.submitOrdersToProtocol();
            
            // Reset filled orders
            this.filledOrders.clear();
            
            console.log('✅ Grid rebalanced successfully');
            
        } catch (error) {
            console.error('❌ Grid rebalancing failed:', (error as Error).message);
        }
    }

    /**
     * Calculate profit from filled order
     */
    private calculateProfit(filledOrder: GridOrderData): void {
        // Simple profit calculation - this could be enhanced
        const orderValue = Number(ethers.utils.formatUnits(
            filledOrder.remainingMakingAmount || 0,
            filledOrder.gridType === GridOrderType.SELL ? this.config.baseTokenDecimals : this.config.quoteTokenDecimals
        ));
        
        const estimatedProfit = orderValue * (this.config.profitTarget / 100);
        this.profits += estimatedProfit;
        
        console.log(`💰 Estimated profit from trade: $${estimatedProfit.toFixed(4)} (Total: $${this.profits.toFixed(4)})`);
    }

    /**
     * Display current grid status
     */
    private async displayGridStatus(): Promise<void> {
        const currentTime = new Date().toLocaleTimeString();
        const activeCount = this.activeOrders.size;
        const filledCount = this.filledOrders.size;
        const totalOrders = activeCount + filledCount;
        
        console.log(`📊 Grid Status [${currentTime}]: ${activeCount} active, ${filledCount} filled (${totalOrders} total) | Profit: ${this.profits.toFixed(4)}`);
    }

    /**
     * Ensure sufficient token approvals for both tokens
     */
    private async ensureTokenApprovals(): Promise<void> {
        console.log('🔐 Checking token approvals...');
        
        const walletAddress = await this.signer.getAddress();
        
        // Approve base token
        const baseTokenContract = new ethers.Contract(this.config.baseToken, ERC20_ABI, this.signer);
        const baseAmount = ethers.utils.parseUnits(this.config.baseAmount, this.config.baseTokenDecimals);
        const baseAllowance = await baseTokenContract.allowance(walletAddress, LIMIT_ORDER_PROTOCOL_ADDRESS);
        
        if (baseAllowance.lt(baseAmount)) {
            console.log(`📝 Approving ${this.config.baseTokenSymbol} for 1inch protocol...`);
            const approveTx = await baseTokenContract.approve(LIMIT_ORDER_PROTOCOL_ADDRESS, baseAmount);
            await approveTx.wait();
            console.log(`✅ ${this.config.baseTokenSymbol} approval confirmed`);
        }
        
        // Approve quote token
        const quoteTokenContract = new ethers.Contract(this.config.quoteToken, ERC20_ABI, this.signer);
        const quoteAmount = ethers.utils.parseUnits(this.config.quoteAmount, this.config.quoteTokenDecimals);
        const quoteAllowance = await quoteTokenContract.allowance(walletAddress, LIMIT_ORDER_PROTOCOL_ADDRESS);
        
        if (quoteAllowance.lt(quoteAmount)) {
            console.log(`📝 Approving ${this.config.quoteTokenSymbol} for 1inch protocol...`);
            const approveTx = await quoteTokenContract.approve(LIMIT_ORDER_PROTOCOL_ADDRESS, quoteAmount);
            await approveTx.wait();
            console.log(`✅ ${this.config.quoteTokenSymbol} approval confirmed`);
        }
        
        console.log('✅ Token approvals sufficient');
    }

    /**
     * Submit all orders to 1inch protocol
     */
    private async submitOrdersToProtocol(): Promise<void> {
        let successCount = 0;
        
        for (const [, orderData] of this.activeOrders) {
            if (await this.submitSingleOrder(orderData)) {
                successCount++;
            }
        }

        console.log(`\n📤 Successfully submitted ${successCount}/${this.activeOrders.size} orders to 1inch protocol`);
    }

    /**
     * Submit a single order to 1inch protocol
     */
    private async submitSingleOrder(orderData: GridOrderData): Promise<boolean> {
        try {
            // Use stored limit order instance if available, otherwise recreate
            let limitOrder = orderData.limitOrderInstance;
            
            if (!limitOrder) {
                // Fallback: recreate limit order from stored data
                console.log(`🔧 Recreating order from stored data for ${orderData.gridType} order`);
                console.log('Order data:', {
                    makingAmount: orderData.order.makingAmount,
                    takingAmount: orderData.order.takingAmount,
                    salt: orderData.order.salt,
                    makerTraits: orderData.order.makerTraits
                });
                
                limitOrder = new LimitOrder({
                    makerAsset: new OneInchAddress(orderData.order.makerAsset),
                    takerAsset: new OneInchAddress(orderData.order.takerAsset),
                    makingAmount: BigInt(orderData.order.makingAmount),
                    takingAmount: BigInt(orderData.order.takingAmount),
                    maker: new OneInchAddress(orderData.order.maker),
                    salt: BigInt(orderData.order.salt),
                    receiver: new OneInchAddress(orderData.order.receiver)
                }, new MakerTraits(BigInt(orderData.order.makerTraits)));
            } else {
                console.log(`🚀 Using stored limit order instance for ${orderData.gridType} order`);
            }

            // Submit using SDK method
            await this.oneInchApi.submitOrder(limitOrder, orderData.signature);
            
            console.log(`✅ ${orderData.gridType} order submitted at level ${orderData.gridLevel}`);
            return true;
            
        } catch (error) {
            console.error(`❌ Submit error for ${orderData.gridType} order:`, (error as any).response?.data || (error as Error).message);
            return false;
        }
    }

    /**
     * Get current price using 1inch API
     */
    private async getCurrentPrice(): Promise<number> {
        try {
            console.log('📊 Fetching current price from 1inch API...');
            
            const response = await axios.get(
                `${SWAP_API_BASE(CHAIN_ID)}/quote`,
                {
                    params: {
                        src: this.config.baseToken,
                        dst: this.config.quoteToken,
                        amount: ethers.utils.parseUnits('1', this.config.baseTokenDecimals).toString()
                    },
                    headers: {
                        'Authorization': `Bearer ${ONEINCH_API_KEY}`,
                        'accept': 'application/json'
                    }
                }
            );

            const dstAmount = response.data.dstAmount;
            const price = Number(ethers.utils.formatUnits(dstAmount, this.config.quoteTokenDecimals));
            
            console.log(`💰 Current price: 1 ${this.config.baseTokenSymbol} = ${price.toFixed(6)} ${this.config.quoteTokenSymbol}`);
            return price;
            
        } catch (error) {
            console.warn('⚠️ Failed to fetch current price, using fallback');
            return 1.0; // Fallback price
        }
    }

    /**
     * Calculate quote amount from base amount and price
     */
    private calculateQuoteAmount(baseAmount: bigint, price: number): bigint {
        const baseAmountReadable = Number(ethers.utils.formatUnits(baseAmount.toString(), this.config.baseTokenDecimals));
        const quoteAmountReadable = baseAmountReadable * price;
        const quoteAmountWithSlippage = quoteAmountReadable * (1 - this.config.slippageTolerance / 100);
        
        return ethers.utils.parseUnits(
            quoteAmountWithSlippage.toFixed(this.config.quoteTokenDecimals), 
            this.config.quoteTokenDecimals
        ).toBigInt();
    }

    /**
     * Calculate base amount from quote amount and price
     */
    private calculateBaseAmount(quoteAmount: bigint, price: number): bigint {
        const quoteAmountReadable = Number(ethers.utils.formatUnits(quoteAmount.toString(), this.config.quoteTokenDecimals));
        const baseAmountReadable = quoteAmountReadable / price;
        const baseAmountWithSlippage = baseAmountReadable * (1 - this.config.slippageTolerance / 100);
        
        return ethers.utils.parseUnits(
            baseAmountWithSlippage.toFixed(this.config.baseTokenDecimals), 
            this.config.baseTokenDecimals
        ).toBigInt();
    }

    /**
     * Get order status from 1inch API
     */
    async getOrderStatus(orderHash: string): Promise<OneInchOrderInfo | null> {
        try {
            const response = await axios.get(
                `${LIMIT_ORDER_API_BASE(CHAIN_ID)}/order/${orderHash}`,
                {
                    headers: {
                        'Authorization': `Bearer ${ONEINCH_API_KEY}`,
                        'accept': 'application/json'
                    }
                }
            );
            
            return response.data;
        } catch (error) {
            return null;
        }
    }

    /**
     * Cancel all active orders
     */
    async cancelAllOrders(): Promise<void> {
        console.log('🚫 Cancelling all active grid orders...');
        
        let cancelledCount = 0;
        for (const [orderHash, orderData] of this.activeOrders) {
            try {
                await axios.delete(
                    `${LIMIT_ORDER_API_BASE(CHAIN_ID)}/order/${orderHash}`,
                    {
                        headers: {
                            'Authorization': `Bearer ${ONEINCH_API_KEY}`
                        }
                    }
                );
                
                orderData.status = OrderStatus.CANCELLED;
                cancelledCount++;
                
            } catch (error) {
                console.error(`❌ Failed to cancel order ${orderHash.slice(0, 10)}...`);
            }
        }
        
        this.activeOrders.clear();
        console.log(`✅ Cancelled ${cancelledCount} orders`);
    }

    /**
     * Get all active grid orders
     */
    getActiveOrders(): GridOrderData[] {
        return Array.from(this.activeOrders.values());
    }

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
    } {
        const allOrders = [...this.activeOrders.values(), ...this.filledOrders.values()];
        
        return {
            totalOrders: allOrders.length,
            activeOrders: this.activeOrders.size,
            filledOrders: this.filledOrders.size,
            buyOrders: allOrders.filter(o => o.gridType === GridOrderType.BUY).length,
            sellOrders: allOrders.filter(o => o.gridType === GridOrderType.SELL).length,
            totalProfit: this.profits,
            averageOrderSize: (parseFloat(this.config.baseAmount) / this.config.gridLevels).toFixed(6),
            currentPrice: this.config.currentPrice,
            priceRange: this.config.priceRange
        };
    }

    /**
     * Emergency stop - cancel all orders and stop strategy
     */
    async emergencyStop(): Promise<void> {
        console.log('🚨 Emergency stop activated!');
        this.isRunning = false;
        await this.cancelAllOrders();
        console.log('🛑 All orders cancelled, strategy stopped');
    }

    /**
     * Get detailed grid status
     */
    async getDetailedStatus(): Promise<{
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
    }> {
        const gridStatus = Array.from(this.gridLevels.entries()).map(([level, prices]) => {
            const hasActiveBuy = Array.from(this.activeOrders.values())
                .some(o => o.gridLevel === level && o.gridType === GridOrderType.BUY);
            const hasActiveSell = Array.from(this.activeOrders.values())
                .some(o => o.gridLevel === level && o.gridType === GridOrderType.SELL);
            
            return {
                level,
                buyPrice: prices.buyPrice,
                sellPrice: prices.sellPrice,
                hasActiveBuy,
                hasActiveSell
            };
        });

        const filledOrdersArray = Array.from(this.filledOrders.values());
        const totalTrades = filledOrdersArray.length;
        const successfulTrades = filledOrdersArray.filter(o => o.status === OrderStatus.FILLED).length;
        const averageProfit = totalTrades > 0 ? this.profits / totalTrades : 0;

        return {
            gridLevels: gridStatus,
            performance: {
                totalTrades,
                successfulTrades,
                totalProfit: this.profits,
                averageProfit
            }
        };
    }
}