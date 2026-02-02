import {ApiProperty} from '@nestjs/swagger';
import {Type} from 'class-transformer';
import {
    IsDateString,
    IsDefined,
    IsNotEmpty,
    IsString,
    IsUUID,
    ValidateNested,
} from 'class-validator';

class ScheduleDealDataDto {
    @ApiProperty()
    @IsUUID()
    id: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    @IsDateString()
    scheduledAt: string;
}

export class ScheduleDealDto {
    @ApiProperty({type: () => ScheduleDealDataDto})
    @IsDefined()
    @ValidateNested()
    @Type(() => ScheduleDealDataDto)
    data: ScheduleDealDataDto;
}
