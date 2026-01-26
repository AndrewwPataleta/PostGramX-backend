import {Module} from "@nestjs/common";
import {TelegramService} from "./telegram.service";
import {TypeOrmModule} from "@nestjs/typeorm";
import {User} from "../auth/entities/user.entity";

@Module({
    exports: [TelegramService],
    imports: [
        TypeOrmModule.forFeature([
            User,
        ]),
    ],
    providers: [TelegramService],
})
export class TelegramModule {}
