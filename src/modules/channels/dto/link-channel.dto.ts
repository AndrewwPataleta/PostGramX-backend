import {IsNotEmpty, IsString} from 'class-validator';

export class LinkChannelDto {
    @IsString()
    @IsNotEmpty()
    username: string;
}
