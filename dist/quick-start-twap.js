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
exports.TWAPQuickStartApp = void 0;
const dotenv = __importStar(require("dotenv"));
const ethers_1 = require("ethers");
const readline = __importStar(require("readline"));
const twap_1 = require("./twap");
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
const TWAP_STRATEGIES = {
    '1': {
        name: 'Conservative TWAP - 6 Hour Strategy',
        description: 'Steady accumulation over 6 hours with 1-hour intervals',
        config: {
            fromTokenSymbol: '1INCH',
            toTokenSymbol: 'USDC',
            totalAmount: '20',
            numberOfOrders: 3,
            strategyType: types_1.StrategyType.TIME_BASED_DCA,
            intervalHours: 1,
            buyPercent: 6.67,
            slippageTolerance: 1
        }
    },
    '2': {
        name: 'Aggressive TWAP - 2 Hour Strategy',
        description: 'Fast execution over 2 hours with 30-minute intervals',
        config: {
            fromTokenSymbol: '1INCH',
            toTokenSymbol: 'USDC',
            totalAmount: '25',
            numberOfOrders: 4,
            strategyType: types_1.StrategyType.TIME_BASED_DCA,
            intervalHours: 0.5,
            buyPercent: 25, // 100/4 orders
            slippageTolerance: 2
        }
    },
    '3': {
        name: 'Ultra-Fast TWAP - 1 Hour Strategy',
        description: 'Very fast execution over 1 hour with 10-minute intervals',
        config: {
            fromTokenSymbol: 'WETH',
            toTokenSymbol: 'USDC',
            totalAmount: '0.01',
            numberOfOrders: 3,
            strategyType: types_1.StrategyType.TIME_BASED_DCA,
            intervalHours: 0.167, // 10 minutes
            buyPercent: 16.67,
            slippageTolerance: 1.5
        }
    },
    '4': {
        name: 'Daily TWAP - 24 Hour Strategy',
        description: 'Steady accumulation over 24 hours with 4-hour intervals',
        config: {
            fromTokenSymbol: '1INCH',
            toTokenSymbol: 'USDC',
            totalAmount: '10',
            numberOfOrders: 3,
            strategyType: types_1.StrategyType.TIME_BASED_DCA,
            intervalHours: 4,
            buyPercent: 16.67,
            slippageTolerance: 1
        }
    }
};
class TWAPQuickStartApp {
    constructor() {
        this.provider = new ethers_1.ethers.providers.JsonRpcProvider(BASE_CONFIG.rpcUrl);
        this.signer = new ethers_1.ethers.Wallet(BASE_CONFIG.privateKey, this.provider);
    }
    async run() {
        try {
            console.log('🌈 Prism Orders - TWAP Strategy Quick Start');
            console.log('===========================================\n');
            await this.showWelcomeMessage();
            const choice = await this.selectStrategy();
            if (choice === 'tokens') {
                this.showTokenAcquisitionGuide();
                return;
            }
            if (choice === '0') {
                await this.runInteractiveMode();
            }
            else {
                await this.runPreConfiguredStrategy(choice);
            }
        }
        catch (error) {
            console.error('❌ Application error:', error.message);
            process.exit(1);
        }
    }
    async showWelcomeMessage() {
        console.log('💡 TWAP (Time-Weighted Average Price) Strategy');
        console.log('Split large orders into smaller chunks executed over time');
        console.log('✨ Perfect for reducing market impact and achieving average prices\n');
        console.log('🔧 Environment Check:');
        console.log(`  Network: Base Mainnet (${BASE_CONFIG.chainId})`);
        console.log(`  RPC URL: ${BASE_CONFIG.rpcUrl}`);
        console.log(`  Wallet: ${(await this.signer.getAddress()).slice(0, 6)}...${(await this.signer.getAddress()).slice(-4)}`);
        console.log(`  Protocol: 1inch Limit Order Protocol v4`);
        console.log(`  API Integration: Real 1inch orderbook\n`);
        // Check wallet balance
        const balance = await this.provider.getBalance(await this.signer.getAddress());
        const ethBalance = parseFloat(ethers_1.ethers.utils.formatEther(balance));
        console.log(`💰 ETH Balance: ${ethBalance.toFixed(4)} ETH`);
        if (ethBalance < 0.001) {
            console.warn('⚠️  Low ETH balance - you may need more ETH for gas fees');
        }
        console.log('');
    }
    async selectStrategy() {
        console.log('📋 Pre-configured TWAP Strategies:\n');
        Object.entries(TWAP_STRATEGIES).forEach(([id, strategy]) => {
            const intervalText = strategy.config.intervalHours >= 1
                ? `${strategy.config.intervalHours}h`
                : `${strategy.config.intervalHours * 60}min`;
            console.log(`${id}. ${strategy.name}`);
            console.log(`   💰 ${strategy.config.totalAmount} ${strategy.config.fromTokenSymbol} → ${strategy.config.toTokenSymbol}`);
            console.log(`   📊 ${strategy.config.numberOfOrders} orders every ${intervalText}`);
            console.log(`   📝 ${strategy.description}\n`);
        });
        console.log('0. Interactive mode (configure manually)');
        console.log('tokens. Show how to get testnet tokens\n');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        return new Promise(resolve => {
            rl.question('Select a TWAP strategy (0-4, tokens): ', (answer) => {
                rl.close();
                resolve(answer.trim());
            });
        });
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
        console.log('3. Popular Base tokens to try:');
        console.log('   - 1INCH: For testing our default strategies');
        console.log('   - USDC: Stable coin for receiving trades');
        console.log('   - WETH: Wrapped Ethereum');
        console.log('   - cbETH: Coinbase ETH for staking rewards\n');
        console.log('💡 Pro Tips:');
        console.log('• Start small with test amounts');
        console.log('• Check token liquidity on DEXs before trading');
        console.log('• Keep some ETH for gas fees');
        console.log('• Use https://app.1inch.io/ to check best swap rates');
    }
    async runPreConfiguredStrategy(choice) {
        const strategy = TWAP_STRATEGIES[choice];
        if (!strategy) {
            throw new Error('Invalid strategy selection');
        }
        console.log(`\n🚀 Launching: ${strategy.name}`);
        console.log('=====================================\n');
        // Convert pre-configured strategy to StrategyConfig
        const strategyConfig = {
            fromToken: BASE_TOKENS[strategy.config.fromTokenSymbol],
            toToken: BASE_TOKENS[strategy.config.toTokenSymbol],
            totalAmount: strategy.config.totalAmount,
            numberOfOrders: strategy.config.numberOfOrders,
            strategyType: strategy.config.strategyType,
            intervalHours: strategy.config.intervalHours,
            buyPercent: strategy.config.buyPercent,
            slippageTolerance: strategy.config.slippageTolerance
        };
        const confirmed = await this.confirmStrategy(strategyConfig);
        if (!confirmed) {
            console.log('❌ Strategy cancelled by user');
            return;
        }
        await this.executeTWAPStrategy(strategyConfig);
    }
    async runInteractiveMode() {
        console.log('\n🛠️ Interactive TWAP Configuration');
        console.log('==================================\n');
        const twapStrategy = new twap_1.TWAPStrategy(this.provider, this.signer);
        await twapStrategy.initialize();
        await twapStrategy.executeTWAPStrategy();
    }
    async confirmStrategy(config) {
        console.log('📊 Strategy Summary:');
        console.log(`  Trading Pair: ${config.fromToken.symbol} → ${config.toToken.symbol}`);
        console.log(`  Total Amount: ${config.totalAmount} ${config.fromToken.symbol}`);
        console.log(`  Order Count: ${config.numberOfOrders}`);
        console.log(`  Amount per Order: ${(parseFloat(config.totalAmount) / config.numberOfOrders).toFixed(6)} ${config.fromToken.symbol}`);
        console.log(`  Interval: ${config.intervalHours || 1} hours`);
        console.log(`  Total Duration: ${(config.intervalHours || 1) * config.numberOfOrders} hours`);
        console.log(`  Slippage Tolerance: ${config.slippageTolerance}%\n`);
        // Check token balance
        try {
            const tokenContract = new ethers_1.ethers.Contract(config.fromToken.address, ['function balanceOf(address) view returns (uint256)'], this.provider);
            const balance = await tokenContract.balanceOf(await this.signer.getAddress());
            const balanceFormatted = parseFloat(ethers_1.ethers.utils.formatUnits(balance, config.fromToken.decimals));
            console.log(`💰 Current Balance: ${balanceFormatted.toFixed(6)} ${config.fromToken.symbol}`);
            if (balanceFormatted < parseFloat(config.totalAmount)) {
                console.warn(`⚠️  Insufficient balance! Required: ${config.totalAmount} ${config.fromToken.symbol}`);
                return false;
            }
        }
        catch (error) {
            console.warn('⚠️ Could not check token balance');
        }
        return await this.askConfirmation('Proceed with this TWAP strategy?');
    }
    async executeTWAPStrategy(config) {
        try {
            console.log('\n🔧 Initializing TWAP Strategy...');
            const twapStrategy = new twap_1.TWAPStrategy(this.provider, this.signer);
            twapStrategy.setConfiguration(config);
            // Validate configuration
            const validation = await twapStrategy.validateConfigurationWithResult();
            if (!validation.isValid) {
                console.error('❌ Configuration validation failed:');
                validation.errors.forEach(error => console.error(`   • ${error}`));
                return;
            }
            if (validation.warnings.length > 0) {
                console.warn('\n⚠️ Configuration warnings:');
                validation.warnings.forEach(warning => console.warn(`   • ${warning}`));
                const continueAnyway = await this.askConfirmation('Continue anyway?');
                if (!continueAnyway) {
                    console.log('❌ Strategy cancelled due to warnings');
                    return;
                }
            }
            console.log('\n✅ Configuration validated successfully!');
            // Execute the strategy
            await twapStrategy.executeTWAPStrategy();
            // Show final monitoring instructions
            this.showMonitoringInstructions();
        }
        catch (error) {
            console.error('❌ TWAP strategy execution failed:', error.message);
            // Provide helpful error context
            if (error.message.includes('insufficient')) {
                console.log('\n💡 Common solutions:');
                console.log('1. Check your token balance');
                console.log('2. Approve tokens at https://app.1inch.io/');
                console.log('3. Ensure you have enough ETH for gas fees');
            }
            else if (error.message.includes('API')) {
                console.log('\n💡 API troubleshooting:');
                console.log('1. Check your 1inch API key');
                console.log('2. Verify network connectivity');
                console.log('3. Reduce the number of orders to avoid rate limits');
            }
            throw error;
        }
    }
    showMonitoringInstructions() {
        console.log('\n📖 TWAP Monitoring Instructions:');
        console.log('================================');
        console.log('1. Your TWAP orders are now active on 1inch protocol');
        console.log('2. Orders will execute automatically at scheduled times');
        console.log('3. Monitor progress at https://app.1inch.io/ (connect your wallet)');
        console.log('4. Orders execute only when market conditions meet your criteria');
        console.log('5. You can cancel unfilled orders anytime (gas fee applies)');
        console.log('6. No funds are locked - you maintain full control\n');
        console.log('📊 Real-time monitoring features:');
        console.log('• Automatic execution at scheduled intervals');
        console.log('• Price impact reduction through time distribution');
        console.log('• Slippage protection on each individual order');
        console.log('• Automatic order expiration handling');
        console.log('• No manual intervention required\n');
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
exports.TWAPQuickStartApp = TWAPQuickStartApp;
// Utility functions for help commands
function showHelp() {
    console.log('🌈 1inch TWAP Strategy - Real Integration Help');
    console.log('==============================================\n');
    console.log('Usage:');
    console.log('  npm run twap                     # Run TWAP quick start wizard');
    console.log('  npm run twap --help              # Show this help');
    console.log('  npm run twap --version           # Show version\n');
    console.log('Pre-configured TWAP strategies (Real 1inch Integration):');
    Object.entries(TWAP_STRATEGIES).forEach(([id, strategy]) => {
        const intervalText = strategy.config.intervalHours >= 1
            ? `${strategy.config.intervalHours}h`
            : `${strategy.config.intervalHours * 60}min`;
        console.log(`  ${id}. ${strategy.name} (${intervalText} intervals)`);
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
    console.log('TWAP Strategy Benefits:');
    console.log('• Reduces market impact for large orders');
    console.log('• Achieves time-weighted average pricing');
    console.log('• Automated execution at scheduled intervals');
    console.log('• Built-in slippage protection');
    console.log('• No manual intervention required');
}
function showVersion() {
    console.log('Prism Orders TWAP Strategy v3.0.0');
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
    // Run the TWAP application
    const app = new TWAPQuickStartApp();
    await app.run();
}
// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n🛑 TWAP Strategy shutting down gracefully...');
    console.log('💡 Your scheduled orders remain active on 1inch');
    console.log('👀 They will continue executing automatically at scheduled times');
    console.log('👋 Visit https://app.1inch.io/ to monitor or manage them manually');
    process.exit(0);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    console.log('\n💡 If this is an API error, check:');
    console.log('1. Your 1inch API key is valid');
    console.log('2. Network connectivity');
    console.log('3. Reduce order frequency to avoid rate limits');
    process.exit(1);
});
// Only run if this file is executed directly
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Fatal error:', error.message);
        process.exit(1);
    });
}
//# sourceMappingURL=quick-start-twap.js.map