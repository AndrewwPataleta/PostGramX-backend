import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {DealEntity} from '../deals/entities/deal.entity';
import {EscrowWalletEntity} from './entities/escrow-wallet.entity';
import {EscrowWalletKeyEntity} from './entities/escrow-wallet-key.entity';
import {TransactionEntity} from './entities/transaction.entity';
import {EscrowController} from './escrow/escrow.controller';
import {EscrowService} from './escrow/escrow.service';
import {EscrowTimeoutService} from './escrow/escrow-timeout.service';
import {WalletsModule} from './wallets/wallets.module';
import {PaymentsController} from './payments.controller';
import {PaymentsService} from './payments.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            DealEntity,
            EscrowWalletEntity,
            EscrowWalletKeyEntity,
            TransactionEntity,
        ]),
        WalletsModule,
    ],
    controllers: [PaymentsController, EscrowController],
    providers: [PaymentsService, EscrowService, EscrowTimeoutService],
    exports: [PaymentsService],
})
export class PaymentsModule {}
