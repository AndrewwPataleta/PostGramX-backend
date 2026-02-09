export type MtprotoErrorCode =
    | 'AUTH_REVOKED'
    | 'FLOOD_WAIT'
    | 'CHANNEL_PRIVATE'
    | 'USER_BANNED'
    | 'NETWORK_ERROR'
    | 'UNKNOWN';

export class MtprotoClientError extends Error {
    readonly code: MtprotoErrorCode;
    readonly waitSeconds?: number;

    constructor(code: MtprotoErrorCode, message: string, waitSeconds?: number) {
        super(message);
        this.code = code;
        this.waitSeconds = waitSeconds;
    }
}
