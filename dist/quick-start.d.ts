#!/usr/bin/env node
import { StrategyConfig, TokenInfo } from './types';
interface BaseConfig {
    chainId: number;
    rpcUrl: string;
    privateKey: string;
    walletAddress: string;
    oneInchApiKey: string;
}
declare const BASE_CONFIG: BaseConfig;
declare const BASE_TOKENS: Record<string, TokenInfo>;
interface PreConfiguredStrategy {
    name: string;
    description: string;
    config: Omit<StrategyConfig, 'fromToken' | 'toToken'> & {
        fromTokenSymbol: keyof typeof BASE_TOKENS;
        toTokenSymbol: keyof typeof BASE_TOKENS;
    };
}
declare const EXAMPLE_STRATEGIES: Record<string, PreConfiguredStrategy>;
declare class QuickStartApp {
    private provider;
    private signer;
    constructor();
    run(): Promise<void>;
    private displayWelcome;
    private checkWalletStatus;
    private check1inchConfiguration;
    private showTokenInfo;
    private getUserChoice;
    private getStrategyDescription;
    private showTokenAcquisitionGuide;
    private runPreConfiguredStrategy;
    private runInteractiveMode;
    private executeStrategyWithRealIntegration;
    private showManualMonitoringInstructions;
    private checkOrderStatusFromAPI;
    private askConfirmation;
}
export { QuickStartApp, BASE_CONFIG, BASE_TOKENS, EXAMPLE_STRATEGIES };
//# sourceMappingURL=quick-start.d.ts.map