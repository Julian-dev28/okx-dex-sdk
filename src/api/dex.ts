// src/api/dex.ts


import { HTTPClient } from '../core/http-client';
import { SwapParams, SlippageOptions, OKXConfig, SwapConfig } from '../types';
import base58 from "bs58";
import * as solanaWeb3 from "@solana/web3.js";
import { Connection } from "@solana/web3.js";

export class DexAPI {
    private readonly COMPUTE_UNITS = 300000;
    private readonly MAX_RETRIES = 3;

    constructor(
        private readonly client: HTTPClient,
        private readonly config: OKXConfig & SwapConfig  // Add this line
    ) { }


    // Get information about supported chains
    async getSupportedChains(chainId?: string) {
        return this.client.request('GET', '/api/v5/dex/aggregator/supported/chain',
            chainId ? { chainId } : undefined);
    }

    // Get list of supported tokens for a chain
    async getTokens(chainId: string) {
        return this.client.request('GET', '/api/v5/dex/aggregator/all-tokens', { chainId });
    }

    // Get liquidity sources for a chain
    async getLiquidity(chainId: string) {
        return this.client.request('GET', '/api/v5/dex/aggregator/get-liquidity', { chainId });
    }

    // Get quote for a token swap
    async getQuote(params: SwapParams & { slippage: string }) {
        return this.client.request('GET', '/api/v5/dex/aggregator/quote', params);
    }

    // Get swap data with transaction details
    async getSwapData(params: SwapParams & SlippageOptions) {
        // Validate slippage parameters
        if (!params.slippage && !params.autoSlippage) {
            throw new Error('Either slippage or autoSlippage must be provided');
        }

        if (params.slippage) {
            const slippageValue = parseFloat(params.slippage);
            if (isNaN(slippageValue) || slippageValue < 0 || slippageValue > 1) {
                throw new Error('Slippage must be between 0 and 1');
            }
        }

        if (params.autoSlippage && !params.maxAutoSlippageBps) {
            throw new Error('maxAutoSlippageBps must be provided when autoSlippage is enabled');
        }

        // Convert parameters for API
        const apiParams: SwapParams = {
            ...params,
            autoSlippage: params.autoSlippage ? "true" : undefined,
        };

        return this.client.request('GET', '/api/v5/dex/aggregator/swap', apiParams);
    }
    async executeSwap(params: SwapParams & SlippageOptions) {
        const swapData = await this.getSwapData(params);

        // Handle different chains
        switch (params.chainId) {
            case '501': // Solana
                return this.executeSolanaSwap(swapData, params);
            // Add other chains as needed
            default:
                throw new Error(`Chain ${params.chainId} not supported for swap execution`);
        }
    }

    private async executeSolanaSwap(swapData: any, params: SwapParams) {
        if (!this.config.solana) {
            throw new Error('Solana configuration required for Solana swaps');
        }

        const {
            connection: connectionConfig,
            privateKey,
            computeUnits = this.COMPUTE_UNITS,
            maxRetries = this.MAX_RETRIES
        } = this.config.solana;

        const connection = new Connection(connectionConfig.rpcUrl, {
            confirmTransactionInitialTimeout: connectionConfig.confirmTransactionInitialTimeout || 5000,
            wsEndpoint: connectionConfig.wsEndpoint
        });

        let retryCount = 0;
        while (retryCount < maxRetries) {
            try {
                const transactionData = swapData.data[0].tx?.data || swapData.data[0].data;
                if (!transactionData || typeof transactionData !== 'string') {
                    throw new Error("Invalid transaction data");
                }

                const recentBlockHash = await connection.getLatestBlockhash();
                const decodedTransaction = base58.decode(transactionData);
                let tx;

                try {
                    tx = solanaWeb3.VersionedTransaction.deserialize(decodedTransaction);
                    tx.message.recentBlockhash = recentBlockHash.blockhash;
                } catch (e) {
                    tx = solanaWeb3.Transaction.from(decodedTransaction);
                    tx.recentBlockhash = recentBlockHash.blockhash;
                }

                const computeBudgetIx = solanaWeb3.ComputeBudgetProgram.setComputeUnitLimit({
                    units: computeUnits
                });

                const feePayer = solanaWeb3.Keypair.fromSecretKey(
                    base58.decode(privateKey)
                );

                if (tx instanceof solanaWeb3.VersionedTransaction) {
                    tx.sign([feePayer]);
                } else {
                    tx.partialSign(feePayer);
                }

                const txId = await connection.sendRawTransaction(tx.serialize(), {
                    skipPreflight: false,
                    maxRetries: 5
                });

                const confirmation = await connection.confirmTransaction({
                    signature: txId,
                    blockhash: recentBlockHash.blockhash,
                    lastValidBlockHeight: recentBlockHash.lastValidBlockHeight
                }, 'confirmed');

                if (confirmation?.value?.err) {
                    throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
                }

                return {
                    success: true,
                    transactionId: txId,
                    explorerUrl: `https://solscan.io/tx/${txId}`
                };

            } catch (error) {
                if (retryCount === maxRetries - 1) throw error;
                retryCount++;
                await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
            }
        }
    }

}