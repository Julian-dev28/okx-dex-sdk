// src/api/dex.ts
import { HTTPClient } from '../core/http-client';
import {
    SwapParams,
    SlippageOptions,
    OKXConfig,
    QuoteParams,
    QuoteData,
    APIResponse,
    APIRequestParams,
    SwapResult
} from '../types';
import base58 from "bs58";
import * as solanaWeb3 from "@solana/web3.js";
import { Connection } from "@solana/web3.js";

export class DexAPI {
    private readonly COMPUTE_UNITS = 300000;
    private readonly MAX_RETRIES = 3;

    constructor(
        private readonly client: HTTPClient,
        private readonly config: OKXConfig
    ) { }

    // Convert params to API format
    private toAPIParams(params: Record<string, any>): APIRequestParams {
        const apiParams: APIRequestParams = {};

        for (const [key, value] of Object.entries(params)) {
            if (value !== undefined) {
                if (key === 'autoSlippage') {
                    apiParams[key] = value ? 'true' : 'false';
                } else {
                    apiParams[key] = String(value);
                }
            }
        }

        return apiParams;
    }

    async getQuote(params: QuoteParams): Promise<APIResponse<QuoteData>> {
        return this.client.request('GET', '/api/v5/dex/aggregator/quote',
            this.toAPIParams(params));
    }

    async getLiquidity(chainId: string): Promise<APIResponse<QuoteData>> {
        return this.client.request('GET', '/api/v5/dex/aggregator/get-liquidity',
            this.toAPIParams({ chainId }));
    }

    async getSupportedChains(chainId: string): Promise<APIResponse<QuoteData>> {
        return this.client.request('GET', '/api/v5/dex/aggregator/supported/chain',
            this.toAPIParams({ chainId }));
    }

    async getSwapData(params: SwapParams): Promise<APIResponse<QuoteData>> {
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

        return this.client.request('GET', '/api/v5/dex/aggregator/swap',
            this.toAPIParams(params));
    }

    async executeSwap(params: SwapParams): Promise<SwapResult> {
        const swapData = await this.getSwapData(params);

        switch (params.chainId) {
            case '501': // Solana
                return this.executeSolanaSwap(swapData, params);
            default:
                throw new Error(`Chain ${params.chainId} not supported for swap execution`);
        }
    }

    private async executeSolanaSwap(swapData: APIResponse<QuoteData>, params: SwapParams): Promise<SwapResult> {
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

        throw new Error("Max retries exceeded");
    }
}