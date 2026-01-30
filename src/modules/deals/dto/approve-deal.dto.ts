import {ApiProperty} from '@nestjs/swagger';
import {Type} from 'class-transformer';
import {IsDefined, IsUUID, ValidateNested} from 'class-validator';

class ApproveDealDataDto {
    @ApiProperty()
    @IsUUID()
    dealId: string;
}

export class ApproveDealDto {
    @ApiProperty({type: () => ApproveDealDataDto})
    @IsDefined()
    @ValidateNested()
    @Type(() => ApproveDealDataDto)
    data: ApproveDealDataDto;
}
