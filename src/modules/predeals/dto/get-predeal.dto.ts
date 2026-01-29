import {ApiProperty} from '@nestjs/swagger';
import {Type} from 'class-transformer';
import {IsDefined, IsNotEmpty, IsString, ValidateNested} from 'class-validator';

class GetPreDealDataDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    id: string;
}

export class GetPreDealDto {
    @ApiProperty({type: () => GetPreDealDataDto})
    @IsDefined()
    @ValidateNested()
    @Type(() => GetPreDealDataDto)
    data: GetPreDealDataDto;
}
