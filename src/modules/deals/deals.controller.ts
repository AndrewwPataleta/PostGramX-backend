import {Body, Controller, Post, Req} from '@nestjs/common';
import {ApiBody, ApiOperation, ApiTags} from '@nestjs/swagger';
import {Request} from 'express';
import {I18n, I18nContext} from 'nestjs-i18n';
import {dtoValidationPipe} from '../../common/pipes/dto-validation.pipe';
import {assertUser, handleMappedError} from '../../core/controller-utils';
import {DealsService} from './deals.service';
import {CreateDealDto} from './dto/create-deal.dto';
import {ListDealsDto} from './dto/list-deals.dto';
import {DealServiceError} from './errors/deal-service.error';
import {mapDealErrorToMessageKey, mapDealErrorToStatus} from './deal-error-mapper';

@Controller('deals')
@ApiTags('deals')
export class DealsController {
    constructor(private readonly dealsService: DealsService) {}

    @Post('create')
    @ApiOperation({summary: 'Create a deal from a listing'})
    @ApiBody({type: CreateDealDto})
    async createDeal(
        @Body(dtoValidationPipe) dto: CreateDealDto,
        @Req() req: Request,
        @I18n() i18n: I18nContext,
    ) {
        const user = assertUser(req);

        try {
            return await this.dealsService.createDeal(
                user.id,
                dto.data.listingId,
                dto.data.brief,
                dto.data.scheduledAt,
            );
        } catch (error) {
            await handleMappedError(error, i18n, {
                errorType: DealServiceError,
                mapStatus: mapDealErrorToStatus,
                mapMessageKey: mapDealErrorToMessageKey,
            });
        }
    }

    @Post('list')
    @ApiOperation({summary: 'List deals grouped by status'})
    @ApiBody({type: ListDealsDto})
    async listDeals(
        @Body(dtoValidationPipe) dto: ListDealsDto,
        @Req() req: Request,
        @I18n() i18n: I18nContext,
    ) {
        const user = assertUser(req);

        try {
            return await this.dealsService.listDeals(user.id, dto.data);
        } catch (error) {
            await handleMappedError(error, i18n, {
                errorType: DealServiceError,
                mapStatus: mapDealErrorToStatus,
                mapMessageKey: mapDealErrorToMessageKey,
            });
        }
    }
}
