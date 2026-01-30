import {Body, Controller, Param, Post, Req} from '@nestjs/common';
import {ApiBody, ApiOperation, ApiTags} from '@nestjs/swagger';
import {Request} from 'express';
import {dtoValidationPipe} from '../../common/pipes/dto-validation.pipe';
import {assertUser} from '../../core/controller-utils';
import {GetTransactionDto} from './dto/get-transaction.dto';
import {ListTransactionsDto} from './dto/list-transactions.dto';
import {PaymentsService} from './payments.service';
import {CreateTransactionDto} from "./dto/create-transaction.dto";

@Controller('payments')
@ApiTags('payments')
export class PaymentsController {
    constructor(private readonly paymentsService: PaymentsService) {}

    @Post('transactions/list')
    @ApiOperation({summary: "List user's transactions with filters and pagination"})
    @ApiBody({
        schema: {
            example: {
                platformType: 'telegram',
                authType: 'telegram',
                token: '<initData>',
                data: {
                    page: 1,
                    limit: 20,
                    status: 'COMPLETED',
                    sort: 'recent',
                    order: 'desc',
                },
            },
        },
    })
    async list(
        @Body(dtoValidationPipe) dto: ListTransactionsDto,
        @Req() req: Request,
    ) {
        const user = assertUser(req);
        return this.paymentsService.listTransactionsForUser(user.id, dto.data);
    }

    @Post('transactions/:id')
    @ApiOperation({summary: 'Get a transaction for current user'})
    @ApiBody({
        schema: {
            example: {
                platformType: 'telegram',
                authType: 'telegram',
                token: '<initData>',
                data: {},
            },
        },
    })
    async getTransaction(
        @Param('id') id: string,
        @Body(dtoValidationPipe) dto: GetTransactionDto,
        @Req() req: Request,
    ) {
        const user = assertUser(req);
        return this.paymentsService.getTransactionForUser(user.id, id);
    }

    @Post('transactions')
    @ApiOperation({ summary: 'Create TON transaction and generate deposit address' })
    @ApiBody({
        schema: {
            example: {
                platformType: 'telegram',
                authType: 'telegram',
                token: '<initData>',
                data: {
                    type: 'DEPOSIT',
                    direction: 'IN',
                    amountNano: '1000000000',
                    description: 'Ad campaign payment',
                    dealId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
                },
            },
        },
    })
    async createTransaction(
        @Body(dtoValidationPipe) dto: CreateTransactionDto,
        @Req() req: Request,
    ) {
        const user = assertUser(req);

        return this.paymentsService.createTransaction({
            ...dto,
            userId: user.id,
        });
    }

}
