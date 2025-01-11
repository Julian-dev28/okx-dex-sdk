// src/core/client.ts

import { OKXConfig } from '../types';
import { HTTPClient } from './http-client';
import { DexAPI } from '../api/dex';
import { BridgeAPI } from '../api/bridge';

export class OKXDexClient {
    private readonly config: OKXConfig;
    private readonly httpClient: HTTPClient;
    public readonly dex: DexAPI;
    public readonly bridge: BridgeAPI;

    constructor(config: OKXConfig) {
        this.config = {
            baseUrl: 'https://www.okx.com',
            maxRetries: 3,
            timeout: 30000,
            ...config
        };
        this.httpClient = new HTTPClient(this.config);
        this.dex = new DexAPI(this.httpClient, this.config);
        this.bridge = new BridgeAPI(this.httpClient);
    }
}