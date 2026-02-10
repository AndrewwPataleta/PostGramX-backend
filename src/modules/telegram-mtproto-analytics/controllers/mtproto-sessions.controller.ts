import {
    Body,
    Controller,
    Get,
    Param,
    Patch,
    Post,
    UseGuards,
} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository, IsNull} from 'typeorm';
import {dtoValidationPipe} from '../../../common/pipes/dto-validation.pipe';
import {TelegramMtprotoSessionEntity} from '../entities/telegram-mtproto-session.entity';
import {MtprotoSessionCryptoService} from '../services/mtproto-session-crypto.service';
import {CreateMtprotoSessionDto} from '../dto/create-mtproto-session.dto';
import {UpdateMtprotoSessionDto} from '../dto/update-mtproto-session.dto';
import {MtprotoAdminGuard} from '../guards/mtproto-admin.guard';

@Controller('admin/mtproto/sessions')
@UseGuards(MtprotoAdminGuard)
export class MtprotoSessionsController {
    constructor(
        @InjectRepository(TelegramMtprotoSessionEntity)
        private readonly sessionRepository: Repository<TelegramMtprotoSessionEntity>,
        private readonly cryptoService: MtprotoSessionCryptoService,
    ) {}

    @Post()
    async createSession(
        @Body(dtoValidationPipe) dto: CreateMtprotoSessionDto,
    ) {
        const encrypted = this.cryptoService.encrypt(dto.session);
        const existing = await this.sessionRepository.findOne({
            where: {label: dto.label, userId: IsNull()},
        });

        if (existing) {
            existing.encryptedSession = encrypted;
            existing.isActive = dto.isActive ?? true;
            await this.sessionRepository.save(existing);
            return {
                id: existing.id,
                label: existing.label,
                isActive: existing.isActive,
            };
        }

        const session = this.sessionRepository.create({
            label: dto.label,
            encryptedSession: encrypted,
            isActive: dto.isActive ?? true,
            userId: null,
        });
        const saved = await this.sessionRepository.save(session);

        return {id: saved.id, label: saved.label, isActive: saved.isActive};
    }

    @Get()
    async listSessions() {
        const sessions = await this.sessionRepository.find({
            where: {userId: IsNull()},
            order: {createdAt: 'DESC'},
        });
        return {
            items: sessions.map((session) => ({
                id: session.id,
                label: session.label,
                isActive: session.isActive,
                lastCheckedAt: session.lastCheckedAt,
                lastErrorCode: session.lastErrorCode,
                lastErrorMessage: session.lastErrorMessage,
                createdAt: session.createdAt,
                updatedAt: session.updatedAt,
            })),
        };
    }

    @Patch(':id')
    async updateSession(
        @Param('id') id: string,
        @Body(dtoValidationPipe) dto: UpdateMtprotoSessionDto,
    ) {
        const session = await this.sessionRepository.findOne({where: {id}});
        if (!session) {
            return {updated: false};
        }

        if (dto.label !== undefined) {
            session.label = dto.label;
        }
        if (dto.isActive !== undefined) {
            session.isActive = dto.isActive;
        }
        if (dto.session) {
            session.encryptedSession = this.cryptoService.encrypt(dto.session);
        }

        await this.sessionRepository.save(session);

        return {id: session.id, label: session.label, isActive: session.isActive};
    }
}
