# 🌈 Prism Orders

Prism Orders is a smart execution strategy toolkit built on top of the **1inch Limit Order Protocol**. It enables users to execute:

- **Time-Weighted Average Price (TWAP)** orders
- **Hodl Ladder** (Price-Based DCA) strategies

With a beautiful UI, clean UX, and auto-cleanup of expired orders, Prism Orders is designed for DeFi users who want fine-grained control over their trade execution.

---

## 🧠 Core Concepts

### TWAP Strategy
Split a large order into smaller ones and execute them over time to avoid slippage and price impact.

### Hodl Ladder Strategy
Place a sequence of limit orders at predefined lower prices to accumulate an asset gradually as the price drops.

---

## 🚀 Features

- 💸 Configure total investment, asset pair, number of steps
- ⏱️ TWAP: Interval-based order scheduling
- 📉 Ladder: Price-based DCA order placement
- 🔄 Auto-cleanup of expired or unfilled orders
- 📊 Real-time visualization of active, filled, and expired orders

---

## 🛠 Tech Stack

- **Frontend:** React + TailwindCSS + Ethers.js
- **Smart Contracts:** 1inch Limit Order Protocol
- **Automation:** On-chain timestamp comparison for cleanup logic

---