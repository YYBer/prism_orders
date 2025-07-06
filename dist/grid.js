#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VolatilityGridStrategy = void 0;
const ethers_1 = require("ethers");
const axios_1 = __importDefault(require("axios"));
const readline = __importStar(require("readline"));
const dotenv = __importStar(require("dotenv"));
// Import 1inch SDK
const limit_order_sdk_1 = require("@1inch/limit-order-sdk");
// Import types
const types_1 = require("./types");
// Load environment variables
dotenv.config();
// Grid order types
var GridOrderType;
(function (GridOrderType) {
    GridOrderType["BUY"] = "BUY";
    GridOrderType["SELL"] = "SELL";
})(GridOrderType || (GridOrderType = {}));
// 1inch API Configuration
const ONEINCH_API_KEY = process.env.ONEINCH_API_KEY || 'dyqTRYbTBcOMYmZitPfJ9FP2j1dQVgBv';
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '8453'); // Base mainnet
const LIMIT_ORDER_PROTOCOL_ADDRESS = types_1.LIMIT_ORDER_PROTOCOL_ADDRESSES[CHAIN_ID];
const ERC20_ABI = [
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function allowance(address owner, address spender) external view returns (uint256)',
    'function balanceOf(address account) external view returns (uint256)',
    'function decimals() external view returns (uint8)',
    'function symbol() external view returns (string)'
];
class VolatilityGridStrategy {
    constructor(provider, signer) {
        this.isRunning = false;
        this.gridLevels = new Map();
        this.filledOrders = new Map();
        this.profits = 0;
        this.provider = provider;
        this.signer = signer;
        // Initialize 1inch SDK API
        this.oneInchApi = new limit_order_sdk_1.Api({
            networkId: CHAIN_ID,
            authKey: ONEINCH_API_KEY,
            httpConnector: new limit_order_sdk_1.FetchProviderConnector()
        });
        this.activeOrders = new Map();
        this.config = {};
    }
    /**
     * Set configuration (for programmatic setup)
     */
    setConfiguration(config) {
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
    async initialize() {
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
    generateGridLevels() {
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
    async getUserConfiguration() {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        const question = (query) => {
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
        }
        finally {
            rl.close();
        }
    }
    /**
     * Get token information from contract
     */
    async getTokenInfo(tokenAddress) {
        try {
            const tokenContract = new ethers_1.ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
            const [symbol, decimals] = await Promise.all([
                tokenContract.symbol(),
                tokenContract.decimals()
            ]);
            return { symbol, decimals };
        }
        catch (error) {
            console.warn(`⚠️ Could not fetch token info for ${tokenAddress}, using defaults`);
            return { symbol: 'UNKNOWN', decimals: 18 };
        }
    }
    /**
     * Validate the user configuration
     */
    async validateConfiguration() {
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
    async validateConfigurationWithResult() {
        const errors = [];
        const warnings = [];
        try {
            // Validate token addresses
            if (!ethers_1.ethers.utils.isAddress(this.config.baseToken)) {
                errors.push('Invalid base token address');
            }
            if (!ethers_1.ethers.utils.isAddress(this.config.quoteToken)) {
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
            const baseTokenContract = new ethers_1.ethers.Contract(this.config.baseToken, ERC20_ABI, this.provider);
            const baseBalance = await baseTokenContract.balanceOf(walletAddress);
            const baseBalanceFormatted = Number(ethers_1.ethers.utils.formatUnits(baseBalance, this.config.baseTokenDecimals));
            const requiredBaseAmount = parseFloat(this.config.baseAmount);
            if (baseBalanceFormatted < requiredBaseAmount) {
                errors.push(`Insufficient ${this.config.baseTokenSymbol} balance. Required: ${requiredBaseAmount}, Available: ${baseBalanceFormatted.toFixed(6)}`);
            }
            // Check quote token balance
            const quoteTokenContract = new ethers_1.ethers.Contract(this.config.quoteToken, ERC20_ABI, this.provider);
            const quoteBalance = await quoteTokenContract.balanceOf(walletAddress);
            const quoteBalanceFormatted = Number(ethers_1.ethers.utils.formatUnits(quoteBalance, this.config.quoteTokenDecimals));
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
        }
        catch (error) {
            errors.push(`Validation error: ${error.message}`);
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
    async createGridOrders() {
        console.log('\n🚀 Creating Volatility Grid orders...');
        const orders = [];
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
                const orderAmount = ethers_1.ethers.utils.parseUnits((parseFloat(this.config.baseAmount) / sellLevels).toString(), this.config.baseTokenDecimals);
                console.log(`\n📋 Creating sell order at level +${i}...`);
                const orderData = await this.createSingleGridOrder(orderAmount, GridOrderType.SELL, i, gridLevel.sellPrice);
                if (orderData) {
                    orders.push(orderData);
                    this.activeOrders.set(orderData.orderHash, orderData);
                    console.log(`✅ Sell order ${i} created at ${gridLevel.sellPrice.toFixed(6)} ${this.config.quoteTokenSymbol}`);
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            catch (error) {
                console.error(`❌ Failed to create sell order ${i}:`, error.message);
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
                const orderAmount = ethers_1.ethers.utils.parseUnits((parseFloat(this.config.quoteAmount) / buyLevels).toString(), this.config.quoteTokenDecimals);
                console.log(`\n📋 Creating buy order at level -${i}...`);
                const orderData = await this.createSingleGridOrder(orderAmount, GridOrderType.BUY, -i, gridLevel.buyPrice);
                if (orderData) {
                    orders.push(orderData);
                    this.activeOrders.set(orderData.orderHash, orderData);
                    console.log(`✅ Buy order ${i} created at ${gridLevel.buyPrice.toFixed(6)} ${this.config.quoteTokenSymbol}`);
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            catch (error) {
                console.error(`❌ Failed to create buy order ${i}:`, error.message);
            }
        }
        console.log(`\n🎉 Created ${orders.length}/${this.config.gridLevels} grid orders successfully!`);
        return orders;
    }
    /**
     * Create a single grid order
     */
    async createSingleGridOrder(makingAmount, orderType, gridLevel, targetPrice) {
        try {
            const walletAddress = await this.signer.getAddress();
            let makerAsset, takerAsset, takingAmount;
            if (orderType === GridOrderType.SELL) {
                // Selling base token for quote token
                makerAsset = this.config.baseToken;
                takerAsset = this.config.quoteToken;
                takingAmount = this.calculateQuoteAmount(makingAmount.toBigInt(), targetPrice);
            }
            else {
                // Buying base token with quote token
                makerAsset = this.config.quoteToken;
                takerAsset = this.config.baseToken;
                takingAmount = this.calculateBaseAmount(makingAmount.toBigInt(), targetPrice);
            }
            // Set long expiration (1 month)
            const expirationTimestamp = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);
            const UINT_40_MAX = (1n << 40n) - 1n;
            // Create maker traits with proper expiration and nonce
            const makerTraits = limit_order_sdk_1.MakerTraits.default()
                .withExpiration(BigInt(expirationTimestamp))
                .withNonce((0, limit_order_sdk_1.randBigInt)(UINT_40_MAX))
                .allowPartialFills()
                .allowMultipleFills();
            // Create limit order using 1inch SDK
            const limitOrder = new limit_order_sdk_1.LimitOrder({
                makerAsset: new limit_order_sdk_1.Address(makerAsset),
                takerAsset: new limit_order_sdk_1.Address(takerAsset),
                makingAmount: makingAmount.toBigInt(),
                takingAmount: takingAmount,
                maker: new limit_order_sdk_1.Address(walletAddress),
                salt: (0, limit_order_sdk_1.randBigInt)(2n ** 256n - 1n), // Random salt
                receiver: new limit_order_sdk_1.Address(walletAddress)
            }, makerTraits);
            // Get typed data for signing
            const typedData = limitOrder.getTypedData(CHAIN_ID);
            // Sign the order using EIP-712
            const signature = await this.signer._signTypedData(typedData.domain, { Order: typedData.types.Order }, typedData.message);
            // Get order hash
            const orderHash = limitOrder.getOrderHash(CHAIN_ID);
            // Helper function to safely convert to string
            const safeToString = (value) => {
                if (typeof value === 'bigint') {
                    return value.toString();
                }
                if (value && typeof value.toString === 'function') {
                    return value.toString();
                }
                return String(value);
            };
            const orderData = {
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
                status: types_1.OrderStatus.ACTIVE,
                createdAt: new Date(),
                expiresAt: new Date(expirationTimestamp * 1000),
                remainingMakingAmount: makingAmount.toBigInt(),
                gridType: orderType,
                gridLevel,
                triggerPrice: targetPrice,
                limitOrderInstance: limitOrder // Store the original instance
            };
            return orderData;
        }
        catch (error) {
            console.error('❌ Error creating grid order:', error);
            return null;
        }
    }
    /**
     * Execute the volatility grid strategy
     */
    async executeGridStrategy() {
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
        }
        catch (error) {
            console.error('❌ Grid strategy execution failed:', error.message);
        }
        finally {
            this.isRunning = false;
        }
    }
    /**
     * Monitor grid execution and handle rebalancing
     */
    async monitorGridExecution() {
        console.log('\n🔍 Grid Monitoring Active');
        console.log('Press Ctrl+C to stop monitoring\n');
        const monitoringInterval = setInterval(async () => {
            try {
                await this.checkOrderFills();
                await this.handleRebalancing();
                await this.displayGridStatus();
            }
            catch (error) {
                console.error('❌ Monitoring error:', error.message);
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
    async checkOrderFills() {
        for (const [orderHash, orderData] of this.activeOrders) {
            if (orderData.status !== types_1.OrderStatus.ACTIVE)
                continue;
            try {
                const status = await this.getOrderStatus(orderHash);
                if (status) {
                    const fillableBalance = status.fillableBalance || '0';
                    const remainingAmount = ethers_1.ethers.BigNumber.from(fillableBalance);
                    if (remainingAmount.isZero()) {
                        // Order completely filled
                        orderData.status = types_1.OrderStatus.FILLED;
                        this.filledOrders.set(orderHash, orderData);
                        this.activeOrders.delete(orderHash);
                        console.log(`✅ Grid order filled: ${orderData.gridType} at level ${orderData.gridLevel}`);
                        // Create opposite order if auto-rebalance is enabled
                        if (this.config.autoRebalance) {
                            await this.createOppositeOrder(orderData);
                        }
                        // Calculate profit
                        this.calculateProfit(orderData);
                    }
                    else if (remainingAmount.lt(orderData.remainingMakingAmount || 0)) {
                        // Partially filled
                        orderData.status = types_1.OrderStatus.PARTIALLY_FILLED;
                        orderData.remainingMakingAmount = remainingAmount.toBigInt();
                    }
                }
            }
            catch (error) {
                console.log(`⚠️ Could not check status for grid order ${orderData.gridLevel}`);
            }
        }
    }
    /**
     * Create opposite order when a grid order fills
     */
    async createOppositeOrder(filledOrder) {
        try {
            const gridLevel = this.gridLevels.get(filledOrder.gridLevel);
            if (!gridLevel)
                return;
            let newOrderType;
            let newTargetPrice;
            let newAmount;
            if (filledOrder.gridType === GridOrderType.BUY) {
                // If buy order filled, create sell order at higher price
                newOrderType = GridOrderType.SELL;
                newTargetPrice = gridLevel.sellPrice;
                // Use the base tokens we just bought
                newAmount = ethers_1.ethers.utils.parseUnits(ethers_1.ethers.utils.formatUnits(filledOrder.remainingMakingAmount || 0, this.config.quoteTokenDecimals), this.config.baseTokenDecimals);
            }
            else {
                // If sell order filled, create buy order at lower price  
                newOrderType = GridOrderType.BUY;
                newTargetPrice = gridLevel.buyPrice;
                // Use the quote tokens we just received
                newAmount = ethers_1.ethers.utils.parseUnits(ethers_1.ethers.utils.formatUnits(filledOrder.remainingMakingAmount || 0, this.config.baseTokenDecimals), this.config.quoteTokenDecimals);
            }
            console.log(`🔄 Creating opposite ${newOrderType.toLowerCase()} order at level ${filledOrder.gridLevel}`);
            const newOrder = await this.createSingleGridOrder(newAmount, newOrderType, filledOrder.gridLevel, newTargetPrice);
            if (newOrder) {
                this.activeOrders.set(newOrder.orderHash, newOrder);
                await this.submitSingleOrder(newOrder);
                console.log(`✅ Opposite order created: ${newOrderType} at ${newTargetPrice.toFixed(6)}`);
            }
        }
        catch (error) {
            console.error('❌ Failed to create opposite order:', error.message);
        }
    }
    /**
     * Handle rebalancing logic
     */
    async handleRebalancing() {
        if (!this.config.autoRebalance)
            return;
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
    async rebalanceGrid() {
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
        }
        catch (error) {
            console.error('❌ Grid rebalancing failed:', error.message);
        }
    }
    /**
     * Calculate profit from filled order
     */
    calculateProfit(filledOrder) {
        // Simple profit calculation - this could be enhanced
        const orderValue = Number(ethers_1.ethers.utils.formatUnits(filledOrder.remainingMakingAmount || 0, filledOrder.gridType === GridOrderType.SELL ? this.config.baseTokenDecimals : this.config.quoteTokenDecimals));
        const estimatedProfit = orderValue * (this.config.profitTarget / 100);
        this.profits += estimatedProfit;
        console.log(`💰 Estimated profit from trade: $${estimatedProfit.toFixed(4)} (Total: $${this.profits.toFixed(4)})`);
    }
    /**
     * Display current grid status
     */
    async displayGridStatus() {
        const currentTime = new Date().toLocaleTimeString();
        const activeCount = this.activeOrders.size;
        const filledCount = this.filledOrders.size;
        const totalOrders = activeCount + filledCount;
        console.log(`📊 Grid Status [${currentTime}]: ${activeCount} active, ${filledCount} filled (${totalOrders} total) | Profit: ${this.profits.toFixed(4)}`);
    }
    /**
     * Ensure sufficient token approvals for both tokens
     */
    async ensureTokenApprovals() {
        console.log('🔐 Checking token approvals...');
        const walletAddress = await this.signer.getAddress();
        // Approve base token
        const baseTokenContract = new ethers_1.ethers.Contract(this.config.baseToken, ERC20_ABI, this.signer);
        const baseAmount = ethers_1.ethers.utils.parseUnits(this.config.baseAmount, this.config.baseTokenDecimals);
        const baseAllowance = await baseTokenContract.allowance(walletAddress, LIMIT_ORDER_PROTOCOL_ADDRESS);
        if (baseAllowance.lt(baseAmount)) {
            console.log(`📝 Approving ${this.config.baseTokenSymbol} for 1inch protocol...`);
            const approveTx = await baseTokenContract.approve(LIMIT_ORDER_PROTOCOL_ADDRESS, baseAmount);
            await approveTx.wait();
            console.log(`✅ ${this.config.baseTokenSymbol} approval confirmed`);
        }
        // Approve quote token
        const quoteTokenContract = new ethers_1.ethers.Contract(this.config.quoteToken, ERC20_ABI, this.signer);
        const quoteAmount = ethers_1.ethers.utils.parseUnits(this.config.quoteAmount, this.config.quoteTokenDecimals);
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
    async submitOrdersToProtocol() {
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
    async submitSingleOrder(orderData) {
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
                limitOrder = new limit_order_sdk_1.LimitOrder({
                    makerAsset: new limit_order_sdk_1.Address(orderData.order.makerAsset),
                    takerAsset: new limit_order_sdk_1.Address(orderData.order.takerAsset),
                    makingAmount: BigInt(orderData.order.makingAmount),
                    takingAmount: BigInt(orderData.order.takingAmount),
                    maker: new limit_order_sdk_1.Address(orderData.order.maker),
                    salt: BigInt(orderData.order.salt),
                    receiver: new limit_order_sdk_1.Address(orderData.order.receiver)
                }, new limit_order_sdk_1.MakerTraits(BigInt(orderData.order.makerTraits)));
            }
            else {
                console.log(`🚀 Using stored limit order instance for ${orderData.gridType} order`);
            }
            // Submit using SDK method
            await this.oneInchApi.submitOrder(limitOrder, orderData.signature);
            console.log(`✅ ${orderData.gridType} order submitted at level ${orderData.gridLevel}`);
            return true;
        }
        catch (error) {
            console.error(`❌ Submit error for ${orderData.gridType} order:`, error.response?.data || error.message);
            return false;
        }
    }
    /**
     * Get current price using 1inch API
     */
    async getCurrentPrice() {
        try {
            console.log('📊 Fetching current price from 1inch API...');
            const response = await axios_1.default.get(`${(0, types_1.SWAP_API_BASE)(CHAIN_ID)}/quote`, {
                params: {
                    src: this.config.baseToken,
                    dst: this.config.quoteToken,
                    amount: ethers_1.ethers.utils.parseUnits('1', this.config.baseTokenDecimals).toString()
                },
                headers: {
                    'Authorization': `Bearer ${ONEINCH_API_KEY}`,
                    'accept': 'application/json'
                }
            });
            const dstAmount = response.data.dstAmount;
            const price = Number(ethers_1.ethers.utils.formatUnits(dstAmount, this.config.quoteTokenDecimals));
            console.log(`💰 Current price: 1 ${this.config.baseTokenSymbol} = ${price.toFixed(6)} ${this.config.quoteTokenSymbol}`);
            return price;
        }
        catch (error) {
            console.warn('⚠️ Failed to fetch current price, using fallback');
            return 1.0; // Fallback price
        }
    }
    /**
     * Calculate quote amount from base amount and price
     */
    calculateQuoteAmount(baseAmount, price) {
        const baseAmountReadable = Number(ethers_1.ethers.utils.formatUnits(baseAmount.toString(), this.config.baseTokenDecimals));
        const quoteAmountReadable = baseAmountReadable * price;
        const quoteAmountWithSlippage = quoteAmountReadable * (1 - this.config.slippageTolerance / 100);
        return ethers_1.ethers.utils.parseUnits(quoteAmountWithSlippage.toFixed(this.config.quoteTokenDecimals), this.config.quoteTokenDecimals).toBigInt();
    }
    /**
     * Calculate base amount from quote amount and price
     */
    calculateBaseAmount(quoteAmount, price) {
        const quoteAmountReadable = Number(ethers_1.ethers.utils.formatUnits(quoteAmount.toString(), this.config.quoteTokenDecimals));
        const baseAmountReadable = quoteAmountReadable / price;
        const baseAmountWithSlippage = baseAmountReadable * (1 - this.config.slippageTolerance / 100);
        return ethers_1.ethers.utils.parseUnits(baseAmountWithSlippage.toFixed(this.config.baseTokenDecimals), this.config.baseTokenDecimals).toBigInt();
    }
    /**
     * Get order status from 1inch API
     */
    async getOrderStatus(orderHash) {
        try {
            const response = await axios_1.default.get(`${(0, types_1.LIMIT_ORDER_API_BASE)(CHAIN_ID)}/order/${orderHash}`, {
                headers: {
                    'Authorization': `Bearer ${ONEINCH_API_KEY}`,
                    'accept': 'application/json'
                }
            });
            return response.data;
        }
        catch (error) {
            return null;
        }
    }
    /**
     * Cancel all active orders
     */
    async cancelAllOrders() {
        console.log('🚫 Cancelling all active grid orders...');
        let cancelledCount = 0;
        for (const [orderHash, orderData] of this.activeOrders) {
            try {
                await axios_1.default.delete(`${(0, types_1.LIMIT_ORDER_API_BASE)(CHAIN_ID)}/order/${orderHash}`, {
                    headers: {
                        'Authorization': `Bearer ${ONEINCH_API_KEY}`
                    }
                });
                orderData.status = types_1.OrderStatus.CANCELLED;
                cancelledCount++;
            }
            catch (error) {
                console.error(`❌ Failed to cancel order ${orderHash.slice(0, 10)}...`);
            }
        }
        this.activeOrders.clear();
        console.log(`✅ Cancelled ${cancelledCount} orders`);
    }
    /**
     * Get all active grid orders
     */
    getActiveOrders() {
        return Array.from(this.activeOrders.values());
    }
    /**
     * Get grid strategy statistics
     */
    getGridStats() {
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
    async emergencyStop() {
        console.log('🚨 Emergency stop activated!');
        this.isRunning = false;
        await this.cancelAllOrders();
        console.log('🛑 All orders cancelled, strategy stopped');
    }
    /**
     * Get detailed grid status
     */
    async getDetailedStatus() {
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
        const successfulTrades = filledOrdersArray.filter(o => o.status === types_1.OrderStatus.FILLED).length;
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
exports.VolatilityGridStrategy = VolatilityGridStrategy;
//# sourceMappingURL=grid.js.map