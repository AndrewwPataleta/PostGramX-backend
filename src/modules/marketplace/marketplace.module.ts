import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {ChannelEntity} from '../channels/entities/channel.entity';
import {ListingEntity} from '../listings/entities/listing.entity';
import {MarketplaceController} from './marketplace.controller';
import {MarketplaceService} from './marketplace.service';

import {FeesModule} from '../payments/fees/fees.module';
@Module({
    imports: [TypeOrmModule.forFeature([ChannelEntity, ListingEntity]), FeesModule],
    controllers: [MarketplaceController],
    providers: [MarketplaceService],
})
export class MarketplaceModule {}
