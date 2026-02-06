import {ApiProperty} from '@nestjs/swagger';
import {Type} from 'class-transformer';
import {IsUUID} from 'class-validator';

class ListChannelModeratorsDataDto {
    @ApiProperty()
    @IsUUID()
    channelId: string;
}

export class ListChannelModeratorsDto {
    @ApiProperty({type: () => ListChannelModeratorsDataDto})
    @Type(() => ListChannelModeratorsDataDto)
    data: ListChannelModeratorsDataDto;
}
