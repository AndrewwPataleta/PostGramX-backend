import {ApiProperty} from '@nestjs/swagger';
import {Type} from 'class-transformer';
import {IsDefined, IsUUID, ValidateNested} from 'class-validator';

class CreativeAttachDataDto {
    @ApiProperty()
    @IsUUID()
    dealId: string;
}

export class CreativeAttachDto {
    @ApiProperty({type: () => CreativeAttachDataDto})
    @IsDefined()
    @ValidateNested()
    @Type(() => CreativeAttachDataDto)
    data: CreativeAttachDataDto;
}
