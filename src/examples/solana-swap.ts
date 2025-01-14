// src/examples/solana-swap.ts
import { OKXDexClient } from '../index';
import { APIResponse, QuoteData, SwapResult, TokenInfo } from '../types';
import 'dotenv/config';

// Validate environment variables
const requiredEnvVars = [
    'OKX_API_KEY',
    'OKX_SECRET_KEY',
    'OKX_API_PASSPHRASE',
    'OKX_PROJECT_ID',
    'WALLET_ADDRESS',
    'PRIVATE_KEY',
    'SOLANA_RPC_URL'
];

for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
    }
}

const client = new OKXDexClient({
    apiKey: process.env.OKX_API_KEY!,
    secretKey: process.env.OKX_SECRET_KEY!,
    apiPassphrase: process.env.OKX_API_PASSPHRASE!,
    projectId: process.env.OKX_PROJECT_ID!,
    solana: {
        connection: {
            rpcUrl: process.env.SOLANA_RPC_URL!,
            wsEndpoint: process.env.SOLANA_WS_URL,
            confirmTransactionInitialTimeout: 5000
        },
        privateKey: process.env.PRIVATE_KEY!,
        computeUnits: 300000,
        maxRetries: 3
    }
});

interface TokenDetails {
    symbol: string;
    decimals: number;
    price: string;
}

async function getTokenInfo(fromTokenAddress: string, toTokenAddress: string): Promise<{
    fromToken: TokenDetails;
    toToken: TokenDetails;
}> {
    try {
        const quote = await client.dex.getQuote({
            chainId: '501',
            fromTokenAddress,
            toTokenAddress,
            amount: '1000000', // small amount just to get token info
            slippage: '0.5'
        });

        const quoteData = quote.data[0];

        return {
            fromToken: {
                symbol: quoteData.fromToken.tokenSymbol,
                decimals: parseInt(quoteData.fromToken.decimal),
                price: quoteData.fromToken.tokenUnitPrice
            },
            toToken: {
                symbol: quoteData.toToken.tokenSymbol,
                decimals: parseInt(quoteData.toToken.decimal),
                price: quoteData.toToken.tokenUnitPrice
            }
        };
    } catch (error) {
        console.error('Error getting token info:', error);
        throw error;
    }
}

async function main() {
    try {
        const fromTokenAddress = '11111111111111111111111111111111'; // SOL
        const toTokenAddress = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC
        const amount = '.01'; // amount in SOL

        // Get token information
        console.log("Getting token information...");
        const tokenInfo = await getTokenInfo(fromTokenAddress, toTokenAddress);
        console.log(`From: ${tokenInfo.fromToken.symbol} (${tokenInfo.fromToken.decimals} decimals)`);
        console.log(`To: ${tokenInfo.toToken.symbol} (${tokenInfo.toToken.decimals} decimals)`);

        // Convert amount to base units
        const rawAmount = (parseFloat(amount) * Math.pow(10, tokenInfo.fromToken.decimals)).toString();
        console.log(`Amount in ${tokenInfo.fromToken.symbol} base units:`, rawAmount);

        // Execute the swap
        console.log("\nExecuting swap...");
        const result = await client.dex.executeSwap({
            chainId: '501',
            fromTokenAddress,
            toTokenAddress,
            amount: rawAmount,
            slippage: '0.5',
            userWalletAddress: process.env.WALLET_ADDRESS
        });

        console.log('\nSwap completed successfully!');
        console.log('Transaction ID:', result.transactionId);
        console.log('Explorer URL:', result.explorerUrl);

    } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
    }
}

main();