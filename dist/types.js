"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SWAP_API_BASE = exports.LIMIT_ORDER_API_BASE = exports.ONEINCH_API_BASE = exports.LIMIT_ORDER_PROTOCOL_ADDRESSES = exports.Address = exports.DCAError = exports.OrderStatus = exports.StrategyType = void 0;
var StrategyType;
(function (StrategyType) {
    StrategyType[StrategyType["PRICE_DROP_DCA"] = 1] = "PRICE_DROP_DCA";
    StrategyType[StrategyType["PRICE_RISE_DCA"] = 2] = "PRICE_RISE_DCA";
    StrategyType[StrategyType["TIME_BASED_DCA"] = 3] = "TIME_BASED_DCA";
})(StrategyType || (exports.StrategyType = StrategyType = {}));
var OrderStatus;
(function (OrderStatus) {
    OrderStatus["ACTIVE"] = "ACTIVE";
    OrderStatus["PARTIALLY_FILLED"] = "PARTIALLY_FILLED";
    OrderStatus["FILLED"] = "FILLED";
    OrderStatus["CANCELLED"] = "CANCELLED";
    OrderStatus["EXPIRED"] = "EXPIRED";
    OrderStatus["UNKNOWN"] = "UNKNOWN";
})(OrderStatus || (exports.OrderStatus = OrderStatus = {}));
class DCAError extends Error {
    constructor(message, code, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = 'DCAError';
    }
}
exports.DCAError = DCAError;
// Address class for 1inch SDK compatibility
class Address {
    constructor(value) {
        this.value = value;
        if (!value || !this.isValidAddress(value)) {
            throw new Error(`Invalid address: ${value}`);
        }
    }
    isValidAddress(address) {
        return /^0x[a-fA-F0-9]{40}$/.test(address);
    }
    toString() {
        return this.value;
    }
}
exports.Address = Address;
// 1inch Protocol Addresses for different chains
exports.LIMIT_ORDER_PROTOCOL_ADDRESSES = {
    1: '0x111111125421cA6dc452d289314280a0f8842A65', // Ethereum
    56: '0x111111125421cA6dc452d289314280a0f8842A65', // BSC
    137: '0x111111125421cA6dc452d289314280a0f8842A65', // Polygon
    8453: '0x111111125421cA6dc452d289314280a0f8842A65', // Base
    42161: '0x111111125421cA6dc452d289314280a0f8842A65', // Arbitrum
    10: '0x111111125421cA6dc452d289314280a0f8842A65', // Optimism
    43114: '0x111111125421cA6dc452d289314280a0f8842A65', // Avalanche
    250: '0x111111125421cA6dc452d289314280a0f8842A65', // Fantom
};
// API Base URLs
exports.ONEINCH_API_BASE = 'https://api.1inch.dev';
const LIMIT_ORDER_API_BASE = (chainId) => `${exports.ONEINCH_API_BASE}/orderbook/v4.0/${chainId}`;
exports.LIMIT_ORDER_API_BASE = LIMIT_ORDER_API_BASE;
const SWAP_API_BASE = (chainId) => `${exports.ONEINCH_API_BASE}/swap/v6.0/${chainId}`;
exports.SWAP_API_BASE = SWAP_API_BASE;
//# sourceMappingURL=types.js.map