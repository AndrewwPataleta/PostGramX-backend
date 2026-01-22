import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { TelegramAuthDto } from './dto/telegram-auth.dto';

@Controller('auth')
@ApiTags('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('telegram')
  @ApiOperation({ summary: 'Authenticate via Telegram Mini App' })
  async authenticateTelegram(@Body() dto: TelegramAuthDto) {
    const user = await this.authService.authenticateTelegram(dto.initData);
    return { user };
  }
}
