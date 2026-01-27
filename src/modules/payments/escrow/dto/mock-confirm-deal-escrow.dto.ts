import {ApiProperty, ApiPropertyOptional} from '@nestjs/swagger';
import {Type} from 'class-transformer';
import {
    IsDefined,
    IsOptional,
    IsString,
    IsUUID,
    ValidateNested,
} from 'class-validator';

class MockConfirmDealEscrowDataDto {
    @ApiProperty()
    @IsUUID()
    dealId: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    externalTxHash?: string;
}

export class MockConfirmDealEscrowDto {
    @ApiProperty({type: () => MockConfirmDealEscrowDataDto})
    @IsDefined()
    @ValidateNested()
    @Type(() => MockConfirmDealEscrowDataDto)
    data: MockConfirmDealEscrowDataDto;
}
