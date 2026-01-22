import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { TelegramService } from './telegram.service';

@Controller('telegram')
@ApiTags('telegram')
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  @Get('health')
  @ApiOperation({ summary: 'Telegram module health check' })
  health() {
    return this.telegramService.getHealth();
  }
}
