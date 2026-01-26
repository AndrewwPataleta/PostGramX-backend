import {Body, Controller, Post, Req} from '@nestjs/common';
import {ApiBody, ApiOperation, ApiTags} from '@nestjs/swagger';
import {Request} from 'express';
import {I18n, I18nContext} from 'nestjs-i18n';
import {dtoValidationPipe} from '../../common/pipes/dto-validation.pipe';
import {assertUser, handleMappedError} from '../../core/controller-utils';
import {ChannelsService, ChannelServiceError} from './channels.service';
import {PreviewChannelDto} from './dto/preview-channel.dto';
import {LinkChannelDto} from './dto/link-channel.dto';
import {VerifyChannelDto} from './dto/verify-channel.dto';
import {
    mapChannelErrorToMessageKey,
    mapChannelErrorToStatus,
} from './channel-error-mapper';

@Controller('channels')
@ApiTags('channels')
export class ChannelsController {
    constructor(private readonly channelsService: ChannelsService) {}

    @Post('preview')
    @ApiOperation({summary: 'Preview a channel by username or link'})
    @ApiBody({type: PreviewChannelDto})
    async preview(
        @Body(dtoValidationPipe) dto: PreviewChannelDto,
        @Req() req: Request,
        @I18n() i18n: I18nContext,
    ) {
        assertUser(req);

        try {
            return await this.channelsService.previewChannel(
                dto.data.usernameOrLink,
            );
        } catch (error) {
            await handleMappedError(error, i18n, {
                errorType: ChannelServiceError,
                mapStatus: mapChannelErrorToStatus,
                mapMessageKey: mapChannelErrorToMessageKey,
            });
        }
    }

    @Post('link')
    @ApiOperation({summary: 'Link a channel to the current user'})
    @ApiBody({type: LinkChannelDto})
    async link(
        @Body(dtoValidationPipe) dto: LinkChannelDto,
        @Req() req: Request,
        @I18n() i18n: I18nContext,
    ) {
        const user = assertUser(req);

        try {
            return await this.channelsService.linkChannel(
                dto.data.username,
                user.id,
            );
        } catch (error) {
            await handleMappedError(error, i18n, {
                errorType: ChannelServiceError,
                mapStatus: mapChannelErrorToStatus,
                mapMessageKey: mapChannelErrorToMessageKey,
            });
        }
    }

    @Post('verify')
    @ApiOperation({summary: 'Verify a linked channel'})
    @ApiBody({type: VerifyChannelDto})
    async verify(
        @Body(dtoValidationPipe) dto: VerifyChannelDto,
        @Req() req: Request,
        @I18n() i18n: I18nContext,
    ) {
        const user = assertUser(req);

        try {
            return await this.channelsService.verifyChannel(
                dto.data.id,
                user.id,
                user.telegramId,
            );
        } catch (error) {
            await handleMappedError(error, i18n, {
                errorType: ChannelServiceError,
                mapStatus: mapChannelErrorToStatus,
                mapMessageKey: mapChannelErrorToMessageKey,
            });
        }
    }
}
