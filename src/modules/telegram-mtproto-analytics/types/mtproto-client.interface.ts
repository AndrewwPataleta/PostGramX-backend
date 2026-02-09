export interface MtprotoClient {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    getChannelFull(usernameOrId: string): Promise<{
        subscribersCount?: number;
    }>;
    getRecentPosts(
        usernameOrId: string,
        limit: number,
    ): Promise<
        Array<{
            id: string;
            date: number;
            text?: string;
            views?: number;
            forwards?: number;
            replies?: number;
        }>
    >;
}
