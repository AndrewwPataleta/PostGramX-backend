import {
    Body,
    Controller,
    HttpException,
    HttpStatus,
    Post,
    Req,
    UnauthorizedException,
} from '@nestjs/common';
import {ApiBody, ApiOperation, ApiTags} from '@nestjs/swagger';
import {Request} from 'express';
import {I18n, I18nContext} from 'nestjs-i18n';
import {dtoValidationPipe} from '../../common/pipes/dto-validation.pipe';
import {ChannelsService, ChannelServiceError} from './channels.service';
import {PreviewChannelDto} from './dto/preview-channel.dto';
import {LinkChannelDto} from './dto/link-channel.dto';
import {ChannelErrorCode} from './types/channel-error-code.enum';

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
        this.assertUser(req);

        try {
            return await this.channelsService.previewChannel(
                dto.data.usernameOrLink,
            );
        } catch (error) {
            await this.handleError(error, i18n);
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
        const user = this.assertUser(req);

        try {
            return await this.channelsService.linkChannel(
                dto.data.username,
                user.id,
            );
        } catch (error) {
            await this.handleError(error, i18n);
        }
    }

    @Post(':id/verify')
    @ApiOperation({summary: 'Verify a linked channel'})
    async verify(@Req() req: Request, @I18n() i18n: I18nContext) {
        const user = this.assertUser(req);
        const channelId = req.params.id;

        try {
            return await this.channelsService.verifyChannel(
                channelId,
                user.id,
                user.telegramId,
            );
        } catch (error) {
            await this.handleError(error, i18n);
        }
    }

    private assertUser(req: Request) {
        const user = (req as Request & {user?: {id: string; telegramId?: string}})
            .user;
        if (!user) {
            throw new UnauthorizedException();
        }
        return user;
    }

    private async handleError(
        error: unknown,
        i18n: I18nContext,
    ): Promise<never> {
        if (error instanceof ChannelServiceError) {
            const status = this.mapErrorToStatus(error.code);
            const messageKey = this.mapErrorToMessageKey(error.code);
            const message = await i18n.t(messageKey);
            throw new HttpException(
                {
                    code: error.code,
                    message,
                },
                status,
            );
        }
        throw error;
    }

    private mapErrorToStatus(code: ChannelErrorCode): HttpStatus {
        switch (code) {
            case ChannelErrorCode.INVALID_USERNAME:
                return HttpStatus.BAD_REQUEST;
            case ChannelErrorCode.CHANNEL_NOT_FOUND:
                return HttpStatus.NOT_FOUND;
            case ChannelErrorCode.BOT_FORBIDDEN:
            case ChannelErrorCode.USER_NOT_ADMIN:
            case ChannelErrorCode.BOT_NOT_ADMIN:
            case ChannelErrorCode.BOT_MISSING_RIGHTS:
                return HttpStatus.FORBIDDEN;
            case ChannelErrorCode.NOT_A_CHANNEL:
            case ChannelErrorCode.CHANNEL_PRIVATE_OR_NO_USERNAME:
                return HttpStatus.BAD_REQUEST;
            default:
                return HttpStatus.BAD_REQUEST;
        }
    }

    private mapErrorToMessageKey(code: ChannelErrorCode): string {
        switch (code) {
            case ChannelErrorCode.INVALID_USERNAME:
                return 'channels.errors.invalid_username';
            case ChannelErrorCode.CHANNEL_NOT_FOUND:
                return 'channels.errors.channel_not_found';
            case ChannelErrorCode.NOT_A_CHANNEL:
                return 'channels.errors.not_a_channel';
            case ChannelErrorCode.CHANNEL_PRIVATE_OR_NO_USERNAME:
                return 'channels.errors.channel_private_or_no_username';
            case ChannelErrorCode.BOT_FORBIDDEN:
                return 'channels.errors.bot_forbidden';
            case ChannelErrorCode.USER_NOT_ADMIN:
                return 'channels.errors.user_not_admin';
            case ChannelErrorCode.BOT_NOT_ADMIN:
                return 'channels.errors.bot_not_admin';
            case ChannelErrorCode.BOT_MISSING_RIGHTS:
                return 'channels.errors.bot_missing_rights';
            default:
                return 'channels.errors.channel_not_found';
        }
    }
}
