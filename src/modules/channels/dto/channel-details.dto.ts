import {ApiProperty} from '@nestjs/swagger';
import {Type} from 'class-transformer';
import {IsDefined, ValidateNested} from 'class-validator';

class ChannelDetailsDataDto {}

export class ChannelDetailsDto {
    @ApiProperty({type: () => ChannelDetailsDataDto})
    @IsDefined()
    @ValidateNested()
    @Type(() => ChannelDetailsDataDto)
    data: ChannelDetailsDataDto;
}
