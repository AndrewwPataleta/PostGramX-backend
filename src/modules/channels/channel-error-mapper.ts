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
        case ChannelErrorCode.USER_NOT_MEMBER:
        case ChannelErrorCode.MEMBERSHIP_DISABLED:
        case ChannelErrorCode.MEMBERSHIP_INACTIVE:
        case ChannelErrorCode.NOT_ADMIN:
        case ChannelErrorCode.NOT_ADMIN_ANYMORE:
        case ChannelErrorCode.MISSING_RIGHTS:
        case ChannelErrorCode.USER_NOT_CREATOR:
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
        case ChannelErrorCode.USER_NOT_MEMBER:
            return 'channels.errors.user_not_member';
        case ChannelErrorCode.MEMBERSHIP_DISABLED:
            return 'channels.errors.membership_disabled';
        case ChannelErrorCode.MEMBERSHIP_INACTIVE:
            return 'channels.errors.membership_inactive';
        case ChannelErrorCode.NOT_ADMIN:
            return 'channels.errors.not_admin';
        case ChannelErrorCode.NOT_ADMIN_ANYMORE:
            return 'channels.errors.not_admin_anymore';
        case ChannelErrorCode.MISSING_RIGHTS:
            return 'channels.errors.missing_rights';
        case ChannelErrorCode.USER_NOT_CREATOR:
            return 'channels.errors.user_not_creator';
        default:
            return 'channels.errors.channel_not_found';
    }
};
