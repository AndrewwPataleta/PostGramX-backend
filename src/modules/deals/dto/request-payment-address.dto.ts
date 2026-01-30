import {ApiProperty} from '@nestjs/swagger';
import {Type} from 'class-transformer';
import {
    IsDefined,
    IsNumberString,
    IsUUID,
    ValidateNested,
} from 'class-validator';

class RequestPaymentAddressDataDto {
    @ApiProperty()
    @IsUUID()
    dealId: string;

    @ApiProperty({description: 'Amount in nano units as a string'})
    @IsNumberString()
    amountNano: string;
}

export class RequestPaymentAddressDto {
    @ApiProperty({type: () => RequestPaymentAddressDataDto})
    @IsDefined()
    @ValidateNested()
    @Type(() => RequestPaymentAddressDataDto)
    data: RequestPaymentAddressDataDto;
}
