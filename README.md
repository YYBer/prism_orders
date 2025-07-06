# 🌈 Prism Orders

Prism Orders is a smart execution strategy toolkit built on top of the **1inch Limit Order Protocol v4**. It enables users to execute sophisticated automated trading strategies with precision control and beautiful UX.

---

## 🧠 Three Core Trading Strategies

### 🕒 TWAP (Time-Weighted Average Price)
Split large orders into smaller chunks executed at regular intervals to minimize market impact and reduce slippage. Perfect for large position entries without moving the market.

**How it works:** Divides your total investment into N equal parts, executing one order every X hours/minutes to achieve average price over time.

### 📉 DCA (Dollar-Cost Averaging) / Hodl Ladder
Automatically accumulate assets at strategic price levels using smart limit orders. Two modes available:

- **Price Drop DCA:** Place buy orders at predetermined lower price levels (e.g., buy 20% of remaining funds when price drops 5%)
- **Price Rise DCA:** Buy on upward momentum at specific price increases (e.g., buy when price rises 10%)
- **Time-based DCA:** Regular interval purchases regardless of price

### 📊 Grid Trading Strategy
Create a grid of buy and sell orders around current market price to profit from market volatility. Orders automatically rebalance as they execute.

**How it works:** Places multiple limit orders above and below current price, automatically creating new orders as old ones fill, capturing profits from price oscillations.

---

## 🚀 Advanced Features

- **💸 Flexible Configuration**: Set total investment, asset pairs, order count, and trigger conditions
- **⏱️ Real-time Execution**: Leverages 1inch's advanced limit order infrastructure
- **🔄 Auto-rebalancing**: Automatically creates new orders as existing ones execute
- **📊 Live Monitoring**: Real-time tracking of active, filled, and expired orders via 1inch API
- **🧹 Smart Cleanup**: Automatic removal of expired or invalid orders
- **⚡ Gas Optimization**: Intelligent gas price management and batch operations
- **🛡️ Risk Management**: Built-in slippage protection and position sizing controls
- **📱 Beautiful UI**: Clean, intuitive interface for strategy configuration and monitoring

---

## 🛠 Technical Architecture

- **Smart Contracts**: 1inch Limit Order Protocol v4 (Battle-tested, audited)
- **Frontend**: React + TypeScript + TailwindCSS
- **Blockchain**: Multi-chain support (Ethereum, Base, Polygon, Arbitrum, etc.)
- **APIs**: Direct integration with 1inch orderbook and price feeds
- **Automation**: On-chain order execution with off-chain monitoring
- **Security**: Non-custodial - you maintain full control of your funds

---

## 🎯 Perfect For

- **Large Traders**: Execute big orders without slippage using TWAP
- **DCA Enthusiasts**: Automate your dollar-cost averaging strategies
- **Active Traders**: Capture volatility profits with grid strategies
- **DeFi Users**: Professional-grade tools with retail-friendly UX
- **Portfolio Managers**: Systematic entry/exit strategies

---

## 🌟 Why Prism Orders?

1. **Non-Custodial**: Your funds never leave your wallet
2. **Battle-Tested**: Built on 1inch's proven infrastructure
3. **Gas Efficient**: Optimized for minimal transaction costs
4. **Transparent**: Open-source with clear execution logic
5. **Flexible**: Customizable strategies for any market condition
6. **Professional**: Institutional-grade features for retail users

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Add your PRIVATE_KEY and ONEINCH_API_KEY

# Run interactive setup
npm run dca

npm run twap

npm run grid
```

---

## 📋 Requirements

- Node.js 16+
- 1inch API Key (free at [portal.1inch.dev](https://portal.1inch.dev/))
- Wallet with tokens on supported networks
- ETH for gas fees

---

## 🔗 Links

- **1inch Protocol**: [app.1inch.io](https://app.1inch.io/)
- **Documentation**: [docs.1inch.io](https://docs.1inch.io/)
- **API Portal**: [portal.1inch.dev](https://portal.1inch.dev/)
- **GitHub**: [github.com/yyber/prism-orders](https://github.com/yyber/prism-orders)

---

## ⚠️ Disclaimer

This software is for educational and research purposes. Trading involves risk. Always test with small amounts first and understand the strategies before deploying significant capital.