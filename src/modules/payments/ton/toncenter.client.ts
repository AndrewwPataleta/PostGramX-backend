import axios, { AxiosInstance } from "axios";

export class TonCenterClient {
    private http: AxiosInstance;

    constructor(opts: { endpoint: string; apiKey: string }) {
        this.http = axios.create({
            baseURL: opts.endpoint,
            headers: { "X-API-Key": opts.apiKey },
            timeout: 15_000,
        });
    }

    async jsonRpc<T>(method: string, params: Record<string, any>): Promise<T> {
        const { data } = await this.http.post("", {
            jsonrpc: "2.0",
            id: Date.now(),
            method,
            params,
        });

        // toncenter v2 обычно возвращает { ok: true, result: ... }
        if (data?.ok === false) {
            throw new Error(`TONCENTER error: ${JSON.stringify(data.error)}`);
        }
        if (data?.error) {
            throw new Error(`TONCENTER rpc error: ${JSON.stringify(data.error)}`);
        }
        return (data.result ?? data) as T;
    }

    getTransactions(address: string, limit = 10) {
        return this.jsonRpc<any[]>("getTransactions", { address, limit });
    }
}
