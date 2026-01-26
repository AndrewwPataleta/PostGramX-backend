import {
    ArgumentMetadata,
    BadRequestException,
    Body,
    Controller,
    Post,
    Req,
} from '@nestjs/common';
import {ApiBody, ApiOperation, ApiTags} from '@nestjs/swagger';
import {Request} from 'express';
import {I18n, I18nContext} from 'nestjs-i18n';
import {buildI18nHttpExceptionPayload} from '../../common/utils/http-exception.util';
import {UserProfileService} from './user-profile.service';
import {dtoValidationPipe} from '../../common/pipes/dto-validation.pipe';

@Controller('user-profile')
@ApiTags('user-profile')
export class UserProfileController {
    constructor(private readonly userProfileService: UserProfileService) {
    }

}
