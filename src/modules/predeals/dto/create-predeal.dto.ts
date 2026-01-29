import {ApiProperty} from '@nestjs/swagger';
import {Type} from 'class-transformer';
import {
    IsDateString,
    IsDefined,
    IsNotEmpty,
    IsString,
    ValidateNested,
} from 'class-validator';

class CreatePreDealDataDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    listingId: string;

    @ApiProperty()
    @IsDateString()
    scheduledAt: string;
}

export class CreatePreDealDto {
    @ApiProperty({type: () => CreatePreDealDataDto})
    @IsDefined()
    @ValidateNested()
    @Type(() => CreatePreDealDataDto)
    data: CreatePreDealDataDto;
}
