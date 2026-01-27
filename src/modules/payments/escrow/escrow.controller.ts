import {Body, Controller, Post, Req} from '@nestjs/common';
import {ApiBody, ApiOperation, ApiTags} from '@nestjs/swagger';
import {Request} from 'express';
import {I18n, I18nContext} from 'nestjs-i18n';
import {dtoValidationPipe} from '../../../common/pipes/dto-validation.pipe';
import {assertUser, handleMappedError} from '../../../core/controller-utils';
import {DealEscrowStatusDto} from './dto/deal-escrow-status.dto';
import {InitDealEscrowDto} from './dto/init-deal-escrow.dto';
import {MockConfirmDealEscrowDto} from './dto/mock-confirm-deal-escrow.dto';
import {EscrowService} from './escrow.service';
import {EscrowServiceError, EscrowServiceErrorCode} from './errors/escrow-service.error';
import {
    mapEscrowErrorToMessageKey,
    mapEscrowErrorToStatus,
} from './errors/escrow-error-mapper';

@Controller('payments/escrow')
@ApiTags('payments')
export class EscrowController {
    constructor(private readonly escrowService: EscrowService) {}

    @Post('deal/init')
    @ApiOperation({summary: 'Initialize escrow for a deal'})
    @ApiBody({type: InitDealEscrowDto})
    async initDealEscrow(
        @Body(dtoValidationPipe) dto: InitDealEscrowDto,
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

    @Post('deal/status')
    @ApiOperation({summary: 'Get escrow status for a deal'})
    @ApiBody({type: DealEscrowStatusDto})
    async getDealEscrowStatus(
        @Body(dtoValidationPipe) dto: DealEscrowStatusDto,
        @Req() req: Request,
        @I18n() i18n: I18nContext,
    ) {
        const user = assertUser(req);

        try {
            return await this.escrowService.getDealEscrowStatus(
                user.id,
                dto.data.dealId,
            );
        } catch (error) {
            await handleMappedError(error, i18n, {
                errorType: EscrowServiceError,
                mapStatus: mapEscrowErrorToStatus,
                mapMessageKey: mapEscrowErrorToMessageKey,
            });
        }
    }

    @Post('deal/mock-confirm')
    @ApiOperation({summary: 'Mock confirm escrow funds (dev only)'})
    @ApiBody({type: MockConfirmDealEscrowDto})
    async mockConfirmDealEscrow(
        @Body(dtoValidationPipe) dto: MockConfirmDealEscrowDto,
        @Req() req: Request,
        @I18n() i18n: I18nContext,
    ) {
        const user = assertUser(req);

        try {
            if (!this.isMockAllowed(req)) {
                throw new EscrowServiceError(
                    EscrowServiceErrorCode.MOCK_DISABLED,
                );
            }

            return await this.escrowService.mockConfirmDealEscrow(
                user.id,
                dto.data.dealId,
                dto.data.externalTxHash,
            );
        } catch (error) {
            await handleMappedError(error, i18n, {
                errorType: EscrowServiceError,
                mapStatus: mapEscrowErrorToStatus,
                mapMessageKey: mapEscrowErrorToMessageKey,
            });
        }
    }

    private isMockAllowed(req: Request): boolean {
        if ((process.env.NODE_ENV ?? '').toLowerCase() !== 'production') {
            return true;
        }

        const header = req.headers['x-telegram-mock'];
        return Boolean(header);
    }
}
