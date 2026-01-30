import {Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {EntityManager, Repository} from 'typeorm';
import {EscrowWalletEntity} from '../entities/escrow-wallet.entity';
import {EscrowWalletKeyEntity} from '../entities/escrow-wallet-key.entity';
import {WalletScope} from './types/wallet-scope.enum';
import {WalletStatus} from './types/wallet-status.enum';
import {TonWalletProvider} from './providers/ton-wallet.provider';
import {KeyEncryptionService} from './crypto/key-encryption.service';
import {CurrencyCode} from '../../../common/constants/currency/currency.constants';

@Injectable()
export class WalletsService {
    constructor(
        @InjectRepository(EscrowWalletEntity)
        private readonly escrowWalletRepository: Repository<EscrowWalletEntity>,
        @InjectRepository(EscrowWalletKeyEntity)
        private readonly escrowWalletKeyRepository: Repository<EscrowWalletKeyEntity>,
        private readonly tonWalletProvider: TonWalletProvider,
        private readonly keyEncryptionService: KeyEncryptionService,
    ) {}

    async createDealEscrowWallet(
        dealId: string,
        manager?: EntityManager,
    ): Promise<EscrowWalletEntity> {
        const walletRepository = manager
            ? manager.getRepository(EscrowWalletEntity)
            : this.escrowWalletRepository;
        const keyRepository = manager
            ? manager.getRepository(EscrowWalletKeyEntity)
            : this.escrowWalletKeyRepository;

        const existing = await walletRepository.findOne({
            where: {dealId},
        });

        if (existing) {
            return existing;
        }

        const generated = await this.tonWalletProvider.generateAddress({
            scope: WalletScope.DEAL,
            dealId,
        });

        const wallet = walletRepository.create({
            scope: WalletScope.DEAL,
            dealId,
            address: generated.address,
            status: WalletStatus.ACTIVE,
            provider: CurrencyCode.TON,
            metadata: generated.metadata ?? null,
        });
        const savedWallet = await walletRepository.save(wallet);

        if (generated.secret) {
            const encryptedSecret = this.keyEncryptionService.encryptSecret(
                generated.secret,
            );
            const walletKey = keyRepository.create({
                walletId: savedWallet.id,
                encryptedSecret,
                keyVersion: 1,
            });
            await keyRepository.save(walletKey);
        }

        return savedWallet;
    }

    async closeWallet(walletId: string, manager?: EntityManager): Promise<void> {
        const walletRepository = manager
            ? manager.getRepository(EscrowWalletEntity)
            : this.escrowWalletRepository;
        await walletRepository.update(walletId, {status: WalletStatus.CLOSED});
    }
}
