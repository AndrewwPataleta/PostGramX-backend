import {ApiProperty} from '@nestjs/swagger';
import {Type} from 'class-transformer';
import {IsDefined, IsOptional, IsString, ValidateNested} from 'class-validator';

class AdminCreativeCommentDataDto {
    @ApiProperty({required: false})
    @IsOptional()
    @IsString()
    comment?: string;
}

export class AdminCreativeCommentDto {
    @ApiProperty({type: () => AdminCreativeCommentDataDto})
    @IsDefined()
    @ValidateNested()
    @Type(() => AdminCreativeCommentDataDto)
    data: AdminCreativeCommentDataDto;
}
