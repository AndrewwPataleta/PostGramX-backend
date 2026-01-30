import {forwardRef, Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {DealEntity} from '../deals/entities/deal.entity';
import {DealsModule} from '../deals/deals.module';
import {EscrowWalletEntity} from './entities/escrow-wallet.entity';
import {EscrowWalletKeyEntity} from './entities/escrow-wallet-key.entity';
import {TonTransferEntity} from './entities/ton-transfer.entity';
import {TransactionEntity} from './entities/transaction.entity';
import {EscrowController} from './escrow/escrow.controller';
import {EscrowService} from './escrow/escrow.service';
import {EscrowTimeoutService} from './escrow/escrow-timeout.service';
import {WalletsModule} from './wallets/wallets.module';
import {PaymentsController} from './payments.controller';
import {PaymentsService} from './payments.service';
import {TonCenterClient} from "./ton/toncenter.client";
import {TonPaymentWatcher} from "./ton-payment.watcher";

@Module({
    imports: [
        TypeOrmModule.forFeature([
            DealEntity,
            EscrowWalletEntity,
            EscrowWalletKeyEntity,
            TonTransferEntity,
            TransactionEntity,
        ]),
        forwardRef(() => DealsModule),
        WalletsModule,
    ],
    controllers: [PaymentsController, EscrowController],
    providers: [PaymentsService, EscrowService, EscrowTimeoutService, {
        provide: TonCenterClient,
        useFactory: () => {
            return new TonCenterClient({
                endpoint: process.env.TONCENTER_RPC!,
                apiKey: process.env.TONCENTER_API_KEY!,
            });
        },
    },
        TonPaymentWatcher],
    exports: [PaymentsService, EscrowService],
})
export class PaymentsModule {
}
