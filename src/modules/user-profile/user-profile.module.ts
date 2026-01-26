import {Module} from '@nestjs/common';
import {ConfigModule} from '@nestjs/config';
import {TypeOrmModule} from '@nestjs/typeorm';
import {UserProfileService} from './user-profile.service';
import {UserProfileController} from './user-profile.controller';
import {User} from '../auth/entities/user.entity';


@Module({
    imports: [
        ConfigModule,
        TypeOrmModule.forFeature([
            User,
        ]),
    ],
    controllers: [UserProfileController],
    providers: [UserProfileService],
    exports: [UserProfileService],
})
export class UserProfileModule {
}
