import {ApiProperty} from '@nestjs/swagger';
import {Type} from 'class-transformer';
import {IsBoolean, IsDefined, ValidateNested} from 'class-validator';

class UpdateChannelPauseDataDto {
    @ApiProperty()
    @IsBoolean()
    paused: boolean;
}

export class UpdateChannelPauseDto {
    @ApiProperty({type: () => UpdateChannelPauseDataDto})
    @IsDefined()
    @ValidateNested()
    @Type(() => UpdateChannelPauseDataDto)
    data: UpdateChannelPauseDataDto;
}
