import {ApiProperty} from '@nestjs/swagger';
import {Type} from 'class-transformer';
import {
    IsDefined,
    IsEnum,
    IsInt,
    IsOptional,
    Min,
    ValidateNested,
} from 'class-validator';
import {PreDealStatus} from '../types/predeal-status.enum';

class ListPreDealsDataDto {
    @ApiProperty({required: false, enum: PreDealStatus})
    @IsOptional()
    @IsEnum(PreDealStatus)
    status?: PreDealStatus;

    @ApiProperty({required: false})
    @IsOptional()
    @IsInt()
    @Min(1)
    page?: number;

    @ApiProperty({required: false})
    @IsOptional()
    @IsInt()
    @Min(1)
    limit?: number;
}

export class ListPreDealsDto {
    @ApiProperty({type: () => ListPreDealsDataDto})
    @IsDefined()
    @ValidateNested()
    @Type(() => ListPreDealsDataDto)
    data: ListPreDealsDataDto;
}
