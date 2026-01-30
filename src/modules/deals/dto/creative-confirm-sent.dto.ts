import {ApiProperty} from '@nestjs/swagger';
import {Type} from 'class-transformer';
import {IsDefined, IsUUID, ValidateNested} from 'class-validator';

class CreativeConfirmSentDataDto {
    @ApiProperty()
    @IsUUID()
    dealId: string;
}

export class CreativeConfirmSentDto {
    @ApiProperty({type: () => CreativeConfirmSentDataDto})
    @IsDefined()
    @ValidateNested()
    @Type(() => CreativeConfirmSentDataDto)
    data: CreativeConfirmSentDataDto;
}
