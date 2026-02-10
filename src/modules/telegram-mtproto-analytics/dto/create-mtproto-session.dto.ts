import {IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength} from 'class-validator';

export class CreateMtprotoSessionDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(64)
    label: string;

    @IsString()
    @IsNotEmpty()
    session: string;

    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}
