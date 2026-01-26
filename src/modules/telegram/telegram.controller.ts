import { Body, Controller, ParseIntPipe, Post, Query } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import {I18n, I18nService} from 'nestjs-i18n';

import { ApiTags, ApiOperation, ApiQuery, ApiBody } from '@nestjs/swagger';
import { ShopInvoiceDto } from './dto/shop-invoice.dto';
import { dtoValidationPipe } from '../../common/pipes/dto-validation.pipe';

@Controller('telegram')
@ApiTags('telegram')
export class TelegramController {
    constructor(
        private readonly telegramService: TelegramService,
        private readonly i18n: I18nService,
    ) {}



}
