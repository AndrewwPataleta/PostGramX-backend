import {Body, Controller, Post, Req} from '@nestjs/common';
import {ApiBody, ApiOperation, ApiTags} from '@nestjs/swagger';
import {Request} from 'express';
import {I18n, I18nContext} from 'nestjs-i18n';
import {dtoValidationPipe} from '../../common/pipes/dto-validation.pipe';
import {assertUser, handleMappedError} from '../../core/controller-utils';
import {DealsService} from './deals.service';
import {CreateDealDto} from './dto/create-deal.dto';
import {CreativeAttachDto} from './dto/creative-attach.dto';
import {CreativeConfirmDto} from './dto/creative-confirm.dto';
import {ListDealsDto} from './dto/list-deals.dto';
import {ScheduleDealDto} from './dto/schedule-deal.dto';
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

    @Post('schedule')
    @ApiOperation({summary: 'Schedule a deal posting time'})
    @ApiBody({type: ScheduleDealDto})
    async scheduleDeal(
        @Body(dtoValidationPipe) dto: ScheduleDealDto,
        @Req() req: Request,
        @I18n() i18n: I18nContext,
    ) {
        const user = assertUser(req);

        try {
            return await this.dealsService.scheduleDeal(
                user.id,
                dto.data.dealId,
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

    @Post('creative/attach')
    @ApiOperation({summary: 'Attach creative to a deal'})
    @ApiBody({type: CreativeAttachDto})
    async attachCreative(
        @Body(dtoValidationPipe) dto: CreativeAttachDto,
        @Req() req: Request,
        @I18n() i18n: I18nContext,
    ) {
        const user = assertUser(req);

        try {
            return await this.dealsService.attachCreative(
                user.id,
                dto.data.dealId,
            );
        } catch (error) {
            await handleMappedError(error, i18n, {
                errorType: DealServiceError,
                mapStatus: mapDealErrorToStatus,
                mapMessageKey: mapDealErrorToMessageKey,
            });
        }
    }

    @Post('creative/confirm')
    @ApiOperation({summary: 'Confirm creative for a deal'})
    @ApiBody({type: CreativeConfirmDto})
    async confirmCreative(
        @Body(dtoValidationPipe) dto: CreativeConfirmDto,
        @Req() req: Request,
        @I18n() i18n: I18nContext,
    ) {
        const user = assertUser(req);

        try {
            return await this.dealsService.confirmCreative(
                user.id,
                dto.data.dealId,
            );
        } catch (error) {
            await handleMappedError(error, i18n, {
                errorType: DealServiceError,
                mapStatus: mapDealErrorToStatus,
                mapMessageKey: mapDealErrorToMessageKey,
            });
        }
    }
}
