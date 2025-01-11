// src/core/http-client.ts
import CryptoJS from 'crypto-js';
import { OKXConfig } from '../types';

export class HTTPClient {
    private readonly config: OKXConfig;

    constructor(config: OKXConfig) {
        this.config = {
            baseUrl: 'https://www.okx.com',
            maxRetries: 3,
            timeout: 30000,
            ...config
        };
    }

    private getHeaders(timestamp: string, method: string, path: string, queryString = "") {
        const stringToSign = timestamp + method + path + queryString;

        return {
            "Content-Type": "application/json",
            "OK-ACCESS-KEY": this.config.apiKey,
            "OK-ACCESS-SIGN": CryptoJS.enc.Base64.stringify(
                CryptoJS.HmacSHA256(stringToSign, this.config.secretKey)
            ),
            "OK-ACCESS-TIMESTAMP": timestamp,
            "OK-ACCESS-PASSPHRASE": this.config.apiPassphrase,
            "OK-ACCESS-PROJECT": this.config.projectId,
        };
    }

    async request<T>(method: string, path: string, params?: Record<string, string | undefined>): Promise<T> {
        const timestamp = new Date().toISOString();

        // Filter out undefined values from params
        const cleanParams = params ? Object.fromEntries(
            Object.entries(params).filter(([_, v]) => v !== undefined)
        ) as Record<string, string> : undefined;

        const queryString = cleanParams ? "?" + new URLSearchParams(cleanParams).toString() : "";
        const headers = this.getHeaders(timestamp, method, path, queryString);

        let retries = 0;
        while (retries < this.config.maxRetries!) {
            try {
                const response = await fetch(`${this.config.baseUrl}${path}${queryString}`, {
                    method,
                    headers
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                if (data.code !== "0") {
                    throw new Error(`API Error: ${data.msg}`);
                }

                return data as T;
            } catch (error) {
                if (retries === this.config.maxRetries! - 1) {
                    throw error;
                }
                retries++;
                await new Promise(resolve => setTimeout(resolve, 1000 * retries));
            }
        }
        throw new Error("Max retries exceeded");
    }
}