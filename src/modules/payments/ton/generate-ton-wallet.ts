import { mnemonicNew, mnemonicToPrivateKey } from "@ton/crypto";
import { WalletContractV4 } from "@ton/ton";

export async function generateDealWallet() {
    // 1) 24-словная mnemonic
    const mnemonic = await mnemonicNew(24);

    // 2) keypair
    const kp = await mnemonicToPrivateKey(mnemonic);

    // 3) wallet contract address (v4)
    const wallet = WalletContractV4.create({
        workchain: 0,
        publicKey: kp.publicKey,
    });

    // bounceable:false удобнее для отображения/копирования
    const address = wallet.address.toString({ bounceable: false });

    return {
        address,
        mnemonic, // СЕКРЕТ! надо шифровать перед сохранением
        publicKeyHex: Buffer.from(kp.publicKey).toString("hex"),
        secretKeyHex: Buffer.from(kp.secretKey).toString("hex"),
    };
}
