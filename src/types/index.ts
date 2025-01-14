// src/types/index.ts

export interface OKXConfig {
    apiKey: string;
    secretKey: string;
    apiPassphrase: string;
    projectId: string;
    baseUrl?: string;
    maxRetries?: number;
    timeout?: number;
    solana?: SolanaConfig;
}

export interface SolanaConfig {
    connection: {
        rpcUrl: string;
        wsEndpoint?: string;
        confirmTransactionInitialTimeout?: number;
    };
    privateKey: string;
    computeUnits?: number;
    maxRetries?: number;
}

// Base params interface without index signature
export interface BaseParams {
    chainId: string;
    fromTokenAddress: string;
    toTokenAddress: string;
    amount: string;
    userWalletAddress?: string;
}

// API request parameters interface with string values
export interface APIRequestParams {
    [key: string]: string | undefined;
}

// Slippage options that will be converted to API format
export interface SlippageOptions {
    slippage?: string;
    autoSlippage?: boolean;
    maxAutoSlippageBps?: string;
}

// Combined params for API requests
export type SwapParams = BaseParams & Partial<SlippageOptions>;

// Quote specific params
export interface QuoteParams extends BaseParams {
    slippage: string;
}

export interface TokenInfo {
    tokenSymbol: string;
    decimal: string;
    tokenUnitPrice: string;
}

export interface QuoteData {
    fromToken: TokenInfo;
    toToken: TokenInfo;
    tx?: {
        data: string;
    };
    data?: string;
    routerResult: {
        toTokenAmount: string;
    };
    priceImpactPercentage?: string;
}

export interface APIResponse<T> {
    code: string;
    msg: string;
    data: T[];
}

export interface SwapResult {
    success: boolean;
    transactionId: string;
    explorerUrl: string;
}

// Token metadata for frontend display
export interface TokenMetadata {
    symbol: string;
    decimals: number;
    price: string;
}