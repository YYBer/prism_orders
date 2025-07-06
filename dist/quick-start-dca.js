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
Object.defineProperty(exports, "__esModule", { value: true });
exports.EXAMPLE_STRATEGIES = exports.BASE_TOKENS = exports.BASE_CONFIG = exports.QuickStartApp = void 0;
const dotenv = __importStar(require("dotenv"));
const ethers_1 = require("ethers");
const readline = __importStar(require("readline"));
const dca_1 = require("./dca");
const types_1 = require("./types");
// Load environment variables
dotenv.config();
const BASE_CONFIG = {
    chainId: parseInt(process.env.CHAIN_ID || '8453'),
    rpcUrl: process.env.RPC_URL || 'https://base.llamarpc.com',
    privateKey: process.env.PRIVATE_KEY || '',
    walletAddress: process.env.WALLET_ADDRESS || '',
    oneInchApiKey: process.env.ONEINCH_API_KEY || 'dyqTRYbTBcOMYmZitPfJ9FP2j1dQVgBv'
};
exports.BASE_CONFIG = BASE_CONFIG;
// Base Mainnet Tokens
const BASE_TOKENS = {
    '1INCH': {
        address: process.env.DEFAULT_FROM_TOKEN || '0xc5fecC3a29Fb57B5024eEc8a2239d4621e111CBE',
        symbol: '1INCH',
        decimals: 18,
        name: '1inch Token'
    },
    USDC: {
        address: process.env.DEFAULT_TO_TOKEN || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        symbol: 'USDC',
        decimals: 6,
        name: 'USD Coin'
    },
    WETH: {
        address: '0x4200000000000000000000000000000000000006',
        symbol: 'WETH',
        decimals: 18,
        name: 'Wrapped Ether'
    },
    cbETH: {
        address: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22',
        symbol: 'cbETH',
        decimals: 18,
        name: 'Coinbase Wrapped Staked ETH'
    },
    DAI: {
        address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
        symbol: 'DAI',
        decimals: 18,
        name: 'Dai Stablecoin'
    }
};
exports.BASE_TOKENS = BASE_TOKENS;
const EXAMPLE_STRATEGIES = {
    '1': {
        name: 'Conservative 1INCH Accumulation',
        description: 'Steady 1INCH accumulation strategy using 1inch Limit Orders',
        config: {
            fromTokenSymbol: '1INCH',
            toTokenSymbol: 'USDC',
            totalAmount: '20',
            numberOfOrders: 3,
            strategyType: types_1.StrategyType.PRICE_DROP_DCA,
            priceDropPercent: 10,
            buyPercent: 20,
            slippageTolerance: 1
        }
    },
    '2': {
        name: 'Aggressive 1INCH DCA',
        description: 'More frequent 1INCH selling using 1inch Protocol',
        config: {
            fromTokenSymbol: '1INCH',
            toTokenSymbol: 'USDC',
            totalAmount: '20',
            numberOfOrders: 3,
            strategyType: types_1.StrategyType.PRICE_RISE_DCA,
            priceRisePercent: 5,
            buyPercent: 15,
            slippageTolerance: 2
        }
    },
    '3': {
        name: 'Profit Taking Strategy',
        description: 'Take profits on 1INCH price increases via 1inch Limit Orders',
        config: {
            fromTokenSymbol: '1INCH',
            toTokenSymbol: 'USDC',
            totalAmount: '3',
            numberOfOrders: 3,
            strategyType: types_1.StrategyType.PRICE_RISE_DCA,
            priceRisePercent: 8,
            buyPercent: 25,
            slippageTolerance: 1.5
        }
    },
    '4': {
        name: 'Time-based 1INCH DCA',
        description: 'Regular interval 1INCH selling using 1inch SDK',
        config: {
            fromTokenSymbol: '1INCH',
            toTokenSymbol: 'USDC',
            totalAmount: '12',
            numberOfOrders: 3,
            strategyType: types_1.StrategyType.TIME_BASED_DCA,
            intervalHours: 24,
            buyPercent: 100, // Use full allocation per interval
            slippageTolerance: 1
        }
    }
};
exports.EXAMPLE_STRATEGIES = EXAMPLE_STRATEGIES;
// Quick Start Application Class with 1inch Integration
class QuickStartApp {
    constructor() {
        if (!BASE_CONFIG.privateKey) {
            throw new Error('PRIVATE_KEY environment variable is required');
        }
        if (!BASE_CONFIG.oneInchApiKey) {
            throw new Error('ONEINCH_API_KEY environment variable is required. Get one at https://portal.1inch.dev/');
        }
        this.provider = new ethers_1.ethers.providers.JsonRpcProvider(BASE_CONFIG.rpcUrl);
        this.signer = new ethers_1.ethers.Wallet(BASE_CONFIG.privateKey, this.provider);
    }
    async run() {
        try {
            await this.displayWelcome();
            await this.checkWalletStatus();
            await this.check1inchConfiguration();
            await this.showTokenInfo();
            const choice = await this.getUserChoice();
            if (choice.toLowerCase() === 'tokens') {
                this.showTokenAcquisitionGuide();
                return;
            }
            if (choice === '0') {
                console.log('👋 Starting interactive mode...\n');
                await this.runInteractiveMode();
            }
            else if (EXAMPLE_STRATEGIES[choice]) {
                console.log(`🎯 Selected: ${EXAMPLE_STRATEGIES[choice].name}\n`);
                await this.runPreConfiguredStrategy(EXAMPLE_STRATEGIES[choice]);
            }
            else {
                console.log('❌ Invalid choice. Exiting...');
                process.exit(1);
            }
        }
        catch (error) {
            console.error('❌ Error in quick start:', error.message);
            if (error.message.includes('ONEINCH_API_KEY')) {
                console.log('\n💡 To get a 1inch API key:');
                console.log('1. Visit https://portal.1inch.dev/');
                console.log('2. Sign up or log in');
                console.log('3. Create a new API key');
                console.log('4. Add it to your .env file as ONEINCH_API_KEY=your_key_here');
            }
            process.exit(1);
        }
    }
    async displayWelcome() {
        console.log('🚀 1inch DCA Hodl Ladder - Real Integration (Base Mainnet)');
        console.log('==========================================================\n');
        console.log('📍 Network: Base Mainnet (Chain ID: 8453)');
        console.log(`👤 Wallet: ${await this.signer.getAddress()}`);
        console.log(`🔗 RPC: ${BASE_CONFIG.rpcUrl}`);
        console.log(`🏛️  1inch Protocol: ${types_1.LIMIT_ORDER_PROTOCOL_ADDRESSES[BASE_CONFIG.chainId]}`);
        console.log(`🔑 API Key: ${BASE_CONFIG.oneInchApiKey.slice(0, 8)}...${BASE_CONFIG.oneInchApiKey.slice(-4)}\n`);
    }
    async checkWalletStatus() {
        try {
            // Check ETH balance
            const balance = await this.provider.getBalance(await this.signer.getAddress());
            const balanceFormatted = ethers_1.ethers.utils.formatEther(balance);
            console.log(`💰 ETH Balance: ${balanceFormatted} ETH`);
            if (parseFloat(balanceFormatted) < 0.001) {
                console.log('⚠️  Low ETH balance - you may need more ETH for gas fees');
            }
        }
        catch (error) {
            console.warn('⚠️  Could not check wallet balance:', error.message);
        }
    }
    async check1inchConfiguration() {
        try {
            // Test 1inch API connectivity
            const testUrl = `https://api.1inch.dev/swap/v6.0/${BASE_CONFIG.chainId}/healthcheck`;
            const response = await fetch(testUrl, {
                headers: {
                    'Authorization': `Bearer ${BASE_CONFIG.oneInchApiKey}`,
                    'accept': 'application/json'
                }
            });
            if (response.ok) {
                console.log('✅ 1inch API connection verified');
            }
            else {
                console.log('⚠️  1inch API connection issue - check your API key');
            }
        }
        catch (error) {
            console.warn('⚠️  Could not verify 1inch API:', error.message);
        }
    }
    async showTokenInfo() {
        console.log('🪙 Available Tokens on Base Mainnet:');
        console.log('====================================');
        Object.entries(BASE_TOKENS).forEach(([symbol, token]) => {
            console.log(`${symbol.padEnd(6)}: ${token.address} (${token.name})`);
        });
        console.log('\n💡 All strategies use real 1inch Limit Order Protocol v4');
        console.log('📊 Orders are submitted to 1inch orderbook for execution');
        console.log('');
    }
    async getUserChoice() {
        console.log('📋 Available Pre-configured Strategies (Real 1inch Integration):');
        console.log('==============================================================');
        Object.entries(EXAMPLE_STRATEGIES).forEach(([id, strategy]) => {
            console.log(`${id}. ${strategy.name}`);
            console.log(`   💰 ${strategy.config.totalAmount} ${strategy.config.fromTokenSymbol} → ${strategy.config.toTokenSymbol}`);
            console.log(`   📊 ${strategy.config.numberOfOrders} orders, ${this.getStrategyDescription(strategy.config)}`);
            console.log(`   📝 ${strategy.description}\n`);
        });
        console.log('0. Interactive mode (configure manually)');
        console.log('tokens. Show how to get testnet tokens\n');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        return new Promise(resolve => {
            rl.question('Select a strategy (0-4, tokens): ', (answer) => {
                rl.close();
                resolve(answer.trim());
            });
        });
    }
    getStrategyDescription(config) {
        switch (config.strategyType) {
            case types_1.StrategyType.PRICE_DROP_DCA:
                return `${config.priceDropPercent}% price drop → buy ${config.buyPercent}%`;
            case types_1.StrategyType.PRICE_RISE_DCA:
                return `${config.priceRisePercent}% price rise → buy ${config.buyPercent}%`;
            case types_1.StrategyType.TIME_BASED_DCA:
                return `Every ${config.intervalHours}h → buy equal amounts`;
            default:
                return 'Custom strategy';
        }
    }
    showTokenAcquisitionGuide() {
        console.log('🪙 How to Get Base Mainnet Tokens');
        console.log('=================================\n');
        console.log('📍 Base Mainnet Token Acquisition:');
        console.log('1. Bridge ETH to Base via https://bridge.base.org/');
        console.log('2. Swap ETH for other tokens on Base DEXs:');
        console.log('   - Uniswap V3: https://app.uniswap.org/');
        console.log('   - SushiSwap: https://www.sushi.com/');
        console.log('   - 1inch: https://app.1inch.io/');
        console.log('3. For 1INCH token specifically:');
        console.log('   - Use 1inch dApp to swap ETH → 1INCH');
        console.log('   - Or bridge 1INCH from Ethereum mainnet\n');
        console.log('💡 Recommended amounts for testing:');
        console.log('   - 0.01 ETH minimum for gas fees');
        console.log('   - 20-100 1INCH tokens for DCA strategies');
        console.log('   - 50-200 USDC for testing\n');
        console.log('⚠️  Important Notes:');
        console.log('   - Base is a Layer 2 with low fees');
        console.log('   - You need ETH for gas even for token swaps');
        console.log('   - 1inch Limit Orders don\'t lock your tokens');
        console.log('   - Orders can be cancelled anytime (gas fee applies)\n');
    }
    async runPreConfiguredStrategy(strategyDef) {
        try {
            // Convert pre-configured strategy to full strategy config
            const strategyConfig = {
                ...strategyDef.config,
                fromToken: BASE_TOKENS[strategyDef.config.fromTokenSymbol],
                toToken: BASE_TOKENS[strategyDef.config.toTokenSymbol]
            };
            // Display strategy summary
            console.log('📊 Strategy Summary (Real 1inch Integration):');
            console.log('===========================================');
            console.log(`Name: ${strategyDef.name}`);
            console.log(`From: ${strategyConfig.totalAmount} ${strategyConfig.fromToken.symbol}`);
            console.log(`To: ${strategyConfig.toToken.symbol}`);
            console.log(`Orders: ${strategyConfig.numberOfOrders}`);
            console.log(`Trigger: ${this.getStrategyDescription(strategyDef.config)}`);
            console.log(`Slippage: ${strategyConfig.slippageTolerance}%`);
            console.log(`Integration: 1inch Limit Order Protocol v4`);
            console.log(`API: Real 1inch orderbook submission\n`);
            // Ask for confirmation
            const confirmation = await this.askConfirmation('Proceed with creating REAL limit orders on 1inch?');
            if (!confirmation) {
                console.log('👋 Operation cancelled.');
                return;
            }
            // Initialize and run DCA strategy with real 1inch integration
            const dcaStrategy = new dca_1.HodlLadderDCA(this.provider, this.signer);
            // Set the configuration directly (bypass interactive setup)
            dcaStrategy.setConfiguration(strategyConfig);
            // Validate configuration
            console.log('🔍 Validating configuration and checking balances...');
            const validation = await dcaStrategy.validateConfigurationWithResult();
            if (!validation.isValid) {
                console.error('❌ Configuration validation failed:');
                validation.errors.forEach((error) => console.error(`   - ${error}`));
                return;
            }
            if (validation.warnings.length > 0) {
                console.log('⚠️  Warnings:');
                validation.warnings.forEach((warning) => console.log(`   - ${warning}`));
                // Ask for confirmation if there are warnings
                const proceedWithWarnings = await this.askConfirmation('Continue despite warnings?');
                if (!proceedWithWarnings) {
                    console.log('👋 Operation cancelled due to warnings.');
                    return;
                }
            }
            console.log('✅ Configuration validated!\n');
            // Execute the strategy with real 1inch integration
            await this.executeStrategyWithRealIntegration(dcaStrategy);
        }
        catch (error) {
            console.error('❌ Failed to run pre-configured strategy:', error.message);
            if (error.message.includes('Insufficient balance') || error.message.includes('balance')) {
                console.log('\n💡 Balance Issues:');
                console.log('1. Make sure you have enough tokens in your wallet');
                console.log('2. Check that you have sufficient ETH for gas fees');
                console.log('3. Get tokens from Base DEXs or bridges');
                console.log('\nRun with "tokens" option for acquisition guide');
            }
            else if (error.message.includes('allowance') || error.message.includes('approval')) {
                console.log('\n💡 Token Approval Issues:');
                console.log('1. The script should automatically handle approvals');
                console.log('2. If this fails, manually approve at https://app.1inch.io/');
                console.log('3. You need to approve 1inch Limit Order Protocol to spend your tokens');
                console.log('4. This is a one-time setup per token');
            }
            else if (error.message.includes('API') || error.message.includes('1inch')) {
                console.log('\n💡 1inch API Issues:');
                console.log('1. Check your API key at https://portal.1inch.dev/');
                console.log('2. Verify network connectivity');
                console.log('3. Ensure sufficient API rate limits');
                console.log('4. Try again in a few minutes if rate limited');
            }
        }
    }
    async runInteractiveMode() {
        console.log('🔧 Interactive Mode - Real 1inch Integration');
        console.log('===========================================\n');
        const dcaStrategy = new dca_1.HodlLadderDCA(this.provider, this.signer);
        await dcaStrategy.initialize();
        await this.executeStrategyWithRealIntegration(dcaStrategy);
    }
    async executeStrategyWithRealIntegration(dcaStrategy) {
        try {
            // Create DCA orders using real 1inch SDK
            console.log('🚀 Creating DCA orders with 1inch SDK...');
            console.log('📡 This will submit REAL orders to 1inch orderbook...\n');
            const orders = await dcaStrategy.createDCAOrders();
            if (orders.length === 0) {
                console.log('❌ No orders were created. Please check your configuration.');
                return;
            }
            console.log(`✅ Successfully created ${orders.length} real limit orders!`);
            console.log('📊 Orders are now live on 1inch orderbook\n');
            // Display status with real API data
            await dcaStrategy.displayStatus();
            // Sync with 1inch API to get latest order states
            console.log('🔄 Syncing with 1inch API...');
            await dcaStrategy.syncOrdersWithAPI();
            // Ask if user wants to start monitoring
            const startMonitoring = await this.askConfirmation('Start real-time monitoring with 1inch API?');
            if (startMonitoring) {
                console.log('🎯 Starting real-time monitoring...');
                console.log('📡 Monitoring orders via 1inch API');
                console.log('💡 Press Ctrl+C to stop\n');
                // Start enhanced monitoring with 1inch API integration
                await dcaStrategy.monitorAndExecute();
            }
            else {
                console.log('👋 Orders created but monitoring not started.');
                console.log('💡 Your orders are live on 1inch and will be filled when conditions are met.');
                // Show how to monitor manually
                this.showManualMonitoringInstructions();
                // Show order details
                console.log('\n📋 Created Orders (submitted to 1inch):');
                orders.forEach((order, index) => {
                    console.log(`   ${index + 1}. ${order.orderHash.slice(0, 10)}... (Target: ${order.targetPrice.toFixed(6)})`);
                    console.log(`      Status: ${order.status} | Expires: ${order.expiresAt.toLocaleDateString()}`);
                });
                // Offer to check status
                const checkStatus = await this.askConfirmation('Check current order status from 1inch API?');
                if (checkStatus) {
                    await this.checkOrderStatusFromAPI(dcaStrategy, orders);
                }
            }
        }
        catch (error) {
            console.error('❌ Failed to execute strategy:', error.message);
            if (error.message.includes('rate limit') || error.message.includes('API')) {
                console.log('\n💡 1inch API Rate Limiting:');
                console.log('1. Wait a moment and try again');
                console.log('2. Consider upgrading your API plan at https://portal.1inch.dev/');
                console.log('3. Reduce the number of orders in your strategy');
            }
            throw error;
        }
    }
    showManualMonitoringInstructions() {
        console.log('\n📖 Manual Monitoring Instructions:');
        console.log('=================================');
        console.log('1. Visit https://app.1inch.io/ and connect your wallet');
        console.log('2. Go to "Limit Orders" section to see your active orders');
        console.log('3. Orders will automatically execute when price conditions are met');
        console.log('4. You can cancel orders anytime (gas fee applies)');
        console.log('5. No funds are locked - you maintain full control\n');
    }
    async checkOrderStatusFromAPI(dcaStrategy, orders) {
        console.log('\n🔍 Checking order status from 1inch API...\n');
        for (const order of orders) {
            try {
                const status = await dcaStrategy.getOrderStatus(order.orderHash);
                if (status) {
                    console.log(`📊 Order ${order.orderHash.slice(0, 10)}...:`);
                    console.log(`   Fillable Balance: ${ethers_1.ethers.utils.formatUnits(status.fillableBalance || '0', 18)} tokens`);
                    console.log(`   Created: ${new Date(status.createDateTime).toLocaleString()}`);
                    console.log(`   Invalid Reason: ${status.orderInvalidReason || 'None (Active)'}`);
                    console.log('');
                }
            }
            catch (error) {
                console.log(`❌ Could not fetch status for ${order.orderHash.slice(0, 10)}...`);
            }
        }
    }
    async askConfirmation(question) {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        return new Promise(resolve => {
            rl.question(`${question} (y/N): `, (answer) => {
                rl.close();
                resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
            });
        });
    }
}
exports.QuickStartApp = QuickStartApp;
// Utility functions for help commands
function showHelp() {
    console.log('🌈 1inch DCA Hodl Ladder - Real Integration Help');
    console.log('===============================================\n');
    console.log('Usage:');
    console.log('  npm run quick-start          # Run quick start wizard');
    console.log('  npm run dev-quick            # Run in development mode');
    console.log('  npm run quick-start --help   # Show this help\n');
    console.log('Pre-configured strategies (Real 1inch Integration):');
    Object.entries(EXAMPLE_STRATEGIES).forEach(([id, strategy]) => {
        console.log(`  ${id}. ${strategy.name}`);
    });
    console.log('\nConfiguration:');
    console.log(`  Network: Base Mainnet (Chain ID: ${BASE_CONFIG.chainId})`);
    console.log(`  Protocol: 1inch Limit Order Protocol v4`);
    console.log(`  Integration: Real API calls to 1inch orderbook`);
    console.log('  API Key: Required (get at https://portal.1inch.dev/)\n');
    console.log('Environment Variables Required:');
    console.log('  PRIVATE_KEY=your_wallet_private_key');
    console.log('  ONEINCH_API_KEY=your_1inch_api_key');
    console.log('  CHAIN_ID=8453 (Base mainnet)');
    console.log('  RPC_URL=https://base.llamarpc.com\n');
}
function showVersion() {
    console.log('1inch DCA Hodl Ladder with Real Integration v3.0.0');
    console.log('Base Mainnet + 1inch Limit Order Protocol v4');
    console.log('Powered by @1inch/limit-order-sdk');
}
// Main execution
async function main() {
    // Handle command line arguments
    const args = process.argv.slice(2);
    if (args.includes('--help') || args.includes('-h')) {
        showHelp();
        return;
    }
    if (args.includes('--version') || args.includes('-v')) {
        showVersion();
        return;
    }
    // Validate required environment variables
    if (!process.env.PRIVATE_KEY) {
        console.error('❌ PRIVATE_KEY environment variable is required');
        console.log('💡 Add your wallet private key to .env file');
        process.exit(1);
    }
    if (!process.env.ONEINCH_API_KEY) {
        console.error('❌ ONEINCH_API_KEY environment variable is required');
        console.log('💡 Get your API key at https://portal.1inch.dev/');
        console.log('💡 Add it to .env file as ONEINCH_API_KEY=your_key_here');
        process.exit(1);
    }
    // Run the main application
    const app = new QuickStartApp();
    await app.run();
}
// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n🛑 Prism Orders shutting down gracefully...');
    console.log('💡 Your limit orders remain active on 1inch');
    console.log('👋 Visit https://app.1inch.io/ to manage them manually');
    process.exit(0);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    console.log('\n💡 If this is an API error, check:');
    console.log('1. Your 1inch API key is valid');
    console.log('2. Network connectivity');
    console.log('3. Rate limiting (try again in a few minutes)');
    process.exit(1);
});
// Run if called directly
if (require.main === module) {
    main().catch((error) => {
        console.error('Fatal error:', error);
        if (error.message.includes('API') || error.message.includes('1inch')) {
            console.log('\n🔧 API Troubleshooting:');
            console.log('1. Verify your 1inch API key at https://portal.1inch.dev/');
            console.log('2. Check network connectivity');
            console.log('3. Ensure you\'re not hitting rate limits');
            console.log('4. Try again in a few minutes');
        }
        process.exit(1);
    });
}
//# sourceMappingURL=quick-start-dca.js.map