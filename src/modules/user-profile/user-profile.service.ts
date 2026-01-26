import {
    BadRequestException,
    Injectable,
    InternalServerErrorException,
    NotFoundException,
} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {MoreThan, Repository} from 'typeorm';
import {I18nService} from 'nestjs-i18n';

import {ConfigService} from '@nestjs/config';

import {User} from '../auth/entities/user.entity';

@Injectable()
export class UserProfileService {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly i18n: I18nService,
        private readonly config: ConfigService,
    ) {

    }


}
