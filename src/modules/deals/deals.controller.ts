import {Body, Controller, Post, Req} from '@nestjs/common';
import {ApiBody, ApiOperation, ApiTags} from '@nestjs/swagger';
import {Request} from 'express';
import {I18n, I18nContext} from 'nestjs-i18n';
import {dtoValidationPipe} from '../../common/pipes/dto-validation.pipe';
import {assertUser, handleMappedError} from '../../core/controller-utils';
import {DealsService} from './deals.service';
import {CreateDealDto} from './dto/create-deal.dto';
import {CreativeConfirmSentDto} from './dto/creative-confirm-sent.dto';
import {CreativeStatusDto} from './dto/creative-status.dto';
import {CreativeSubmitDto} from './dto/creative-submit.dto';
import {AdminApproveDto} from './dto/admin-approve.dto';
import {AdminRequestChangesDto} from './dto/admin-request-changes.dto';
import {AdminRejectDto} from './dto/admin-reject.dto';
import {GetDealDto} from './dto/get-deal.dto';
import {ListDealsDto} from './dto/list-deals.dto';
import {ScheduleDealDto} from './dto/schedule-deal.dto';
import {DealServiceError} from './errors/deal-service.error';
import {mapDealErrorToMessageKey, mapDealErrorToStatus} from './deal-error-mapper';
import {RequestPaymentAddressDto} from './dto/request-payment-address.dto';
import {EscrowService} from '../payments/escrow/escrow.service';
import {EscrowServiceError} from '../payments/escrow/errors/escrow-service.error';
import {
    mapEscrowErrorToMessageKey,
    mapEscrowErrorToStatus,
} from '../payments/escrow/errors/escrow-error-mapper';

@Controller('deals')
@ApiTags('deals')
export class DealsController {
    constructor(
        private readonly dealsService: DealsService,
        private readonly escrowService: EscrowService,
    ) {}

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

    @Post('get')
    @ApiOperation({summary: 'Get deal by id'})
    @ApiBody({type: GetDealDto})
    async getDeal(
        @Body(dtoValidationPipe) dto: GetDealDto,
        @Req() req: Request,
        @I18n() i18n: I18nContext,
    ) {
        const user = assertUser(req);

        try {
            return await this.dealsService.getDeal(user.id, dto.data.dealId);
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

    @Post('creative/submit')
    @ApiOperation({summary: 'Submit creative confirmation for a deal'})
    @ApiBody({type: CreativeSubmitDto})
    async submitCreative(
        @Body(dtoValidationPipe) dto: CreativeSubmitDto,
        @Req() req: Request,
        @I18n() i18n: I18nContext,
    ) {
        const user = assertUser(req);

        try {
            return await this.dealsService.submitCreative(
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

    @Post('creative/status')
    @ApiOperation({summary: 'Get creative status for a deal'})
    @ApiBody({type: CreativeStatusDto})
    async getCreativeStatus(
        @Body(dtoValidationPipe) dto: CreativeStatusDto,
        @Req() req: Request,
        @I18n() i18n: I18nContext,
    ) {
        const user = assertUser(req);

        try {
            return await this.dealsService.getCreativeStatus(
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

    @Post('admin/approve')
    @ApiOperation({summary: 'Approve a deal as admin'})
    @ApiBody({type: AdminApproveDto})
    async approveDealByAdmin(
        @Body(dtoValidationPipe) dto: AdminApproveDto,
        @Req() req: Request,
        @I18n() i18n: I18nContext,
    ) {
        const user = assertUser(req);

        try {
            return await this.dealsService.approveByAdmin(
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

    @Post('admin/requestChanges')
    @ApiOperation({summary: 'Request creative changes as admin'})
    @ApiBody({type: AdminRequestChangesDto})
    async requestChangesByAdmin(
        @Body(dtoValidationPipe) dto: AdminRequestChangesDto,
        @Req() req: Request,
        @I18n() i18n: I18nContext,
    ) {
        const user = assertUser(req);

        try {
            return await this.dealsService.requestChangesByAdmin(
                user.id,
                dto.data.dealId,
                dto.data.comment,
            );
        } catch (error) {
            await handleMappedError(error, i18n, {
                errorType: DealServiceError,
                mapStatus: mapDealErrorToStatus,
                mapMessageKey: mapDealErrorToMessageKey,
            });
        }
    }

    @Post('admin/reject')
    @ApiOperation({summary: 'Reject a deal as admin'})
    @ApiBody({type: AdminRejectDto})
    async rejectByAdmin(
        @Body(dtoValidationPipe) dto: AdminRejectDto,
        @Req() req: Request,
        @I18n() i18n: I18nContext,
    ) {
        const user = assertUser(req);

        try {
            return await this.dealsService.rejectByAdmin(
                user.id,
                dto.data.dealId,
                dto.data.reason,
            );
        } catch (error) {
            await handleMappedError(error, i18n, {
                errorType: DealServiceError,
                mapStatus: mapDealErrorToStatus,
                mapMessageKey: mapDealErrorToMessageKey,
            });
        }
    }

    @Post('payment/requestAddress')
    @ApiOperation({summary: 'Request escrow payment address for a deal'})
    @ApiBody({type: RequestPaymentAddressDto})
    async requestPaymentAddress(
        @Body(dtoValidationPipe) dto: RequestPaymentAddressDto,
        @Req() req: Request,
        @I18n() i18n: I18nContext,
    ) {
        const user = assertUser(req);

        try {
            return await this.escrowService.initDealEscrow(
                user.id,
                dto.data.dealId,
                dto.data.amountNano,
            );
        } catch (error) {
            await handleMappedError(error, i18n, {
                errorType: EscrowServiceError,
                mapStatus: mapEscrowErrorToStatus,
                mapMessageKey: mapEscrowErrorToMessageKey,
            });
        }
    }
}
