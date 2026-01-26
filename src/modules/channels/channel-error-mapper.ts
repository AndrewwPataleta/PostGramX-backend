import {HttpStatus} from '@nestjs/common';
import {ChannelErrorCode} from './types/channel-error-code.enum';

export const mapChannelErrorToStatus = (
    code: ChannelErrorCode,
): HttpStatus => {
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
};

export const mapChannelErrorToMessageKey = (
    code: ChannelErrorCode,
): string => {
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
};
