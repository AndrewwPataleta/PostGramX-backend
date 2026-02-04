import {forwardRef, Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {DealEntity} from '../deals/entities/deal.entity';
import {DealEscrowEntity} from '../deals/entities/deal-escrow.entity';
import {DealsModule} from '../deals/deals.module';
import {EscrowWalletEntity} from './entities/escrow-wallet.entity';
import {EscrowWalletKeyEntity} from './entities/escrow-wallet-key.entity';
import {TonTransferEntity} from './entities/ton-transfer.entity';
import {TransactionEntity} from './entities/transaction.entity';
import {PayoutRequestEntity} from './entities/payout-request.entity';
import {RefundRequestEntity} from './entities/refund-request.entity';
import {UserWalletEntity} from './entities/user-wallet.entity';
import {EscrowController} from './escrow/escrow.controller';
import {EscrowService} from './escrow/escrow.service';
import {WalletsModule} from './wallets/wallets.module';
import {PaymentsController} from './payments.controller';
import {PaymentsService} from './payments.service';
import {TonCenterClient} from "./ton/toncenter.client";
import {TonPaymentWatcher} from "./ton-payment.watcher";
import {TonPayoutService} from './ton/ton-payout.service';
import {ChannelEntity} from '../channels/entities/channel.entity';
import {ChannelMembershipEntity} from '../channels/entities/channel-membership.entity';
import {SettlementService} from './settlement/settlement.service';
import {TonHotWalletService} from './ton/ton-hot-wallet.service';
import {UserWalletService} from './wallets/user-wallet.service';
import {TelegramModule} from '../telegram/telegram.module';
import {User} from '../auth/entities/user.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            ChannelEntity,
            ChannelMembershipEntity,
            DealEntity,
            DealEscrowEntity,
            EscrowWalletEntity,
            EscrowWalletKeyEntity,
            TonTransferEntity,
            TransactionEntity,
            PayoutRequestEntity,
            RefundRequestEntity,
            UserWalletEntity,
            User,
        ]),
        forwardRef(() => DealsModule),
        WalletsModule,
        TelegramModule,
    ],
    controllers: [PaymentsController, EscrowController],
    providers: [
        PaymentsService,
        EscrowService,
        {
            provide: TonCenterClient,
            useFactory: () => {
                return new TonCenterClient({
                    endpoint: process.env.TONCENTER_RPC!,
                    apiKey: process.env.TONCENTER_API_KEY!,
                });
            },
        },
        TonPaymentWatcher,
        TonPayoutService,
        TonHotWalletService,
        SettlementService,
        UserWalletService,
    ],
    exports: [PaymentsService, EscrowService, UserWalletService],
})
export class PaymentsModule {
}
