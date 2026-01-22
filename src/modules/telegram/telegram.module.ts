import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';
import { TelegramUser } from './entities/telegram-user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TelegramUser])],
  controllers: [TelegramController],
  providers: [TelegramService],
})
export class TelegramModule {}
