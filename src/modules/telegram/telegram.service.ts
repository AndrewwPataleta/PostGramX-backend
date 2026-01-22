import { Injectable } from '@nestjs/common';

@Injectable()
export class TelegramService {
  getHealth() {
    return { status: 'ok' };
  }
}
