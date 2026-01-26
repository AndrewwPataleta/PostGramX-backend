import {ApiProperty} from '@nestjs/swagger';
import {Type} from 'class-transformer';
import {IsDefined, IsNotEmpty, IsString, ValidateNested} from 'class-validator';

class LinkChannelDataDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    username: string;
}

export class LinkChannelDto {
    @ApiProperty({type: () => LinkChannelDataDto})
    @IsDefined()
    @ValidateNested()
    @Type(() => LinkChannelDataDto)
    data: LinkChannelDataDto;
}
