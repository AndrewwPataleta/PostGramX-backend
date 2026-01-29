import {ApiProperty} from '@nestjs/swagger';
import {Type} from 'class-transformer';
import {
    ArrayMaxSize,
    ArrayUnique,
    IsArray,
    IsBoolean,
    IsDefined,
    IsInt,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsPositive,
    IsString,
    IsUUID,
    MaxLength,
    Min,
    ValidateIf,
    ValidateNested,
} from 'class-validator';

class UpdateListingDataDto {
    @ApiProperty()
    @IsUUID()
    @IsNotEmpty()
    id: string;

    @ApiProperty({required: false, example: 25})
    @Type(() => Number)
    @IsOptional()
    @IsNumber({maxDecimalPlaces: 9})
    @IsPositive()
    priceTon?: number;

    @ApiProperty({required: false, nullable: true, example: 24})
    @Type(() => Number)
    @IsOptional()
    @ValidateIf((_, value) => value !== null && value !== undefined)
    @IsInt()
    @Min(1)
    pinDurationHours?: number | null;

    @ApiProperty({required: false, example: 48})
    @Type(() => Number)
    @IsOptional()
    @IsInt()
    @Min(1)
    visibilityDurationHours?: number;

    @ApiProperty({required: false})
    @IsOptional()
    @IsBoolean()
    allowEdits?: boolean;

    @ApiProperty({required: false})
    @IsOptional()
    @IsBoolean()
    allowLinkTracking?: boolean;

    @ApiProperty({type: [String], maxItems: 20, required: false})
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(20)
    @ArrayUnique()
    @IsString({each: true})
    @MaxLength(32, {each: true})
    tags?: string[];

    @ApiProperty({required: false, maxLength: 2000})
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    contentRulesText?: string;

    @ApiProperty({required: false})
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

export class UpdateListingDto {
    @ApiProperty({type: () => UpdateListingDataDto})
    @IsDefined()
    @ValidateNested()
    @Type(() => UpdateListingDataDto)
    data: UpdateListingDataDto;
}
