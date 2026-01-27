import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {TransactionEntity} from './entities/transaction.entity';
import {PaymentsController} from './payments.controller';
import {PaymentsService} from './payments.service';

@Module({
    imports: [TypeOrmModule.forFeature([TransactionEntity])],
    controllers: [PaymentsController],
    providers: [PaymentsService],
    exports: [PaymentsService],
})
export class PaymentsModule {}
