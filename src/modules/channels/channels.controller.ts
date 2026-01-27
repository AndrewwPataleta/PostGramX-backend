import {Body, Controller, Param, Post, Req} from '@nestjs/common';
import {ApiBody, ApiOperation, ApiTags} from '@nestjs/swagger';
import {Request} from 'express';
import {I18n, I18nContext} from 'nestjs-i18n';
import {dtoValidationPipe} from '../../common/pipes/dto-validation.pipe';
import {assertUser, handleMappedError} from '../../core/controller-utils';
import {ChannelsService} from './channels.service';
import {ChannelServiceError} from './errors/channel-service.error';
import {PreviewChannelDto} from './dto/preview-channel.dto';
import {LinkChannelDto} from './dto/link-channel.dto';
import {VerifyChannelDto} from './dto/verify-channel.dto';
import {ListChannelsDto} from './dto/list-channels.dto';
import {ChannelDetailsDto} from './dto/channel-details.dto';
import {ListChannelAdminsDto} from './dto/list-channel-admins.dto';
import {SyncChannelAdminsDto} from './dto/sync-channel-admins.dto';
import {UpdateChannelDisabledDto} from './dto/update-channel-disabled.dto';
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

    @Post('admins/list')
    @ApiOperation({summary: 'List synced Telegram admins for a channel'})
    @ApiBody({type: ListChannelAdminsDto})
    async listAdmins(
        @Body(dtoValidationPipe) dto: ListChannelAdminsDto,
        @Req() req: Request,
        @I18n() i18n: I18nContext,
    ) {
        const user = assertUser(req);

        try {
            return await this.channelsService.listChannelAdmins(
                dto.data.channelId,
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

    @Post('admins/sync')
    @ApiOperation({summary: 'Sync Telegram admins for a channel'})
    @ApiBody({type: SyncChannelAdminsDto})
    async syncAdmins(
        @Body(dtoValidationPipe) dto: SyncChannelAdminsDto,
        @Req() req: Request,
        @I18n() i18n: I18nContext,
    ) {
        const user = assertUser(req);

        try {
            return await this.channelsService.syncChannelAdminsForUser(
                dto.data.channelId,
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

    @Post('list')
    @ApiOperation({summary: "List user's channels with filters and pagination"})
    @ApiBody({
        schema: {
            example: {
                platformType: 'telegram',
                authType: 'telegram',
                token: '<initData>',
                data: {
                    verifiedOnly: true,
                    q: 'crypto',
                    page: 1,
                    limit: 20,
                    sort: 'recent',
                    order: 'desc',
                },
            },
        },
    })
    async list(
        @Body(dtoValidationPipe) dto: ListChannelsDto,
        @Req() req: Request,
    ) {
        const user = assertUser(req);
        return this.channelsService.listForUser(user.id, dto.data);
    }

    @Post(':id')
    @ApiOperation({summary: 'Get channel details for current user'})
    @ApiBody({
        schema: {
            example: {
                platformType: 'telegram',
                authType: 'telegram',
                token: '<initData>',
                data: {},
            },
        },
    })
    async getChannel(
        @Param('id') id: string,
        @Body(dtoValidationPipe) dto: ChannelDetailsDto,
        @Req() req: Request,
    ) {
        const user = assertUser(req);
        return this.channelsService.getForUser(user.id, id);
    }

    @Post(':id/disabled')
    @ApiOperation({summary: 'Disable or enable a channel'})
    @ApiBody({
        schema: {
            example: {
                platformType: 'telegram',
                authType: 'telegram',
                token: '<initData>',
                data: {
                    disabled: true,
                },
            },
        },
    })
    async updateDisabledStatus(
        @Param('id') id: string,
        @Body(dtoValidationPipe) dto: UpdateChannelDisabledDto,
        @Req() req: Request,
    ) {
        const user = assertUser(req);
        return this.channelsService.updateDisabledStatus(
            user.id,
            id,
            dto.data.disabled,
        );
    }
}
