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
exports.HodlLadderDCA = void 0;
const ethers_1 = require("ethers");
const axios_1 = __importDefault(require("axios"));
const readline_1 = __importDefault(require("readline"));
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
class HodlLadderDCA {
    constructor(provider, signer) {
        this.strategyConfig = null;
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
        // Convert StrategyConfig to internal Config format
        this.config = {
            fromToken: config.fromToken.address,
            toToken: config.toToken.address,
            totalAmount: config.totalAmount,
            numberOfOrders: config.numberOfOrders,
            strategyType: config.strategyType,
            priceDropPercent: config.priceDropPercent,
            priceRisePercent: config.priceRisePercent,
            buyPercent: config.buyPercent,
            intervalHours: config.intervalHours,
            slippageTolerance: config.slippageTolerance,
            gasPrice: config.gasPrice || 'auto',
            fromTokenDecimals: config.fromToken.decimals,
            toTokenDecimals: config.toToken.decimals,
            fromTokenSymbol: config.fromToken.symbol,
            toTokenSymbol: config.toToken.symbol
        };
    }
    /**
     * Initialize the DCA Hodl Ladder strategy
     */
    async initialize() {
        console.log('🌈 1inch DCA Hodl Ladder Strategy');
        console.log('==================================\\n');
        await this.getUserConfiguration();
        await this.validateConfiguration();
        console.log('\\n✅ Configuration validated successfully!');
    }
    /**
     * Get Base mainnet tokens
     */
    getBaseTokens() {
        return {
            // Base mainnet tokens
            '1INCH': process.env.DEFAULT_FROM_TOKEN || '0xc5fecC3a29Fb57B5024eEc8a2239d4621e111CBE',
            'USDC': process.env.DEFAULT_TO_TOKEN || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            'WETH': '0x4200000000000000000000000000000000000006',
            'cbETH': '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22',
            'DAI': '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb'
        };
    }
    /**
     * Get suggested token pairs for Base mainnet
     */
    suggestTokenPairs() {
        const tokens = this.getBaseTokens();
        console.log('\\n💡 Available token addresses on Base mainnet:');
        Object.entries(tokens).forEach(([symbol, address]) => {
            console.log(`${symbol}: ${address}`);
        });
        console.log('\\n📝 Recommended: 1INCH → USDC for DCA strategy\\n');
    }
    /**
     * Get user configuration through CLI prompts
     */
    async getUserConfiguration() {
        const rl = readline_1.default.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));
        try {
            // Show suggested tokens for Base
            this.suggestTokenPairs();
            // Basic strategy parameters
            this.config.fromToken = await question('From Token Address (default 1INCH): ') || process.env.DEFAULT_FROM_TOKEN || '0xc5fecC3a29Fb57B5024eEc8a2239d4621e111CBE';
            this.config.toToken = await question('To Token Address (default USDC): ') || process.env.DEFAULT_TO_TOKEN || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
            this.config.totalAmount = await question('Total Amount to Invest (default 20): ') || process.env.DEFAULT_TOTAL_AMOUNT || '20';
            this.config.numberOfOrders = parseInt(await question('Number of DCA Orders (default 5): ') || process.env.DEFAULT_NUMBER_OF_ORDERS || '5');
            // Strategy type selection
            console.log('\\nStrategy Types:');
            console.log('1. Price Drop DCA (buy more when price drops)');
            console.log('2. Price Rise DCA (buy when price increases)');
            console.log('3. Time-based DCA (regular intervals)');
            const strategyType = await question('Select Strategy Type (1-3): ');
            this.config.strategyType = parseInt(strategyType);
            // Configure based on strategy type
            if (this.config.strategyType === 1) {
                this.config.priceDropPercent = parseFloat(await question('Price Drop % to trigger buy (e.g., 5 for 5%): '));
                this.config.buyPercent = parseFloat(await question('% of remaining funds to buy (e.g., 20 for 20%): '));
            }
            else if (this.config.strategyType === 2) {
                this.config.priceRisePercent = parseFloat(await question('Price Rise % to trigger buy (e.g., 10 for 10%): '));
                this.config.buyPercent = parseFloat(await question('% of remaining funds to buy (e.g., 15 for 15%): '));
            }
            else {
                this.config.intervalHours = parseInt(await question('Interval in hours: '));
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
            if (!ethers_1.ethers.utils.isAddress(this.config.fromToken) || !ethers_1.ethers.utils.isAddress(this.config.toToken)) {
                errors.push('Invalid token addresses provided');
                return { isValid: false, errors, warnings };
            }
            // Get token info
            const fromTokenContract = new ethers_1.ethers.Contract(this.config.fromToken, ERC20_ABI, this.provider);
            const toTokenContract = new ethers_1.ethers.Contract(this.config.toToken, ERC20_ABI, this.provider);
            this.config.fromTokenDecimals = await fromTokenContract.decimals();
            this.config.toTokenDecimals = await toTokenContract.decimals();
            this.config.fromTokenSymbol = await fromTokenContract.symbol();
            this.config.toTokenSymbol = await toTokenContract.symbol();
            // Check balance
            const balance = await fromTokenContract.balanceOf(await this.signer.getAddress());
            const totalAmountWei = ethers_1.ethers.utils.parseUnits(this.config.totalAmount, this.config.fromTokenDecimals);
            if (balance.lt(totalAmountWei)) {
                errors.push(`Insufficient balance. Required: ${this.config.totalAmount} ${this.config.fromTokenSymbol}`);
                return { isValid: false, errors, warnings };
            }
            // Check allowance
            const allowance = await fromTokenContract.allowance(await this.signer.getAddress(), LIMIT_ORDER_PROTOCOL_ADDRESS);
            if (allowance.lt(totalAmountWei)) {
                warnings.push(`Insufficient allowance. Token approval will be required for ${this.config.totalAmount} ${this.config.fromTokenSymbol}`);
            }
            console.log(`\\n📊 Strategy Summary:`);
            console.log(`From: ${this.config.fromTokenSymbol} (${this.config.fromToken})`);
            console.log(`To: ${this.config.toTokenSymbol} (${this.config.toToken})`);
            console.log(`Total Amount: ${this.config.totalAmount} ${this.config.fromTokenSymbol}`);
            console.log(`Number of Orders: ${this.config.numberOfOrders}`);
            return { isValid: true, errors, warnings };
        }
        catch (error) {
            errors.push(`Validation error: ${error.message}`);
            return { isValid: false, errors, warnings };
        }
    }
    /**
     * Approve token spending
     */
    async approveToken(tokenAddress, amount) {
        const tokenContract = new ethers_1.ethers.Contract(tokenAddress, ERC20_ABI, this.signer);
        console.log('🔄 Approving token spending...');
        const tx = await tokenContract.approve(LIMIT_ORDER_PROTOCOL_ADDRESS, amount);
        await tx.wait();
        console.log('✅ Token approval confirmed');
    }
    /**
     * Create DCA orders based on strategy using 1inch SDK
     */
    async createDCAOrders() {
        console.log('\\n🚀 Creating DCA Orders using 1inch SDK...\\n');
        // Check and handle token approval first
        await this.ensureTokenApproval();
        const orders = [];
        const totalAmountBigInt = ethers_1.ethers.utils.parseUnits(this.config.totalAmount, this.config.fromTokenDecimals).toBigInt();
        const amountPerOrder = totalAmountBigInt / BigInt(this.config.numberOfOrders);
        for (let i = 0; i < this.config.numberOfOrders; i++) {
            const order = await this.createSingleOrderWithSDK(i, amountPerOrder);
            if (order) {
                this.activeOrders.set(order.orderHash, order);
                orders.push(order);
                console.log(`✅ Order ${i + 1}/${this.config.numberOfOrders} created: ${order.orderHash.slice(0, 10)}...`);
            }
        }
        console.log(`\\n🎉 Successfully created ${this.activeOrders.size} DCA orders!`);
        return orders;
    }
    /**
     * Ensure sufficient token approval for 1inch protocol
     */
    async ensureTokenApproval() {
        const tokenContract = new ethers_1.ethers.Contract(this.config.fromToken, ERC20_ABI, this.signer);
        const walletAddress = await this.signer.getAddress();
        const totalAmountWei = ethers_1.ethers.utils.parseUnits(this.config.totalAmount, this.config.fromTokenDecimals);
        console.log('🔍 Checking token approval status...');
        // Check current allowance
        const currentAllowance = await tokenContract.allowance(walletAddress, LIMIT_ORDER_PROTOCOL_ADDRESS);
        console.log(`📊 Current allowance: ${ethers_1.ethers.utils.formatUnits(currentAllowance, this.config.fromTokenDecimals)} ${this.config.fromTokenSymbol}`);
        console.log(`📊 Required amount: ${this.config.totalAmount} ${this.config.fromTokenSymbol}`);
        if (currentAllowance.lt(totalAmountWei)) {
            console.log('\\n⚠️  Insufficient allowance detected!');
            console.log('🔄 Approving tokens for 1inch Limit Order Protocol...');
            try {
                // Approve a larger amount to avoid frequent approvals (2x the required amount)
                const approvalAmount = totalAmountWei.mul(2);
                console.log(`📝 Approving ${ethers_1.ethers.utils.formatUnits(approvalAmount, this.config.fromTokenDecimals)} ${this.config.fromTokenSymbol}...`);
                const approveTx = await tokenContract.approve(LIMIT_ORDER_PROTOCOL_ADDRESS, approvalAmount, {
                    gasLimit: 100000 // Set a reasonable gas limit for approval
                });
                console.log(`⏳ Approval transaction sent: ${approveTx.hash}`);
                console.log('🔄 Waiting for confirmation...');
                const receipt = await approveTx.wait();
                console.log(`✅ Token approval confirmed in block ${receipt.blockNumber}`);
                console.log(`💰 Approved: ${ethers_1.ethers.utils.formatUnits(approvalAmount, this.config.fromTokenDecimals)} ${this.config.fromTokenSymbol}`);
                // Wait a moment for the approval to propagate
                console.log('⏱️  Waiting for approval to propagate...');
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
            catch (error) {
                console.error('❌ Token approval failed:', error.message);
                throw new Error(`Token approval failed: ${error.message}`);
            }
        }
        else {
            console.log('✅ Sufficient token allowance already exists');
        }
    }
    /**
     * Create a single limit order using 1inch SDK
     */
    async createSingleOrderWithSDK(orderIndex, amountPerOrder) {
        try {
            console.log(`\\n🔨 Creating order ${orderIndex + 1}...`);
            const currentPrice = await this.getCurrentPrice();
            const targetPrice = this.calculateTargetPrice(currentPrice, orderIndex);
            console.log(`🎯 Target price for order ${orderIndex + 1}: ${targetPrice.toFixed(6)} ${this.config.toTokenSymbol}`);
            // Calculate taking amount based on target price
            const takingAmount = this.calculateTakingAmountBigInt(amountPerOrder, targetPrice);
            // Create expiration timestamp (30 days from now)
            const expiresIn = 30n * 24n * 60n * 60n; // 30 days in seconds
            const expiration = BigInt(Math.floor(Date.now() / 1000)) + expiresIn;
            // Create maker traits with proper expiration and nonce
            const UINT_40_MAX = (1n << 40n) - 1n;
            const makerTraits = limit_order_sdk_1.MakerTraits.default()
                .withExpiration(expiration)
                .withNonce((0, limit_order_sdk_1.randBigInt)(UINT_40_MAX))
                .allowPartialFills()
                .allowMultipleFills();
            console.log(`📊 Order details:`);
            console.log(`   Making: ${ethers_1.ethers.utils.formatUnits(amountPerOrder.toString(), this.config.fromTokenDecimals)} ${this.config.fromTokenSymbol}`);
            console.log(`   Taking: ${ethers_1.ethers.utils.formatUnits(takingAmount.toString(), this.config.toTokenDecimals)} ${this.config.toTokenSymbol}`);
            console.log(`   Price: ${targetPrice.toFixed(6)} ${this.config.toTokenSymbol} per ${this.config.fromTokenSymbol}`);
            // Create limit order using 1inch SDK
            const limitOrder = new limit_order_sdk_1.LimitOrder({
                makerAsset: new limit_order_sdk_1.Address(this.config.fromToken),
                takerAsset: new limit_order_sdk_1.Address(this.config.toToken),
                makingAmount: amountPerOrder,
                takingAmount: takingAmount,
                maker: new limit_order_sdk_1.Address(await this.signer.getAddress()),
                salt: (0, limit_order_sdk_1.randBigInt)(2n ** 256n - 1n), // Random salt
                receiver: new limit_order_sdk_1.Address(await this.signer.getAddress())
            }, makerTraits);
            // Get typed data for signing
            const typedData = limitOrder.getTypedData(CHAIN_ID);
            console.log(`🔐 Signing order ${orderIndex + 1}...`);
            // Sign the order using EIP-712
            const signature = await this.signer._signTypedData(typedData.domain, { Order: typedData.types.Order }, typedData.message);
            // Get order hash
            const orderHash = limitOrder.getOrderHash(CHAIN_ID);
            console.log(`📤 Submitting order ${orderIndex + 1} to 1inch API...`);
            // Submit order to 1inch API with retry logic
            let retryCount = 0;
            const maxRetries = 3;
            while (retryCount < maxRetries) {
                try {
                    await this.oneInchApi.submitOrder(limitOrder, signature);
                    break; // Success, exit retry loop
                }
                catch (error) {
                    retryCount++;
                    console.log(`⚠️  Attempt ${retryCount} failed: ${error.message}`);
                    if (error.message.includes('allowance')) {
                        console.log('🔄 Allowance issue detected, re-checking approval...');
                        await this.ensureTokenApproval();
                    }
                    if (retryCount < maxRetries) {
                        console.log(`🔄 Retrying in 3 seconds... (${retryCount}/${maxRetries})`);
                        await new Promise(resolve => setTimeout(resolve, 3000));
                    }
                    else {
                        console.error(`❌ Failed to submit order ${orderIndex + 1} to 1inch API after ${maxRetries} attempts`);
                        return null;
                    }
                }
            }
            console.log(`✅ Order ${orderIndex + 1} submitted successfully`);
            // Convert to our internal format
            const orderStruct = {
                salt: limitOrder.salt,
                maker: limitOrder.maker.toString(),
                receiver: limitOrder.receiver?.toString() || limitOrder.maker.toString(),
                makerAsset: limitOrder.makerAsset.toString(),
                takerAsset: limitOrder.takerAsset.toString(),
                makingAmount: limitOrder.makingAmount,
                takingAmount: limitOrder.takingAmount,
                makerTraits: limitOrder.makerTraits.value || limitOrder.makerTraits
            };
            return {
                order: orderStruct,
                orderHash,
                signature,
                targetPrice,
                orderIndex,
                status: types_1.OrderStatus.ACTIVE,
                createdAt: new Date(),
                expiresAt: new Date(Number(expiration) * 1000)
            };
        }
        catch (error) {
            console.error(`❌ Failed to create order ${orderIndex + 1}:`, error.message);
            // Provide specific error guidance
            if (error.message.includes('allowance')) {
                console.log('💡 This appears to be an allowance issue.');
                console.log('🔧 The script should have handled approval automatically.');
                console.log('🔄 You may need to manually approve tokens at https://app.1inch.io/');
            }
            else if (error.message.includes('balance')) {
                console.log('💡 Insufficient balance detected.');
                console.log('💰 Please ensure you have enough tokens in your wallet.');
            }
            else if (error.message.includes('API') || error.message.includes('rate')) {
                console.log('💡 API issue detected.');
                console.log('🔑 Check your 1inch API key and rate limits.');
            }
            return null;
        }
    }
    /**
     * Calculate target price based on strategy
     */
    calculateTargetPrice(currentPrice, orderIndex) {
        switch (this.config.strategyType) {
            case 1: // Price Drop DCA
                return currentPrice * (1 - ((this.config.priceDropPercent || 0) * (orderIndex + 1)) / 100);
            case 2: // Price Rise DCA
                return currentPrice * (1 + ((this.config.priceRisePercent || 0) * (orderIndex + 1)) / 100);
            case 3: // Time-based DCA
                return currentPrice; // Use current price for time-based
            default:
                return currentPrice;
        }
    }
    /**
     * Calculate taking amount based on price and slippage (BigInt version)
     */
    calculateTakingAmountBigInt(makingAmount, targetPrice) {
        // Convert making amount to readable format
        const makingAmountReadable = Number(ethers_1.ethers.utils.formatUnits(makingAmount.toString(), this.config.fromTokenDecimals));
        // Calculate base taking amount
        const baseTakingAmount = makingAmountReadable / targetPrice;
        // Apply slippage tolerance
        const takingAmountWithSlippage = baseTakingAmount * (1 - this.config.slippageTolerance / 100);
        // Convert back to BigInt
        return ethers_1.ethers.utils.parseUnits(takingAmountWithSlippage.toFixed(this.config.toTokenDecimals), this.config.toTokenDecimals).toBigInt();
    }
    /**
     * Get current price using 1inch API
     */
    async getCurrentPrice() {
        try {
            console.log('📊 Fetching current price from 1inch API...');
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
            console.log(`💰 Current price: 1 ${this.config.fromTokenSymbol} = ${price.toFixed(6)} ${this.config.toTokenSymbol}`);
            return price;
        }
        catch (error) {
            console.error('❌ Failed to fetch price from 1inch API:', error.response?.data || error.message);
            // Fallback to mock price for development
            console.log('🔄 Using fallback price...');
            return this.getMockPrice();
        }
    }
    /**
     * Get mock price for fallback
     */
    getMockPrice() {
        // Mock prices for Base mainnet pairs
        const mockPrices = {
            '1INCH-USDC': 0.35, // 1 1INCH ≈ 0.35 USDC
            'USDC-1INCH': 2.85, // 1 USDC ≈ 2.85 1INCH
            'ETH-USDC': 2400,
            'WETH-USDC': 2400,
            'USDC-ETH': 0.00042,
            'USDC-WETH': 0.00042
        };
        const pair = `${this.config.fromTokenSymbol}-${this.config.toTokenSymbol}`;
        return mockPrices[pair] || 1;
    }
    /**
     * Get active orders from 1inch API
     */
    async getActiveOrdersFromAPI() {
        try {
            const makerAddress = await this.signer.getAddress();
            const ordersResponse = await this.oneInchApi.getOrdersByMaker(new limit_order_sdk_1.Address(makerAddress));
            // Filter only active orders and map to expected format
            return ordersResponse.filter((order) => !order.orderInvalidReason &&
                (order.fillableBalance || '0') !== '0').map((order) => ({
                orderHash: order.orderHash,
                signature: order.signature || '',
                data: {
                    salt: BigInt(order.data.salt || '0'),
                    maker: order.data.maker,
                    receiver: order.data.receiver,
                    makerAsset: order.data.makerAsset,
                    takerAsset: order.data.takerAsset,
                    makingAmount: BigInt(order.data.makingAmount || '0'),
                    takingAmount: BigInt(order.data.takingAmount || '0'),
                    makerTraits: BigInt(order.data.makerTraits || '0')
                },
                createDateTime: order.createDateTime,
                fillableBalance: order.fillableBalance || '0',
                orderInvalidReason: order.orderInvalidReason,
                auctionStartDate: order.auctionStartDate,
                auctionEndDate: order.auctionEndDate,
                remainingMakerAmount: order.remainingMakerAmount || '0',
                makerBalance: order.makerBalance || '0',
                makerAllowance: order.makerAllowance || '0'
            }));
        }
        catch (error) {
            console.error('❌ Failed to fetch orders from 1inch API:', error.message);
            return [];
        }
    }
    /**
     * Monitor and manage active orders using 1inch API
     */
    async monitorOrders() {
        console.log('\\n👀 Starting order monitoring with 1inch API...\\n');
        setInterval(async () => {
            await this.checkOrderExecutionWithAPI();
            await this.rebalanceIfNeeded();
        }, 60000); // Check every minute
        // Keep the process running
        process.stdin.resume();
    }
    /**
     * Submit orders to 1inch protocol using SDK
     */
    async submitOrdersToProtocol() {
        console.log('📤 Orders already submitted to 1inch protocol via SDK...');
        const results = [];
        for (const [orderHash] of this.activeOrders) {
            // Orders are already submitted in createSingleOrderWithSDK
            results.push({ success: true, orderHash });
        }
        return results;
    }
    /**
     * Monitor and execute orders (enhanced monitoring with 1inch API)
     */
    async monitorAndExecute() {
        console.log('\\n🎯 Starting enhanced monitoring with 1inch API...\\n');
        const monitoringInterval = setInterval(async () => {
            try {
                await this.checkOrderExecutionWithAPI();
                await this.rebalanceIfNeeded();
            }
            catch (error) {
                console.error('❌ Error during monitoring:', error.message);
            }
        }, 30000); // Check every 30 seconds for more responsive monitoring
        // Handle graceful shutdown
        process.on('SIGINT', () => {
            console.log('\\n🛑 Stopping monitoring...');
            clearInterval(monitoringInterval);
            process.exit(0);
        });
        // Keep the process running
        process.stdin.resume();
    }
    /**
     * Check if any orders should be executed using 1inch API
     */
    async checkOrderExecutionWithAPI() {
        try {
            const activeOrders = await this.getActiveOrdersFromAPI();
            const currentPrice = await this.getCurrentPrice();
            for (const orderInfo of activeOrders) {
                const orderData = this.activeOrders.get(orderInfo.orderHash);
                if (orderData && this.shouldExecuteOrder(orderData, currentPrice)) {
                    console.log(`🎯 Order ${orderInfo.orderHash.slice(0, 10)}... ready for execution at price ${currentPrice}`);
                    // Check if order was actually filled
                    const updatedOrderInfo = await this.oneInchApi.getOrderByHash(orderInfo.orderHash);
                    if (updatedOrderInfo.fillableBalance === '0') {
                        console.log(`✅ Order ${orderInfo.orderHash.slice(0, 10)}... was filled!`);
                        orderData.status = types_1.OrderStatus.FILLED;
                        // In a production system, you might want to create a replacement order
                    }
                }
            }
        }
        catch (error) {
            console.error('❌ Error checking order execution:', error.message);
        }
    }
    /**
     * Determine if an order should be executed
     */
    shouldExecuteOrder(orderData, currentPrice) {
        switch (this.config.strategyType) {
            case 1: // Price Drop DCA
                return currentPrice <= orderData.targetPrice;
            case 2: // Price Rise DCA
                return currentPrice >= orderData.targetPrice;
            case 3: // Time-based DCA
                // Check if enough time has passed
                return true; // Simplified for demo
            default:
                return false;
        }
    }
    /**
     * Rebalance strategy if needed
     */
    async rebalanceIfNeeded() {
        // This would contain logic to adjust orders based on market conditions
        // For example, creating new orders as old ones get filled
        const activeApiOrders = await this.getActiveOrdersFromAPI();
        if (activeApiOrders.length < this.config.numberOfOrders) {
            console.log(`📊 Rebalancing needed: ${activeApiOrders.length}/${this.config.numberOfOrders} orders active`);
            // Logic to create new orders could go here
        }
    }
    /**
     * Cancel all active orders using 1inch API
     */
    async cancelAllOrders() {
        console.log('\\n🛑 Cancelling all active orders via 1inch API...\\n');
        try {
            const activeApiOrders = await this.getActiveOrdersFromAPI();
            for (const orderInfo of activeApiOrders) {
                try {
                    // Note: Direct cancellation via SDK may not be available
                    // Alternative: mark as cancelled locally and inform user
                    console.log(`ℹ️ Marking order for cancellation: ${orderInfo.orderHash.slice(0, 10)}...`);
                    console.log(`⚠️ Manual cancellation may be required via 1inch interface`);
                    const orderData = this.activeOrders.get(orderInfo.orderHash);
                    if (orderData) {
                        orderData.status = types_1.OrderStatus.CANCELLED;
                        console.log(`✅ Order marked as cancelled locally: ${orderInfo.orderHash.slice(0, 10)}...`);
                    }
                }
                catch (error) {
                    console.error(`❌ Error cancelling order ${orderInfo.orderHash.slice(0, 10)}...:`, error.message);
                }
            }
        }
        catch (error) {
            console.error('❌ Error fetching orders for cancellation:', error.message);
        }
    }
    /**
     * Display current strategy status with 1inch API data
     */
    async displayStatus() {
        console.log('\\n📈 Strategy Status');
        console.log('==================');
        try {
            const activeApiOrders = await this.getActiveOrdersFromAPI();
            const allActiveOrdersCount = activeApiOrders.length; // Using count from API response
            console.log(`Active Orders (API): ${activeApiOrders.length}`);
            console.log(`Total Active Orders: ${allActiveOrdersCount}`);
            console.log(`Local Orders: ${this.activeOrders.size}`);
            console.log(`Strategy Type: ${this.getStrategyTypeName()}`);
            console.log(`Total Investment: ${this.config.totalAmount} ${this.config.fromTokenSymbol}`);
            console.log(`Target Asset: ${this.config.toTokenSymbol}\\n`);
            // Display individual order status
            if (activeApiOrders.length > 0) {
                console.log('📋 Order Details:');
                for (const orderInfo of activeApiOrders.slice(0, 5)) { // Show first 5 orders
                    console.log(`   ${orderInfo.orderHash.slice(0, 10)}... - Fillable: ${ethers_1.ethers.utils.formatUnits(orderInfo.fillableBalance || '0', this.config.fromTokenDecimals)} ${this.config.fromTokenSymbol}`);
                }
                if (activeApiOrders.length > 5) {
                    console.log(`   ... and ${activeApiOrders.length - 5} more orders`);
                }
            }
        }
        catch (error) {
            console.error('❌ Error displaying status:', error.message);
            // Fallback to local data
            console.log(`Local Active Orders: ${this.activeOrders.size}`);
            console.log(`Strategy Type: ${this.getStrategyTypeName()}`);
            console.log(`Total Investment: ${this.config.totalAmount} ${this.config.fromTokenSymbol}`);
            console.log(`Target Asset: ${this.config.toTokenSymbol}\\n`);
        }
    }
    /**
     * Get strategy type name
     */
    getStrategyTypeName() {
        switch (this.config.strategyType) {
            case 1: return `Price Drop DCA (${this.config.priceDropPercent}% drop, ${this.config.buyPercent}% buy)`;
            case 2: return `Price Rise DCA (${this.config.priceRisePercent}% rise, ${this.config.buyPercent}% buy)`;
            case 3: return `Time-based DCA (${this.config.intervalHours}h intervals)`;
            default: return 'Unknown';
        }
    }
    /**
     * Get order by hash from 1inch API
     */
    async getOrderStatus(orderHash) {
        try {
            const result = await this.oneInchApi.getOrderByHash(orderHash);
            // Convert SDK response to our expected format
            return {
                orderHash,
                signature: '',
                data: {
                    salt: BigInt(result.data.salt || '0'),
                    maker: result.data.maker,
                    receiver: result.data.receiver,
                    makerAsset: result.data.makerAsset,
                    takerAsset: result.data.takerAsset,
                    makingAmount: BigInt(result.data.makingAmount || '0'),
                    takingAmount: BigInt(result.data.takingAmount || '0'),
                    makerTraits: BigInt(result.data.makerTraits || '0')
                },
                createDateTime: result.createDateTime,
                fillableBalance: result.fillableBalance || '0',
                orderInvalidReason: result.orderInvalidReason,
                auctionStartDate: result.auctionStartDate,
                auctionEndDate: result.auctionEndDate,
                remainingMakerAmount: result.remainingMakerAmount,
                makerBalance: result.makerBalance,
                makerAllowance: result.makerAllowance
            };
        }
        catch (error) {
            console.error(`❌ Failed to get order status for ${orderHash.slice(0, 10)}...:`, error.message);
            return null;
        }
    }
    /**
     * Update local order status based on API data
     */
    async syncOrdersWithAPI() {
        try {
            const activeApiOrders = await this.getActiveOrdersFromAPI();
            // Update local orders based on API data
            for (const [orderHash, localOrderData] of this.activeOrders) {
                const apiOrderInfo = activeApiOrders.find(order => order.orderHash === orderHash);
                if (!apiOrderInfo) {
                    // Order not found in API, might be filled or cancelled
                    const orderInfo = await this.getOrderStatus(orderHash);
                    if (orderInfo) {
                        if (orderInfo.fillableBalance === '0') {
                            localOrderData.status = types_1.OrderStatus.FILLED;
                            console.log(`📊 Order ${orderHash.slice(0, 10)}... marked as FILLED`);
                        }
                        else if (orderInfo.orderInvalidReason) {
                            localOrderData.status = types_1.OrderStatus.CANCELLED;
                            console.log(`📊 Order ${orderHash.slice(0, 10)}... marked as CANCELLED`);
                        }
                    }
                }
                else {
                    // Update remaining amount
                    localOrderData.remainingMakingAmount = BigInt(apiOrderInfo.fillableBalance || '0');
                    if (apiOrderInfo.fillableBalance !== localOrderData.order.makingAmount.toString()) {
                        localOrderData.status = types_1.OrderStatus.PARTIALLY_FILLED;
                        console.log(`📊 Order ${orderHash.slice(0, 10)}... partially filled`);
                    }
                }
            }
        }
        catch (error) {
            console.error('❌ Error syncing orders with API:', error.message);
        }
    }
}
exports.HodlLadderDCA = HodlLadderDCA;
// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\\n\\n🛑 Shutting down...');
    // Add cleanup logic here
    process.exit(0);
});
// Export the class for use in other modules
//# sourceMappingURL=dca.js.map