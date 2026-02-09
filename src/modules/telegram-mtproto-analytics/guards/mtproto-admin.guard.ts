import {CanActivate, ExecutionContext, Injectable, UnauthorizedException} from '@nestjs/common';
import {Request} from 'express';
import {MtprotoAnalyticsConfigService} from '../services/mtproto-analytics-config.service';

@Injectable()
export class MtprotoAdminGuard implements CanActivate {
    constructor(private readonly configService: MtprotoAnalyticsConfigService) {}

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<Request>();
        const token = request.header('x-admin-token');
        const expected = this.configService.adminToken;

        if (!expected || !token || token !== expected) {
            throw new UnauthorizedException('Admin token required');
        }

        return true;
    }
}
