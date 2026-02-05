declare module '@ton/ton' {
    export class TonClient {
        constructor(options: any);
        getContractState(address: any): Promise<any>;
        open(contract: any): any;
    }
    export class WalletContractV4 {
        static create(options: any): WalletContractV4;
        address: any;
        getSeqno(): Promise<number>;
        sendTransfer(options: any): Promise<void>;
    }
    export type Address = any;
    export const Address: any;
    export const internal: any;
    export const SendMode: any;
}

declare module '@ton/crypto' {
    export const mnemonicToPrivateKey: any;
    export const mnemonicNew: any;
}
