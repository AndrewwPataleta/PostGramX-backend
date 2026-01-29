import {Body, Controller, Post, Req} from '@nestjs/common';
import {ApiBody, ApiOperation, ApiTags} from '@nestjs/swagger';
import {Request} from 'express';
import {I18n, I18nContext} from 'nestjs-i18n';
import {dtoValidationPipe} from '../../common/pipes/dto-validation.pipe';
import {assertUser, handleMappedError} from '../../core/controller-utils';
import {PreDealsService} from './predeals.service';
import {CreatePreDealDto} from './dto/create-predeal.dto';
import {GetPreDealDto} from './dto/get-predeal.dto';
import {ListPreDealsDto} from './dto/list-predeals.dto';
import {CancelPreDealDto} from './dto/cancel-predeal.dto';
import {PreDealServiceError} from './errors/predeal-service.error';
import {
    mapPreDealErrorToMessageKey,
    mapPreDealErrorToStatus,
} from './predeal-error-mapper';

@Controller('predeals')
@ApiTags('predeals')
export class PreDealsController {
    constructor(private readonly preDealsService: PreDealsService) {}

    @Post('create')
    @ApiOperation({summary: 'Create a pre-deal for a listing'})
    @ApiBody({type: CreatePreDealDto})
    async createPreDeal(
        @Body(dtoValidationPipe) dto: CreatePreDealDto,
        @Req() req: Request,
        @I18n() i18n: I18nContext,
    ) {
        const user = assertUser(req);

        try {
            return await this.preDealsService.createPreDeal(
                user.id,
                dto.data.listingId,
                dto.data.scheduledAt,
            );
        } catch (error) {
            await handleMappedError(error, i18n, {
                errorType: PreDealServiceError,
                mapStatus: mapPreDealErrorToStatus,
                mapMessageKey: mapPreDealErrorToMessageKey,
            });
        }
    }

    @Post('get')
    @ApiOperation({summary: 'Get pre-deal by id'})
    @ApiBody({type: GetPreDealDto})
    async getPreDeal(
        @Body(dtoValidationPipe) dto: GetPreDealDto,
        @Req() req: Request,
        @I18n() i18n: I18nContext,
    ) {
        const user = assertUser(req);

        try {
            return await this.preDealsService.getPreDeal(user.id, dto.data.id);
        } catch (error) {
            await handleMappedError(error, i18n, {
                errorType: PreDealServiceError,
                mapStatus: mapPreDealErrorToStatus,
                mapMessageKey: mapPreDealErrorToMessageKey,
            });
        }
    }

    @Post('list')
    @ApiOperation({summary: 'List pre-deals for advertiser'})
    @ApiBody({type: ListPreDealsDto})
    async listPreDeals(
        @Body(dtoValidationPipe) dto: ListPreDealsDto,
        @Req() req: Request,
        @I18n() i18n: I18nContext,
    ) {
        const user = assertUser(req);

        try {
            return await this.preDealsService.listPreDeals(user.id, dto.data);
        } catch (error) {
            await handleMappedError(error, i18n, {
                errorType: PreDealServiceError,
                mapStatus: mapPreDealErrorToStatus,
                mapMessageKey: mapPreDealErrorToMessageKey,
            });
        }
    }

    @Post('cancel')
    @ApiOperation({summary: 'Cancel a pre-deal'})
    @ApiBody({type: CancelPreDealDto})
    async cancelPreDeal(
        @Body(dtoValidationPipe) dto: CancelPreDealDto,
        @Req() req: Request,
        @I18n() i18n: I18nContext,
    ) {
        const user = assertUser(req);

        try {
            return await this.preDealsService.cancelPreDeal(user.id, dto.data.id);
        } catch (error) {
            await handleMappedError(error, i18n, {
                errorType: PreDealServiceError,
                mapStatus: mapPreDealErrorToStatus,
                mapMessageKey: mapPreDealErrorToMessageKey,
            });
        }
    }
}
