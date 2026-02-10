import {IsBoolean, IsOptional, IsString, MaxLength} from 'class-validator';

export class UpdateMtprotoSessionDto {
    @IsString()
    @IsOptional()
    @MaxLength(64)
    label?: string;

    @IsString()
    @IsOptional()
    session?: string;

    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}
