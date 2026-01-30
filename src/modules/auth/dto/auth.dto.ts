import {ApiProperty} from '@nestjs/swagger';
import {
    IsBoolean,
    IsOptional,
    IsString,
    MaxLength,
    Matches,
    ValidateNested,
    IsEnum,
} from 'class-validator';
import {Type} from 'class-transformer';
import {AuthType} from '../../../common/constants/auth/auth-types.constants';
import {PlatformType} from '../../../common/constants/platform/platform-types.constants';

class AuthDataDto {
    @ApiProperty({required: false, description: 'BCP-47 language tag, e.g. ru, en-US, pt-BR, zh-Hans'})
    @IsOptional()
    @IsString()
    @MaxLength(32)
    @Matches(/^[a-zA-Z]{2,3}([-_][a-zA-Z0-9]{2,8}){0,3}$/)
    lang?: string;

    @ApiProperty({required: false})
    @IsOptional()
    @IsString()
    id?: string;

    @ApiProperty({required: false})
    @IsOptional()
    @IsString()
    username?: string;

    @ApiProperty({required: false})
    @IsOptional()
    @IsString()
    firstName?: string;

    @ApiProperty({required: false})
    @IsOptional()
    @IsString()
    lastName?: string;

    @ApiProperty({required: false})
    @IsOptional()
    @IsBoolean()
    isPremium?: boolean;
}

export class AuthDto {
    @ApiProperty({required: false})
    @IsOptional()
    @IsString()
    id?: string;

    @ApiProperty()
    @IsString()
    token: string;

    @ApiProperty({enum: AuthType})
    @IsEnum(AuthType)
    authType: AuthType;

    @ApiProperty({required: false})
    @IsOptional()
    @IsString()
    username?: string;

    @ApiProperty({required: false})
    @IsOptional()
    @IsString()
    lang?: string;

    @ApiProperty({required: false})
    @IsOptional()
    @IsBoolean()
    isPremium?: boolean;

    @ApiProperty({enum: PlatformType})
    @IsEnum(PlatformType)
    platformType: PlatformType;

    @ApiProperty({required: false, type: () => AuthDataDto})
    @IsOptional()
    @ValidateNested()
    @Type(() => AuthDataDto)
    data?: AuthDataDto;
}
