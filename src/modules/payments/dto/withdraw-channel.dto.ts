import {ApiProperty} from '@nestjs/swagger';
import {Type} from 'class-transformer';
import {
    IsDefined,
    IsIn,
    IsNotEmpty,
    IsString,
    IsUUID,
    Matches,
    MaxLength,
    ValidateNested,
} from 'class-validator';
import {
    SUPPORTED_AUTH_TYPES,
    SUPPORTED_PLATFORM_TYPES,
    SupportedAuthType,
    SupportedPlatformType
} from "../../auth/auth.constants";


class WithdrawChannelDataDto {
    @ApiProperty({format: 'uuid'})
    @IsUUID()
    channelId: string;

    @ApiProperty({description: 'Amount in nano TON as a string'})
    @IsString()
    @IsNotEmpty()
    @Matches(/^\d+$/)
    amountNano: string;

    @ApiProperty({description: 'Destination TON address'})
    @IsString()
    @MaxLength(256)
    @IsNotEmpty()
    destinationAddress: string;
}

export class WithdrawChannelDto {
    @ApiProperty({enum: SUPPORTED_PLATFORM_TYPES})
    @IsIn(SUPPORTED_PLATFORM_TYPES)
    platformType: SupportedPlatformType;

    @ApiProperty({enum: SUPPORTED_AUTH_TYPES})
    @IsIn(SUPPORTED_AUTH_TYPES)
    authType: SupportedAuthType;

    @ApiProperty()
    @IsString()
    token: string;

    @ApiProperty({type: () => WithdrawChannelDataDto})
    @IsDefined()
    @ValidateNested()
    @Type(() => WithdrawChannelDataDto)
    data: WithdrawChannelDataDto;
}
