import {Body, Controller, Param, Post, Req} from '@nestjs/common';
import {ApiBody, ApiOperation, ApiTags} from '@nestjs/swagger';
import {Request} from 'express';
import {I18n, I18nContext} from 'nestjs-i18n';
import {dtoValidationPipe} from '../../common/pipes/dto-validation.pipe';
import {assertUser, handleMappedError} from '../../core/controller-utils';
import {DealsService} from './deals.service';
import {DealServiceError} from './errors/deal-service.error';
import {mapDealErrorToMessageKey, mapDealErrorToStatus} from './deal-error-mapper';
import {AdminCreativeCommentDto} from './dto/admin-creative-comment.dto';

@Controller('admin/deals')
@ApiTags('admin-deals')
export class AdminDealsController {
    constructor(private readonly dealsService: DealsService) {}

    @Post(':dealId/creative/approve')
    @ApiOperation({summary: 'Approve deal creative as admin'})
    async approveCreative(
        @Param('dealId') dealId: string,
        @Req() req: Request,
        @I18n() i18n: I18nContext,
    ) {
        const user = assertUser(req);

        try {
            return await this.dealsService.approveByAdmin(user.id, dealId);
        } catch (error) {
            await handleMappedError(error, i18n, {
                errorType: DealServiceError,
                mapStatus: mapDealErrorToStatus,
                mapMessageKey: mapDealErrorToMessageKey,
            });
        }
    }

    @Post(':dealId/creative/request-changes')
    @ApiOperation({summary: 'Request creative changes as admin'})
    @ApiBody({type: AdminCreativeCommentDto})
    async requestCreativeChanges(
        @Param('dealId') dealId: string,
        @Body(dtoValidationPipe) dto: AdminCreativeCommentDto,
        @Req() req: Request,
        @I18n() i18n: I18nContext,
    ) {
        const user = assertUser(req);

        try {
            return await this.dealsService.requestChangesByAdmin(
                user.id,
                dealId,
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
}
