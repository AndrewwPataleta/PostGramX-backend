import {ApiProperty, ApiPropertyOptional} from '@nestjs/swagger';
import {Type, Transform} from 'class-transformer';
import {
    IsDefined,
    IsIn,
    IsOptional,
    IsString,
    MaxLength,
    ValidateNested,
} from 'class-validator';
import {
    SUPPORTED_AUTH_TYPES,
    SUPPORTED_PLATFORM_TYPES,
    SupportedAuthType,
    SupportedPlatformType,
} from '../../auth/constants/auth.constants';

class ChannelPayoutsDataDto {
    @ApiPropertyOptional({maxLength: 128})
    @IsOptional()
    @IsString()
    @MaxLength(128)
    @Transform(({value}) => (typeof value === 'string' ? value.trim() : value))
    q?: string;
}

export class ChannelPayoutsDto {
    @ApiProperty({enum: SUPPORTED_PLATFORM_TYPES})
    @IsIn(SUPPORTED_PLATFORM_TYPES)
    platformType: SupportedPlatformType;

    @ApiProperty({enum: SUPPORTED_AUTH_TYPES})
    @IsIn(SUPPORTED_AUTH_TYPES)
    authType: SupportedAuthType;

    @ApiProperty()
    @IsString()
    token: string;

    @ApiProperty({type: () => ChannelPayoutsDataDto})
    @IsDefined()
    @ValidateNested()
    @Type(() => ChannelPayoutsDataDto)
    data: ChannelPayoutsDataDto;
}

export type ChannelPayoutsFilters = ChannelPayoutsDataDto;
