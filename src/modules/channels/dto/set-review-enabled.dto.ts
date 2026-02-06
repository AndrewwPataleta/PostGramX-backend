import {ApiProperty} from '@nestjs/swagger';
import {Type} from 'class-transformer';
import {IsBoolean, IsUUID} from 'class-validator';

class SetReviewEnabledDataDto {
    @ApiProperty()
    @IsUUID()
    channelId: string;

    @ApiProperty()
    @IsUUID()
    userId: string;

    @ApiProperty()
    @IsBoolean()
    canReviewDeals: boolean;
}

export class SetReviewEnabledDto {
    @ApiProperty({type: () => SetReviewEnabledDataDto})
    @Type(() => SetReviewEnabledDataDto)
    data: SetReviewEnabledDataDto;
}
