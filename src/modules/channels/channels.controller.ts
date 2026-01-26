import {
    Body,
    Controller,
    HttpException,
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

    @Post('verify')
    @ApiOperation({summary: 'Verify a linked channel'})
    @ApiBody({type: VerifyChannelDto})
    async verify(
        @Body(dtoValidationPipe) dto: VerifyChannelDto,
        @Req() req: Request,
        @I18n() i18n: I18nContext,
    ) {
        const user = this.assertUser(req);

        try {
            return await this.channelsService.verifyChannel(
                dto.data.id,
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
            const status = mapChannelErrorToStatus(error.code);
            const messageKey = mapChannelErrorToMessageKey(error.code);
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
}
