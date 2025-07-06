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
exports.VolatilityGridQuickStartApp = void 0;
const dotenv = __importStar(require("dotenv"));
const ethers_1 = require("ethers");
const readline = __importStar(require("readline"));
const grid_1 = require("./grid");
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
const GRID_STRATEGIES = {
    '1': {
        name: 'Conservative Grid - Stable Pairs',
        description: 'Low volatility grid for stable trading pairs with tight spreads',
        config: {
            baseTokenSymbol: '1INCH',
            quoteTokenSymbol: 'USDC',
            totalAmount: '10',
            numberOfOrders: 10,
            strategyType: types_1.StrategyType.PRICE_DROP_DCA, // Used for configuration mapping
            gridLevels: 10,
            priceRange: 10, // ±10%
            profitTarget: 0.5, // 0.5% per trade
            autoRebalance: true,
            slippageTolerance: 1,
            buyPercent: 10 // Not used in grid but required for interface
        }
    },
    '2': {
        name: 'Aggressive Grid - High Volatility',
        description: 'Wide grid for volatile pairs with higher profit targets',
        config: {
            baseTokenSymbol: 'WETH',
            quoteTokenSymbol: 'USDC',
            totalAmount: '0.01',
            numberOfOrders: 3,
            strategyType: types_1.StrategyType.PRICE_DROP_DCA,
            gridLevels: 3,
            priceRange: 25, // ±25%
            profitTarget: 1.0, // 1% per trade
            autoRebalance: true,
            slippageTolerance: 2,
            buyPercent: 33.3 // 100/3
        }
    },
    '3': {
        name: 'Scalping Grid - Quick Profits',
        description: 'Dense grid with many levels for frequent small profits',
        config: {
            baseTokenSymbol: '1INCH',
            quoteTokenSymbol: 'USDC',
            totalAmount: '2',
            numberOfOrders: 5,
            strategyType: types_1.StrategyType.PRICE_DROP_DCA,
            gridLevels: 5,
            priceRange: 15, // ±15%
            profitTarget: 0.3, // 0.3% per trade
            autoRebalance: true,
            slippageTolerance: 0.5,
            buyPercent: 0.4
        }
    },
    '4': {
        name: 'Wide Range Grid - Patient Strategy',
        description: 'Wide grid for long-term volatility capture',
        config: {
            baseTokenSymbol: 'cbETH',
            quoteTokenSymbol: 'USDC',
            totalAmount: '1',
            numberOfOrders: 4,
            strategyType: types_1.StrategyType.PRICE_DROP_DCA,
            gridLevels: 4,
            priceRange: 40, // ±40%
            profitTarget: 2.0, // 2% per trade
            autoRebalance: false, // Manual rebalancing for long-term
            slippageTolerance: 1.5,
            buyPercent: 25 // 100/12
        }
    }
};
class VolatilityGridQuickStartApp {
    constructor() {
        this.provider = new ethers_1.ethers.providers.JsonRpcProvider(BASE_CONFIG.rpcUrl);
        this.signer = new ethers_1.ethers.Wallet(BASE_CONFIG.privateKey, this.provider);
    }
    async run() {
        try {
            console.log('🌈 Prism Orders - Volatility Grid Strategy Quick Start');
            console.log('=====================================================\n');
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
        console.log('💡 Volatility Grid Strategy');
        console.log('Place buy and sell orders around current price to profit from volatility');
        console.log('✨ Perfect for sideways markets and capturing price oscillations\n');
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
        if (ethBalance < 0.002) {
            console.warn('⚠️  Low ETH balance - you may need more ETH for gas fees');
        }
        console.log('');
    }
    async selectStrategy() {
        console.log('📋 Pre-configured Volatility Grid Strategies:\n');
        Object.entries(GRID_STRATEGIES).forEach(([id, strategy]) => {
            console.log(`${id}. ${strategy.name}`);
            console.log(`   💰 ${strategy.config.totalAmount} ${strategy.config.baseTokenSymbol} ↔ ${strategy.config.quoteTokenSymbol}`);
            console.log(`   📊 ${strategy.config.gridLevels} levels, ±${strategy.config.priceRange}% range`);
            console.log(`   🎯 ${strategy.config.profitTarget}% profit target per trade`);
            console.log(`   🔄 Auto-rebalance: ${strategy.config.autoRebalance ? 'Yes' : 'No'}`);
            console.log(`   📝 ${strategy.description}\n`);
        });
        console.log('0. Interactive mode (configure manually)');
        console.log('tokens. Show how to get testnet tokens\n');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        return new Promise(resolve => {
            rl.question('Select a Volatility Grid strategy (0-4, tokens): ', (answer) => {
                rl.close();
                resolve(answer.trim());
            });
        });
    }
    showTokenAcquisitionGuide() {
        console.log('🪙 How to Get Base Mainnet Tokens for Grid Trading');
        console.log('================================================\n');
        console.log('📍 Base Mainnet Token Acquisition:');
        console.log('1. Bridge ETH to Base via https://bridge.base.org/');
        console.log('2. Swap ETH for other tokens on Base DEXs:');
        console.log('   - Uniswap V3: https://app.uniswap.org/');
        console.log('   - SushiSwap: https://www.sushi.com/');
        console.log('   - 1inch: https://app.1inch.io/');
        console.log('3. For grid trading, you need BOTH tokens:');
        console.log('   - Base token (e.g., 1INCH, WETH) for sell orders');
        console.log('   - Quote token (e.g., USDC, DAI) for buy orders\n');
        console.log('💡 Grid Trading Tips:');
        console.log('• Start with volatile but liquid pairs');
        console.log('• Ensure you have both tokens in your wallet');
        console.log('• Consider using stablecoins as quote tokens');
        console.log('• Monitor grid performance regularly');
        console.log('• Grid works best in sideways/ranging markets\n');
        console.log('💰 Recommended amounts for testing:');
        console.log('   - 0.01 ETH minimum for gas fees');
        console.log('   - 50-200 1INCH + 100-500 USDC for conservative grid');
        console.log('   - 0.1-0.5 WETH + 200-1000 USDC for aggressive grid');
        console.log('   - Always keep some ETH for gas fees\n');
        console.log('⚠️  Important Notes:');
        console.log('   - Grid trading requires active monitoring');
        console.log('   - Works best in volatile but ranging markets');
        console.log('   - Trending markets may trigger many one-sided orders');
        console.log('   - Auto-rebalancing helps but isn\'t foolproof');
    }
    async runPreConfiguredStrategy(choice) {
        const strategy = GRID_STRATEGIES[choice];
        if (!strategy) {
            throw new Error('Invalid strategy selection');
        }
        console.log(`\n🚀 Launching: ${strategy.name}`);
        console.log('=====================================\n');
        // Convert pre-configured strategy to StrategyConfig
        const strategyConfig = {
            fromToken: BASE_TOKENS[strategy.config.baseTokenSymbol],
            toToken: BASE_TOKENS[strategy.config.quoteTokenSymbol],
            totalAmount: strategy.config.totalAmount,
            numberOfOrders: strategy.config.gridLevels,
            strategyType: strategy.config.strategyType,
            priceDropPercent: strategy.config.priceRange,
            buyPercent: strategy.config.buyPercent,
            slippageTolerance: strategy.config.slippageTolerance
        };
        const confirmed = await this.confirmStrategy(strategyConfig, strategy.config);
        if (!confirmed) {
            console.log('❌ Strategy cancelled by user');
            return;
        }
        await this.executeGridStrategy(strategyConfig, strategy.config);
    }
    async runInteractiveMode() {
        console.log('\n🛠️ Interactive Volatility Grid Configuration');
        console.log('===========================================\n');
        const gridStrategy = new grid_1.VolatilityGridStrategy(this.provider, this.signer);
        await gridStrategy.initialize();
        await gridStrategy.executeGridStrategy();
    }
    async confirmStrategy(config, gridConfig) {
        console.log('📊 Volatility Grid Strategy Summary:');
        console.log(`  Trading Pair: ${config.fromToken.symbol} ↔ ${config.toToken.symbol}`);
        console.log(`  Base Amount: ${config.totalAmount} ${config.fromToken.symbol}`);
        console.log(`  Quote Amount: ${config.totalAmount} ${config.toToken.symbol} (estimated)`);
        console.log(`  Grid Levels: ${gridConfig.gridLevels}`);
        console.log(`  Price Range: ±${gridConfig.priceRange}%`);
        console.log(`  Profit Target: ${gridConfig.profitTarget}% per trade`);
        console.log(`  Auto-rebalance: ${gridConfig.autoRebalance ? 'Enabled' : 'Disabled'}`);
        console.log(`  Slippage Tolerance: ${config.slippageTolerance}%\n`);
        // Check token balances
        try {
            const walletAddress = await this.signer.getAddress();
            // Check base token balance
            const baseTokenContract = new ethers_1.ethers.Contract(config.fromToken.address, ['function balanceOf(address) view returns (uint256)'], this.provider);
            const baseBalance = await baseTokenContract.balanceOf(walletAddress);
            const baseBalanceFormatted = parseFloat(ethers_1.ethers.utils.formatUnits(baseBalance, config.fromToken.decimals));
            // Check quote token balance
            const quoteTokenContract = new ethers_1.ethers.Contract(config.toToken.address, ['function balanceOf(address) view returns (uint256)'], this.provider);
            const quoteBalance = await quoteTokenContract.balanceOf(walletAddress);
            const quoteBalanceFormatted = parseFloat(ethers_1.ethers.utils.formatUnits(quoteBalance, config.toToken.decimals));
            console.log(`💰 Current Balances:`);
            console.log(`  ${config.fromToken.symbol}: ${baseBalanceFormatted.toFixed(6)}`);
            console.log(`  ${config.toToken.symbol}: ${quoteBalanceFormatted.toFixed(6)}`);
            const requiredBaseAmount = parseFloat(config.totalAmount);
            const requiredQuoteAmount = parseFloat(config.totalAmount); // Simplified assumption
            if (baseBalanceFormatted < requiredBaseAmount) {
                console.warn(`⚠️  Insufficient ${config.fromToken.symbol} balance! Required: ${requiredBaseAmount}`);
            }
            if (quoteBalanceFormatted < requiredQuoteAmount) {
                console.warn(`⚠️  Insufficient ${config.toToken.symbol} balance! Required: ${requiredQuoteAmount}`);
            }
        }
        catch (error) {
            console.warn('⚠️ Could not check token balances');
        }
        console.log('\n🎯 Grid Strategy Explanation:');
        console.log('• Places buy orders below current price');
        console.log('• Places sell orders above current price');
        console.log('• Profits from price oscillations in both directions');
        console.log('• Auto-rebalances when orders fill (if enabled)');
        console.log('• Best for ranging/sideways markets\n');
        return await this.askConfirmation('Proceed with this Volatility Grid strategy?');
    }
    async executeGridStrategy(config, gridConfig) {
        try {
            console.log('\n🔧 Initializing Volatility Grid Strategy...');
            const gridStrategy = new grid_1.VolatilityGridStrategy(this.provider, this.signer);
            gridStrategy.setConfiguration(config);
            // Validate configuration
            const validation = await gridStrategy.validateConfigurationWithResult();
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
            await gridStrategy.executeGridStrategy();
            // Show monitoring instructions
            this.showGridMonitoringInstructions();
            // Start advanced monitoring if requested
            const startAdvancedMonitoring = await this.askConfirmation('\nStart advanced monitoring dashboard?');
            if (startAdvancedMonitoring) {
                await this.startAdvancedGridMonitoring(gridStrategy);
            }
        }
        catch (error) {
            console.error('❌ Volatility Grid strategy execution failed:', error.message);
            // Provide helpful error context
            if (error.message.includes('insufficient')) {
                console.log('\n💡 Common solutions:');
                console.log('1. Check your token balances for BOTH base and quote tokens');
                console.log('2. Approve tokens at https://app.1inch.io/');
                console.log('3. Ensure you have enough ETH for gas fees');
                console.log('4. Consider reducing grid size or amount per order');
            }
            else if (error.message.includes('API')) {
                console.log('\n💡 API troubleshooting:');
                console.log('1. Check your 1inch API key');
                console.log('2. Verify network connectivity');
                console.log('3. Reduce grid levels to avoid rate limits');
            }
            throw error;
        }
    }
    showGridMonitoringInstructions() {
        console.log('\n📖 Volatility Grid Monitoring Instructions:');
        console.log('==========================================');
        console.log('1. Your grid orders are now active on 1inch protocol');
        console.log('2. Buy orders execute when price drops to grid levels');
        console.log('3. Sell orders execute when price rises to grid levels');
        console.log('4. Monitor progress at https://app.1inch.io/ (connect your wallet)');
        console.log('5. Auto-rebalancing creates new orders when old ones fill');
        console.log('6. You can manually cancel orders anytime (gas fee applies)');
        console.log('7. Grid profits from price volatility in both directions\n');
        console.log('📊 Grid Strategy Behavior:');
        console.log('• Sideways market: Maximum profitability');
        console.log('• Trending up: Sell orders fill, need rebalancing');
        console.log('• Trending down: Buy orders fill, need rebalancing');
        console.log('• High volatility: Frequent trades, higher profits');
        console.log('• Low volatility: Fewer trades, patient strategy\n');
        console.log('⚠️  Risk Management:');
        console.log('• Monitor for strong trending moves');
        console.log('• Consider manual rebalancing in extreme trends');
        console.log('• Keep some ETH for gas fees');
        console.log('• Grid works best with adequate liquidity');
    }
    async startAdvancedGridMonitoring(gridStrategy) {
        console.log('\n🔬 Advanced Grid Monitoring Dashboard');
        console.log('====================================');
        console.log('• Real-time order status tracking');
        console.log('• Profit/loss calculations');
        console.log('• Grid level visualization');
        console.log('• Auto-rebalancing notifications');
        console.log('• Performance analytics\n');
        const monitoringInterval = setInterval(async () => {
            try {
                console.clear();
                console.log('🌈 Volatility Grid - Live Dashboard');
                console.log('===================================\n');
                // Get current stats
                const stats = gridStrategy.getGridStats();
                const detailedStatus = await gridStrategy.getDetailedStatus();
                // Display overview
                console.log('📊 Grid Overview:');
                console.log(`  Total Orders: ${stats.totalOrders}`);
                console.log(`  Active: ${stats.activeOrders} | Filled: ${stats.filledOrders}`);
                console.log(`  Buy Orders: ${stats.buyOrders} | Sell Orders: ${stats.sellOrders}`);
                console.log(`  Current Price: ${stats.currentPrice.toFixed(6)}`);
                console.log(`  Price Range: ±${stats.priceRange}%`);
                console.log(`  Total Profit: ${stats.totalProfit.toFixed(4)}\n`);
                // Display performance
                console.log('📈 Performance:');
                console.log(`  Total Trades: ${detailedStatus.performance.totalTrades}`);
                console.log(`  Successful: ${detailedStatus.performance.successfulTrades}`);
                console.log(`  Average Profit: ${detailedStatus.performance.averageProfit.toFixed(4)}\n`);
                // Display grid levels status
                console.log('🎯 Grid Levels Status:');
                console.log('Level | Buy Price  | Sell Price | Buy Active | Sell Active');
                console.log('------|------------|------------|------------|------------');
                detailedStatus.gridLevels
                    .sort((a, b) => b.level - a.level)
                    .slice(0, 10) // Show top 10 levels
                    .forEach(level => {
                    const buyIcon = level.hasActiveBuy ? '✅' : '❌';
                    const sellIcon = level.hasActiveSell ? '✅' : '❌';
                    console.log(`${level.level.toString().padStart(5)} | ${level.buyPrice.toFixed(6).padStart(10)} | ${level.sellPrice.toFixed(6).padStart(10)} | ${buyIcon.padStart(10)} | ${sellIcon.padStart(11)}`);
                });
                console.log('\n⏰ Last updated:', new Date().toLocaleTimeString());
                console.log('Press Ctrl+C to stop monitoring');
            }
            catch (error) {
                console.error('❌ Monitoring error:', error.message);
            }
        }, 15000); // Update every 15 seconds
        // Handle graceful shutdown
        process.on('SIGINT', () => {
            clearInterval(monitoringInterval);
            console.log('\n\n🛑 Grid monitoring stopped');
            console.log('💡 Your grid orders remain active on 1inch');
            console.log('👋 Visit https://app.1inch.io/ to manage them manually');
            process.exit(0);
        });
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
exports.VolatilityGridQuickStartApp = VolatilityGridQuickStartApp;
// Utility functions for help commands
function showHelp() {
    console.log('🌈 1inch Volatility Grid Strategy - Real Integration Help');
    console.log('========================================================\n');
    console.log('Usage:');
    console.log('  npm run grid                     # Run Volatility Grid quick start wizard');
    console.log('  npm run grid --help              # Show this help');
    console.log('  npm run grid --version           # Show version\n');
    console.log('Pre-configured Grid strategies (Real 1inch Integration):');
    Object.entries(GRID_STRATEGIES).forEach(([id, strategy]) => {
        console.log(`  ${id}. ${strategy.name} (${strategy.config.gridLevels} levels, ±${strategy.config.priceRange}%)`);
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
    console.log('Volatility Grid Strategy Benefits:');
    console.log('• Profits from price volatility in both directions');
    console.log('• Automated buy low, sell high execution');
    console.log('• Works best in ranging/sideways markets');
    console.log('• Auto-rebalancing when orders fill');
    console.log('• Customizable profit targets and risk levels');
    console.log('• Real-time monitoring and performance tracking\n');
    console.log('Risk Considerations:');
    console.log('• Requires both base and quote tokens');
    console.log('• Performance depends on market volatility');
    console.log('• Strong trends may cause one-sided execution');
    console.log('• Impermanent loss risk in trending markets');
    console.log('• Gas costs for frequent rebalancing');
}
function showVersion() {
    console.log('Prism Orders Volatility Grid Strategy v3.0.0');
    console.log('Base Mainnet + 1inch Limit Order Protocol v4');
    console.log('Powered by @1inch/limit-order-sdk');
}
// Advanced grid analytics
function showGridAnalytics() {
    console.log('📊 Volatility Grid Analytics Guide');
    console.log('=================================\n');
    console.log('Key Metrics to Monitor:');
    console.log('• Grid Efficiency: % of orders that execute profitably');
    console.log('• Rebalancing Frequency: How often the grid needs adjustment');
    console.log('• Price Range Utilization: Which grid levels are most active');
    console.log('• Profit per Trade: Average profit from each executed order');
    console.log('• Market Trend Impact: How trends affect grid performance\n');
    console.log('Optimization Tips:');
    console.log('• Adjust grid spacing based on token volatility');
    console.log('• Use tighter grids for stable pairs');
    console.log('• Use wider grids for volatile pairs');
    console.log('• Monitor and adjust profit targets based on market conditions');
    console.log('• Consider market trend when setting price ranges');
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
    if (args.includes('--analytics') || args.includes('-a')) {
        showGridAnalytics();
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
    // Run the Volatility Grid application
    const app = new VolatilityGridQuickStartApp();
    await app.run();
}
// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n🛑 Volatility Grid Strategy shutting down gracefully...');
    console.log('💡 Your grid orders remain active on 1inch');
    console.log('🔄 They will continue executing automatically when price conditions are met');
    console.log('👋 Visit https://app.1inch.io/ to monitor or manage them manually');
    process.exit(0);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    console.log('\n💡 If this is an API error, check:');
    console.log('1. Your 1inch API key is valid');
    console.log('2. Network connectivity');
    console.log('3. Reduce grid levels to avoid rate limits');
    console.log('4. Ensure you have both base and quote tokens');
    process.exit(1);
});
// Only run if this file is executed directly
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Fatal error:', error.message);
        process.exit(1);
    });
}
//# sourceMappingURL=quick-start-grid.js.map