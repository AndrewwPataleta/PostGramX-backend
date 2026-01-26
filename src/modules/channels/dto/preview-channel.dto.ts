import {IsNotEmpty, IsString} from 'class-validator';

export class PreviewChannelDto {
    @IsString()
    @IsNotEmpty()
    usernameOrLink: string;
}
