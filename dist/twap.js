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
exports.TWAPStrategy = void 0;
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
class TWAPStrategy {
    constructor(provider, signer) {
        this.strategyConfig = null;
        this.executionSchedule = new Map();
        this.isExecuting = false;
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
        this.strategyConfig = config;
        // Convert StrategyConfig to internal TWAPConfig format
        this.config = {
            fromToken: config.fromToken.address,
            toToken: config.toToken.address,
            totalAmount: config.totalAmount,
            numberOfOrders: config.numberOfOrders,
            intervalMinutes: config.intervalHours ? config.intervalHours * 60 : 60, // Default 1 hour
            executionWindow: 30, // 30 minutes execution window per order
            slippageTolerance: config.slippageTolerance,
            gasPrice: config.gasPrice || 'auto',
            fromTokenDecimals: config.fromToken.decimals,
            toTokenDecimals: config.toToken.decimals,
            fromTokenSymbol: config.fromToken.symbol,
            toTokenSymbol: config.toToken.symbol,
            startTime: new Date(),
            maxExecutionTime: config.intervalHours ? config.intervalHours * config.numberOfOrders : 24 // Default 24 hours
        };
        this.generateExecutionSchedule();
    }
    /**
     * Initialize the TWAP strategy
     */
    async initialize() {
        console.log('🌈 1inch TWAP (Time-Weighted Average Price) Strategy');
        console.log('==================================================\n');
        await this.getUserConfiguration();
        await this.validateConfiguration();
        console.log('\n✅ TWAP Configuration validated successfully!');
        console.log('\n📋 TWAP Strategy Summary:');
        console.log(`  📊 Total Orders: ${this.config.numberOfOrders}`);
        console.log(`  💰 Amount per Order: ${(parseFloat(this.config.totalAmount) / this.config.numberOfOrders).toFixed(6)} ${this.config.fromTokenSymbol}`);
        console.log(`  ⏱️  Interval: ${this.config.intervalMinutes} minutes`);
        console.log(`  🎯 Execution Window: ${this.config.executionWindow} minutes per order`);
        console.log(`  🕐 Total Duration: ${this.config.maxExecutionTime} hours`);
        console.log(`  📈 Slippage Tolerance: ${this.config.slippageTolerance}%`);
    }
    /**
     * Generate execution schedule for TWAP orders
     */
    generateExecutionSchedule() {
        const startTime = this.config.startTime || new Date();
        this.executionSchedule.clear();
        for (let i = 0; i < this.config.numberOfOrders; i++) {
            const executionTime = new Date(startTime.getTime() + (i * this.config.intervalMinutes * 60 * 1000));
            this.executionSchedule.set(i, executionTime);
        }
        console.log('\n📅 TWAP Execution Schedule:');
        this.executionSchedule.forEach((time, index) => {
            console.log(`  Order ${index + 1}: ${time.toLocaleString()}`);
        });
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
            console.log('📝 TWAP Strategy Configuration');
            console.log('===============================\n');
            // Token Configuration
            const fromToken = await question('From Token Address (or press enter for 1INCH): ') ||
                process.env.DEFAULT_FROM_TOKEN || '0xc5fecC3a29Fb57B5024eEc8a2239d4621e111CBE';
            const toToken = await question('To Token Address (or press enter for USDC): ') ||
                process.env.DEFAULT_TO_TOKEN || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
            this.config.fromToken = fromToken;
            this.config.toToken = toToken;
            // Get token information
            const [fromTokenInfo, toTokenInfo] = await Promise.all([
                this.getTokenInfo(fromToken),
                this.getTokenInfo(toToken)
            ]);
            this.config.fromTokenDecimals = fromTokenInfo.decimals;
            this.config.toTokenDecimals = toTokenInfo.decimals;
            this.config.fromTokenSymbol = fromTokenInfo.symbol;
            this.config.toTokenSymbol = toTokenInfo.symbol;
            console.log(`\n🔄 Trading pair: ${this.config.fromTokenSymbol} → ${this.config.toTokenSymbol}`);
            // TWAP-specific configuration
            this.config.totalAmount = await question('Total Amount to Trade: ');
            this.config.numberOfOrders = parseInt(await question('Number of Orders (e.g., 5): '));
            this.config.intervalMinutes = parseInt(await question('Interval between orders (minutes, e.g., 60 for 1 hour): '));
            this.config.executionWindow = parseInt(await question('Execution window per order (minutes, e.g., 30): ') || '30');
            // Calculate total duration
            this.config.maxExecutionTime = (this.config.numberOfOrders * this.config.intervalMinutes) / 60;
            // Additional parameters
            const slippageInput = await question('Slippage Tolerance % (e.g., 1 for 1%): ');
            this.config.slippageTolerance = parseFloat(slippageInput || '1');
            const gasPriceInput = await question('Gas Price (gwei, press enter for auto): ');
            this.config.gasPrice = gasPriceInput || 'auto';
            // Set start time
            const startTimeInput = await question('Start time (enter for immediate, or HH:MM for today): ');
            if (startTimeInput) {
                const [hours, minutes] = startTimeInput.split(':').map(n => parseInt(n));
                const startTime = new Date();
                startTime.setHours(hours, minutes, 0, 0);
                if (startTime <= new Date()) {
                    startTime.setDate(startTime.getDate() + 1); // Next day if time has passed
                }
                this.config.startTime = startTime;
            }
            else {
                this.config.startTime = new Date();
            }
        }
        finally {
            rl.close();
        }
        this.generateExecutionSchedule();
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
            if (!ethers_1.ethers.utils.isAddress(this.config.fromToken)) {
                errors.push('Invalid from token address');
            }
            if (!ethers_1.ethers.utils.isAddress(this.config.toToken)) {
                errors.push('Invalid to token address');
            }
            // Validate amounts and numbers
            if (parseFloat(this.config.totalAmount) <= 0) {
                errors.push('Total amount must be greater than 0');
            }
            if (this.config.numberOfOrders <= 0) {
                errors.push('Number of orders must be greater than 0');
            }
            if (this.config.intervalMinutes <= 0) {
                errors.push('Interval must be greater than 0 minutes');
            }
            // Check wallet balance
            const walletAddress = await this.signer.getAddress();
            const tokenContract = new ethers_1.ethers.Contract(this.config.fromToken, ERC20_ABI, this.provider);
            const balance = await tokenContract.balanceOf(walletAddress);
            const balanceFormatted = Number(ethers_1.ethers.utils.formatUnits(balance, this.config.fromTokenDecimals));
            const requiredAmount = parseFloat(this.config.totalAmount);
            if (balanceFormatted < requiredAmount) {
                errors.push(`Insufficient balance. Required: ${requiredAmount}, Available: ${balanceFormatted.toFixed(6)}`);
            }
            // TWAP-specific validations
            if (this.config.executionWindow >= this.config.intervalMinutes) {
                warnings.push('Execution window is larger than interval - orders may overlap');
            }
            if (this.config.numberOfOrders > 50) {
                warnings.push('Large number of orders may result in high gas costs');
            }
            if (this.config.intervalMinutes < 5) {
                warnings.push('Very short intervals may hit API rate limits');
            }
            console.log(`✅ Balance check: ${balanceFormatted.toFixed(6)} ${this.config.fromTokenSymbol} available`);
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
     * Create TWAP orders using 1inch SDK
     */
    async createTWAPOrders() {
        console.log('\n🚀 Creating TWAP orders...');
        const orders = [];
        const orderAmount = ethers_1.ethers.utils.parseUnits((parseFloat(this.config.totalAmount) / this.config.numberOfOrders).toString(), this.config.fromTokenDecimals);
        // Ensure token approval
        await this.ensureTokenApproval(ethers_1.ethers.utils.parseUnits(this.config.totalAmount, this.config.fromTokenDecimals));
        for (let i = 0; i < this.config.numberOfOrders; i++) {
            try {
                console.log(`\n📋 Creating order ${i + 1}/${this.config.numberOfOrders}...`);
                const executionTime = this.executionSchedule.get(i);
                const expirationTime = new Date(executionTime.getTime() + (this.config.executionWindow * 60 * 1000));
                const orderData = await this.createSingleTWAPOrder(orderAmount, i, executionTime, expirationTime);
                if (orderData) {
                    orders.push(orderData);
                    this.activeOrders.set(orderData.orderHash, orderData);
                    console.log(`✅ Order ${i + 1} created successfully`);
                    console.log(`   📊 Order Hash: ${orderData.orderHash.slice(0, 10)}...`);
                    console.log(`   ⏰ Execution: ${executionTime.toLocaleString()}`);
                    console.log(`   ⏳ Expires: ${expirationTime.toLocaleString()}`);
                }
                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            catch (error) {
                console.error(`❌ Failed to create order ${i + 1}:`, error.message);
            }
        }
        console.log(`\n🎉 Created ${orders.length}/${this.config.numberOfOrders} TWAP orders successfully!`);
        return orders;
    }
    /**
     * Create a single TWAP order
     */
    async createSingleTWAPOrder(makingAmount, orderIndex, executionTime, expirationTime) {
        try {
            // Get current market price for reference
            const currentPrice = await this.getCurrentPrice();
            // For TWAP, we use market price with slippage tolerance
            const targetPrice = currentPrice * (1 - this.config.slippageTolerance / 100);
            const takingAmount = this.calculateTakingAmountBigInt(makingAmount.toBigInt(), targetPrice);
            // Create limit order using 1inch SDK
            const walletAddress = await this.signer.getAddress();
            // Generate order with time-based execution
            const orderBuilder = this.oneInchApi.limitOrderBuilder();
            const limitOrder = orderBuilder.buildLimitOrder({
                makerAsset: this.config.fromToken,
                takerAsset: this.config.toToken,
                makingAmount: makingAmount.toBigInt(),
                takingAmount: takingAmount,
                maker: walletAddress,
            });
            // Set expiration time
            const expirationTimestamp = Math.floor(expirationTime.getTime() / 1000);
            limitOrder.setExpiration(expirationTimestamp);
            // Build the order
            const limitOrderTypedData = limitOrder.build();
            // Sign the order
            const signature = await limitOrder.sign(this.signer);
            const orderData = {
                order: limitOrderTypedData.message,
                orderHash: limitOrder.getOrderHash(limitOrderTypedData.message),
                signature,
                targetPrice,
                orderIndex,
                status: types_1.OrderStatus.ACTIVE,
                createdAt: new Date(),
                expiresAt: expirationTime,
                remainingMakingAmount: makingAmount.toBigInt()
            };
            return orderData;
        }
        catch (error) {
            console.error('❌ Error creating TWAP order:', error);
            // Provide helpful error messages
            if (error.message.includes('insufficient')) {
                console.log('💡 Insufficient balance or allowance detected.');
                console.log('🔄 You may need to manually approve tokens at https://app.1inch.io/');
            }
            else if (error.message.includes('API') || error.message.includes('rate')) {
                console.log('💡 API issue detected.');
                console.log('🔑 Check your 1inch API key and rate limits.');
            }
            return null;
        }
    }
    /**
     * Execute TWAP strategy with automatic scheduling
     */
    async executeTWAPStrategy() {
        console.log('\n🚀 Starting TWAP Strategy Execution...');
        console.log('======================================');
        if (this.isExecuting) {
            console.log('⚠️ TWAP strategy is already executing');
            return;
        }
        this.isExecuting = true;
        try {
            // Create all orders first
            const orders = await this.createTWAPOrders();
            if (orders.length === 0) {
                console.log('❌ No orders created. TWAP strategy cannot proceed.');
                return;
            }
            // Submit orders to 1inch protocol
            console.log('\n📤 Submitting orders to 1inch protocol...');
            await this.submitOrdersToProtocol();
            // Start monitoring and execution
            console.log('\n👀 Starting TWAP monitoring...');
            await this.monitorTWAPExecution();
        }
        catch (error) {
            console.error('❌ TWAP strategy execution failed:', error.message);
        }
        finally {
            this.isExecuting = false;
        }
    }
    /**
     * Monitor TWAP execution progress
     */
    async monitorTWAPExecution() {
        console.log('\n🔍 TWAP Monitoring Active');
        console.log('Press Ctrl+C to stop monitoring\n');
        const monitoringInterval = setInterval(async () => {
            try {
                await this.checkExecutionStatus();
                await this.handleOrderExpirations();
                // Check if all orders are complete
                const activeOrdersCount = Array.from(this.activeOrders.values())
                    .filter(order => order.status === types_1.OrderStatus.ACTIVE).length;
                if (activeOrdersCount === 0) {
                    console.log('\n🎉 TWAP strategy completed! All orders filled or expired.');
                    clearInterval(monitoringInterval);
                    this.isExecuting = false;
                }
            }
            catch (error) {
                console.error('❌ Monitoring error:', error.message);
            }
        }, 30000); // Check every 30 seconds
        // Stop monitoring after max execution time
        setTimeout(() => {
            clearInterval(monitoringInterval);
            console.log('\n⏰ Maximum execution time reached. Stopping TWAP monitoring.');
            this.isExecuting = false;
        }, this.config.maxExecutionTime * 60 * 60 * 1000);
    }
    /**
     * Check execution status of all orders
     */
    async checkExecutionStatus() {
        console.log(`📊 Status check: ${new Date().toLocaleTimeString()}`);
        for (const [orderHash, orderData] of this.activeOrders) {
            if (orderData.status !== types_1.OrderStatus.ACTIVE)
                continue;
            try {
                const status = await this.getOrderStatus(orderHash);
                if (status) {
                    const fillableBalance = status.fillableBalance || '0';
                    const remainingAmount = ethers_1.ethers.BigNumber.from(fillableBalance);
                    if (remainingAmount.isZero()) {
                        orderData.status = types_1.OrderStatus.FILLED;
                        console.log(`✅ Order ${orderData.orderIndex + 1} filled completely!`);
                    }
                    else if (remainingAmount.lt(orderData.remainingMakingAmount || 0)) {
                        orderData.status = types_1.OrderStatus.PARTIALLY_FILLED;
                        orderData.remainingMakingAmount = remainingAmount.toBigInt();
                        console.log(`🔄 Order ${orderData.orderIndex + 1} partially filled`);
                    }
                }
            }
            catch (error) {
                console.log(`⚠️ Could not check status for order ${orderData.orderIndex + 1}`);
            }
        }
    }
    /**
     * Handle order expirations
     */
    async handleOrderExpirations() {
        const now = new Date();
        for (const [orderHash, orderData] of this.activeOrders) {
            if (orderData.status === types_1.OrderStatus.ACTIVE && orderData.expiresAt <= now) {
                orderData.status = types_1.OrderStatus.EXPIRED;
                console.log(`⏰ Order ${orderData.orderIndex + 1} expired`);
            }
        }
    }
    /**
     * Ensure sufficient token approval for 1inch protocol
     */
    async ensureTokenApproval(amount) {
        console.log('🔐 Checking token approval...');
        const walletAddress = await this.signer.getAddress();
        const tokenContract = new ethers_1.ethers.Contract(this.config.fromToken, ERC20_ABI, this.signer);
        const currentAllowance = await tokenContract.allowance(walletAddress, LIMIT_ORDER_PROTOCOL_ADDRESS);
        if (currentAllowance.lt(amount)) {
            console.log('📝 Approving tokens for 1inch protocol...');
            const approveTx = await tokenContract.approve(LIMIT_ORDER_PROTOCOL_ADDRESS, amount);
            await approveTx.wait();
            console.log('✅ Token approval confirmed');
        }
        else {
            console.log('✅ Token approval sufficient');
        }
    }
    /**
     * Submit orders to 1inch protocol
     */
    async submitOrdersToProtocol() {
        let successCount = 0;
        for (const [orderHash, orderData] of this.activeOrders) {
            try {
                const response = await axios_1.default.post(`${(0, types_1.LIMIT_ORDER_API_BASE)(CHAIN_ID)}/order`, {
                    orderHash: orderData.orderHash,
                    signature: orderData.signature,
                    data: orderData.order
                }, {
                    headers: {
                        'Authorization': `Bearer ${ONEINCH_API_KEY}`,
                        'Content-Type': 'application/json'
                    }
                });
                if (response.data.success) {
                    successCount++;
                    console.log(`✅ Order ${orderData.orderIndex + 1} submitted to 1inch`);
                }
                else {
                    console.log(`❌ Failed to submit order ${orderData.orderIndex + 1}`);
                }
            }
            catch (error) {
                console.error(`❌ Submit error for order ${orderData.orderIndex + 1}:`, error.response?.data || error.message);
            }
        }
        console.log(`\n📤 Successfully submitted ${successCount}/${this.activeOrders.size} orders to 1inch protocol`);
    }
    /**
     * Get current price using 1inch API
     */
    async getCurrentPrice() {
        try {
            const response = await axios_1.default.get(`${(0, types_1.SWAP_API_BASE)(CHAIN_ID)}/quote`, {
                params: {
                    src: this.config.fromToken,
                    dst: this.config.toToken,
                    amount: ethers_1.ethers.utils.parseUnits('1', this.config.fromTokenDecimals).toString()
                },
                headers: {
                    'Authorization': `Bearer ${ONEINCH_API_KEY}`,
                    'accept': 'application/json'
                }
            });
            const dstAmount = response.data.dstAmount;
            const price = Number(ethers_1.ethers.utils.formatUnits(dstAmount, this.config.toTokenDecimals));
            return price;
        }
        catch (error) {
            console.warn('⚠️ Failed to fetch current price, using fallback');
            return 0.5; // Fallback price
        }
    }
    /**
     * Calculate taking amount based on price and slippage
     */
    calculateTakingAmountBigInt(makingAmount, targetPrice) {
        const makingAmountReadable = Number(ethers_1.ethers.utils.formatUnits(makingAmount.toString(), this.config.fromTokenDecimals));
        const baseTakingAmount = makingAmountReadable / targetPrice;
        const takingAmountWithSlippage = baseTakingAmount * (1 - this.config.slippageTolerance / 100);
        return ethers_1.ethers.utils.parseUnits(takingAmountWithSlippage.toFixed(this.config.toTokenDecimals), this.config.toTokenDecimals).toBigInt();
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
     * Get all active orders
     */
    getActiveOrders() {
        return Array.from(this.activeOrders.values());
    }
    /**
     * Cancel a specific order
     */
    async cancelOrder(orderHash) {
        try {
            await axios_1.default.delete(`${(0, types_1.LIMIT_ORDER_API_BASE)(CHAIN_ID)}/order/${orderHash}`, {
                headers: {
                    'Authorization': `Bearer ${ONEINCH_API_KEY}`
                }
            });
            const orderData = this.activeOrders.get(orderHash);
            if (orderData) {
                orderData.status = types_1.OrderStatus.CANCELLED;
            }
            return true;
        }
        catch (error) {
            console.error('❌ Failed to cancel order:', error.message);
            return false;
        }
    }
    /**
     * Get strategy statistics
     */
    getStrategyStats() {
        const orders = Array.from(this.activeOrders.values());
        const stats = {
            totalOrders: orders.length,
            activeOrders: orders.filter(o => o.status === types_1.OrderStatus.ACTIVE).length,
            filledOrders: orders.filter(o => o.status === types_1.OrderStatus.FILLED).length,
            expiredOrders: orders.filter(o => o.status === types_1.OrderStatus.EXPIRED).length,
            cancelledOrders: orders.filter(o => o.status === types_1.OrderStatus.CANCELLED).length,
            averageOrderSize: (parseFloat(this.config.totalAmount) / this.config.numberOfOrders).toFixed(6)
        };
        // Find next execution time
        const now = new Date();
        const nextExecution = Array.from(this.executionSchedule.values())
            .find(time => time > now);
        return {
            ...stats,
            nextExecutionTime: nextExecution
        };
    }
}
exports.TWAPStrategy = TWAPStrategy;
//# sourceMappingURL=twap.js.map