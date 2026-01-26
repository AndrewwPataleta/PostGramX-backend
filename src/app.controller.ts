import { Controller, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@Controller()
@ApiTags('app')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post('hello')
  @ApiOperation({ summary: 'Return hello message' })
  getHello(): string {
    return this.appService.getHello();
  }
}
