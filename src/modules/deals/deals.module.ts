import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {DealEntity} from './entities/deal.entity';
import {ListingEntity} from '../listings/entities/listing.entity';
import {DealsService} from './deals.service';
import {DealsController} from './deals.controller';
import {ChannelEntity} from '../channels/entities/channel.entity';

@Module({
    imports: [TypeOrmModule.forFeature([DealEntity, ListingEntity, ChannelEntity])],
    controllers: [DealsController],
    providers: [DealsService],
    exports: [DealsService],
})
export class DealsModule {}
