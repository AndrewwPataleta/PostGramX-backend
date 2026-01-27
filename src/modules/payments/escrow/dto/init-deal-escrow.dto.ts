import {ApiProperty} from '@nestjs/swagger';
import {Type} from 'class-transformer';
import {
    IsDefined,
    IsNumberString,
    IsUUID,
    ValidateNested,
} from 'class-validator';

class InitDealEscrowDataDto {
    @ApiProperty()
    @IsUUID()
    dealId: string;

    @ApiProperty({description: 'Amount in nano units as a string'})
    @IsNumberString()
    amountNano: string;
}

export class InitDealEscrowDto {
    @ApiProperty({type: () => InitDealEscrowDataDto})
    @IsDefined()
    @ValidateNested()
    @Type(() => InitDealEscrowDataDto)
    data: InitDealEscrowDataDto;
}
