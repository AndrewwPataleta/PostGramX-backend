import {
    BadRequestException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import {User} from './entities/user.entity';
import {I18nService} from 'nestjs-i18n';


import {
    SUPPORTED_AUTH_TYPES,
    SUPPORTED_PLATFORM_TYPES,
    SupportedAuthType,
    SupportedPlatformType,
} from './constants/auth.constants';


const isSupportedAuthType = (value: string): value is SupportedAuthType =>
    (SUPPORTED_AUTH_TYPES as readonly string[]).includes(
        value as SupportedAuthType,
    );

const isSupportedPlatformType = (
    value: string,
): value is SupportedPlatformType =>
    (SUPPORTED_PLATFORM_TYPES as readonly string[]).includes(
        value as SupportedPlatformType,
    );


@Injectable()
export class AuthService {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly i18n: I18nService,
    ) {

    }

    async verifyTokenAndGetUser(
        authType: string,
        token: string,
        platformType?: string,
    ): Promise<User | null> {
        const normalizedAuthTypeCandidate = (authType ?? '').trim().toLowerCase();
        if (!isSupportedAuthType(normalizedAuthTypeCandidate)) {
            return null;
        }

        const normalizedAuthType: SupportedAuthType = normalizedAuthTypeCandidate;

        const normalizedPlatformCandidate = platformType?.trim().toLowerCase();
        const normalizedPlatformType =
            normalizedPlatformCandidate &&
            isSupportedPlatformType(normalizedPlatformCandidate)
                ? normalizedPlatformCandidate
                : undefined;

        let userId: string | null = null;
        let userInfo: Partial<User> = {};
        let user: User | null = null;

        if (normalizedAuthType === 'telegram') {
            const parsed = new URLSearchParams(token);
            const rawUserData = parsed.get('user');

            if (!rawUserData) {
                return null;
            }

            let decoded: string;
            try {
                decoded = decodeURIComponent(rawUserData);
            } catch {
                return null;
            }

            let data: Record<string, any>;
            try {
                data = JSON.parse(decoded);
            } catch {
                return null;
            }

            userId = data.id?.toString() ?? null;
            if (!userId) {
                return null;
            }

            const firstName = (data.first_name ?? data.firstName)?.trim();
            const lastName = (data.last_name ?? data.lastName)?.trim();
            const avatar = (data.photo_url ?? data.avatar)?.trim();
            const platformForUser = normalizedPlatformType ?? 'telegram';

            const telegramLang = data.language_code?.trim() || 'en';

            userInfo = {
                username: data.username?.trim() || `telegram_user_${userId}`,
                lang: telegramLang,
                isPremium: data.is_premium ?? false,
                platformType: platformForUser,
                firstName,
                lastName,
                avatar,
            };

            user = await this.userRepository.findOne({
                where: {telegramId: userId},
            });
        }

        if (!user) {
            const userPayload: Partial<User> = {
                ...userInfo,
                lang: userInfo.lang?.trim() || 'en',
                platformType: (normalizedPlatformType ??
                    userInfo.platformType ??
                    normalizedAuthType) as string,
                lastLoginAt: new Date(),
                authType: normalizedAuthType,
            };

            user = this.userRepository.create(userPayload);
        }

        user.lastLoginAt = new Date();

        if (normalizedPlatformType && user.platformType !== normalizedPlatformType) {
            user.platformType = normalizedPlatformType;
        } else if (!user.platformType && userInfo.platformType) {
            user.platformType = userInfo.platformType as string;
        }

        if (user.authType !== normalizedAuthType) {
            user.authType = normalizedAuthType;
        }

        if (normalizedAuthType === 'telegram' && userId && user.telegramId !== userId) {
            user.telegramId = userId;
        }

        if (userInfo.username && user.username !== userInfo.username) {
            user.username = userInfo.username;
        }
        if (userInfo.firstName && user.firstName !== userInfo.firstName) {
            user.firstName = userInfo.firstName;
        }
        if (userInfo.lastName && user.lastName !== userInfo.lastName) {
            user.lastName = userInfo.lastName;
        }

        if (userInfo.email && user.email !== userInfo.email) {
            user.email = userInfo.email;
        }

        if (typeof userInfo.isPremium === 'boolean' && user.isPremium !== userInfo.isPremium) {
            user.isPremium = userInfo.isPremium;
        }

        user = await this.userRepository.save(user);

        return user;
    }
}
