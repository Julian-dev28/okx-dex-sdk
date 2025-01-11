// example.ts or test.ts
import { OKXDexClient } from './index';
import 'dotenv/config';

const client = new OKXDexClient({
    apiKey: process.env.OKX_API_KEY!,         // Using ! tells TypeScript we know this exists
    secretKey: process.env.OKX_SECRET_KEY!,
    apiPassphrase: process.env.OKX_API_PASSPHRASE!,
    projectId: process.env.OKX_PROJECT_ID!
});

async function main() {
    try {
        // Get supported chains
        const chains = await client.dex.getSupportedChains();
        console.log('Supported chains:', chains);

        // Get a quote
        const quote = await client.dex.getQuote({
            chainId: '501',
            fromTokenAddress: 'So11111111111111111111111111111111111111112',
            toTokenAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
            amount: '1000000000',
            slippage: '0.1'
        });
        console.log('Quote:', quote);
    } catch (error) {
        console.error('Error:', error);
    }
}

main();