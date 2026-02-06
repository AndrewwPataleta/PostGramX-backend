import {Body, Controller, Post, Req} from '@nestjs/common';
import {ApiBody, ApiOperation, ApiTags} from '@nestjs/swagger';
import {Request} from 'express';
import {dtoValidationPipe} from '../../common/pipes/dto-validation.pipe';
import {assertUser} from '../../core/controller-utils';
import {ChannelModeratorsService} from './channel-moderators.service';
import {ListChannelModeratorsDto} from './dto/list-channel-moderators.dto';
import {SetReviewEnabledDto} from './dto/set-review-enabled.dto';

@Controller('channels/moderators')
@ApiTags('channels')
export class ChannelModeratorsController {
    constructor(
        private readonly channelModeratorsService: ChannelModeratorsService,
    ) {}

    @Post('list')
    @ApiOperation({summary: 'List channel moderators'})
    @ApiBody({type: ListChannelModeratorsDto})
    async list(
        @Body(dtoValidationPipe) dto: ListChannelModeratorsDto,
        @Req() req: Request,
    ) {
        const user = assertUser(req);
        return this.channelModeratorsService.listModerators(
            dto.data.channelId,
            user.id,
        );
    }

    @Post('set-review-enabled')
    @ApiOperation({summary: 'Enable or disable deal review for a moderator'})
    @ApiBody({type: SetReviewEnabledDto})
    async setReviewEnabled(
        @Body(dtoValidationPipe) dto: SetReviewEnabledDto,
        @Req() req: Request,
    ) {
        const user = assertUser(req);
        return this.channelModeratorsService.setReviewEnabled(
            dto.data.channelId,
            user.id,
            dto.data.userId,
            dto.data.canReviewDeals,
        );
    }
}
