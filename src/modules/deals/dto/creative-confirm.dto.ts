import {ApiProperty} from '@nestjs/swagger';
import {Type} from 'class-transformer';
import {IsDefined, IsUUID, ValidateNested} from 'class-validator';

class CreativeConfirmDataDto {
    @ApiProperty()
    @IsUUID()
    dealId: string;
}

export class CreativeConfirmDto {
    @ApiProperty({type: () => CreativeConfirmDataDto})
    @IsDefined()
    @ValidateNested()
    @Type(() => CreativeConfirmDataDto)
    data: CreativeConfirmDataDto;
}
