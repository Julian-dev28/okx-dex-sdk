// src/types/index.ts

// Solana specific configurations
export interface SolanaConnectionConfig {
    rpcUrl: string;
    wsEndpoint?: string;
    confirmTransactionInitialTimeout?: number;
}

export interface SolanaSwapConfig {
    connection: SolanaConnectionConfig;
    privateKey: string;
    computeUnits?: number;
    maxRetries?: number;
}

// Update the OKXConfig to include optional solana config
export interface OKXConfig {
    apiKey: string;
    secretKey: string;
    apiPassphrase: string;
    projectId: string;
    baseUrl?: string;
    maxRetries?: number;
    timeout?: number;
    solana?: SolanaSwapConfig;  // Add this line
}

// Combined configuration including chain-specific configs
export interface SwapConfig {
    solana?: SolanaSwapConfig;
}

// Parameters for token swaps
export interface BaseSwapParams extends Record<string, string | undefined> {
    chainId: string;
    fromTokenAddress: string;
    toTokenAddress: string;
    amount: string;
    userWalletAddress?: string;
}

// Slippage configuration options
export interface SlippageOptions {
    slippage?: string;
    autoSlippage?: boolean;
    maxAutoSlippageBps?: string;
}

// Full swap parameters
export interface SwapParams extends BaseSwapParams, Omit<SlippageOptions, 'autoSlippage'> {
    autoSlippage?: string;
    swapReceiverAddress?: string;
    referrerAddress?: string;
    feePercent?: string;
    gasLimit?: string;
    gasLevel?: string;
    dexIds?: string;
    priceImpactProtectionPercentage?: string;
}

// Swap execution response
export interface SwapExecutionResult {
    success: boolean;
    transactionId: string;
    explorerUrl: string;
}