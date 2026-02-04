import {Module} from '@nestjs/common';
import {FeesConfigService} from './fees-config.service';
import {FeesService} from './fees.service';

@Module({
    providers: [FeesConfigService, FeesService],
    exports: [FeesConfigService, FeesService],
})
export class FeesModule {}
