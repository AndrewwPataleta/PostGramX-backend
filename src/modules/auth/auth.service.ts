import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TelegramUser } from '../telegram/entities/telegram-user.entity';
import { checkTelegramAuthorization } from './utils/telegram.util';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(TelegramUser)
    private readonly telegramUserRepository: Repository<TelegramUser>,
  ) {}

  async authenticateTelegram(initData: string): Promise<TelegramUser> {
    if (!checkTelegramAuthorization(initData, this.logger)) {
      throw new UnauthorizedException('Invalid Telegram auth payload');
    }

    const params = new URLSearchParams(initData);
    const userPayload = params.get('user');

    if (!userPayload) {
      throw new UnauthorizedException('Missing Telegram user payload');
    }

    const parsedUser = JSON.parse(userPayload) as {
      id: number | string;
      username?: string;
      first_name?: string;
      last_name?: string;
    };

    const telegramId = String(parsedUser.id);

    let user = await this.telegramUserRepository.findOne({
      where: { telegramId },
    });

    if (!user) {
      user = this.telegramUserRepository.create({ telegramId });
    }

    user.username = parsedUser.username ?? null;
    user.firstName = parsedUser.first_name ?? null;
    user.lastName = parsedUser.last_name ?? null;

    return this.telegramUserRepository.save(user);
  }
}
