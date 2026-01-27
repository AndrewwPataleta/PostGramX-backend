import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {EscrowWalletEntity} from '../entities/escrow-wallet.entity';
import {EscrowWalletKeyEntity} from '../entities/escrow-wallet-key.entity';
import {TonWalletProvider} from './providers/ton-wallet.provider';
import {WalletsService} from './wallets.service';
import {KeyEncryptionService} from './crypto/key-encryption.service';

@Module({
    imports: [TypeOrmModule.forFeature([EscrowWalletEntity, EscrowWalletKeyEntity])],
    providers: [WalletsService, TonWalletProvider, KeyEncryptionService],
    exports: [WalletsService],
})
export class WalletsModule {}
