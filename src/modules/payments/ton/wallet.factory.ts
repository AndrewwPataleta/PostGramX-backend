import { mnemonicNew, mnemonicToPrivateKey } from "@ton/crypto";
import { WalletContractV4 } from "@ton/ton";
import { Address } from "@ton/ton";

export type CreatedDealWallet = {
    mnemonic: string[];      // 24 words (СЕКРЕТ)
    publicKeyHex: string;
    secretKeyHex: string;
    address: string;         // user-visible
    addressRaw: Address;     // for internal use
};

function toHex(bytes: Uint8Array) {
    return Buffer.from(bytes).toString("hex");
}

export class DealWalletFactory {
    async createNewDealWallet(): Promise<CreatedDealWallet> {
        const mnemonic = await mnemonicNew(24); // :contentReference[oaicite:3]{index=3}
        const keyPair = await mnemonicToPrivateKey(mnemonic);

        const wallet = WalletContractV4.create({
            workchain: 0,
            publicKey: keyPair.publicKey,
        });

        return {
            mnemonic,
            publicKeyHex: toHex(keyPair.publicKey),
            secretKeyHex: toHex(keyPair.secretKey),
            address: wallet.address.toString({ bounceable: false }),
            addressRaw: wallet.address,
        };
    }
}
