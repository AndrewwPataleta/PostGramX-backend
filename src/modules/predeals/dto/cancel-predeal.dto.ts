import {ApiProperty} from '@nestjs/swagger';
import {Type} from 'class-transformer';
import {IsDefined, IsNotEmpty, IsString, ValidateNested} from 'class-validator';

class CancelPreDealDataDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    id: string;
}

export class CancelPreDealDto {
    @ApiProperty({type: () => CancelPreDealDataDto})
    @IsDefined()
    @ValidateNested()
    @Type(() => CancelPreDealDataDto)
    data: CancelPreDealDataDto;
}
