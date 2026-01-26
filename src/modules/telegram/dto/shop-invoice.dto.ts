import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive, IsString } from 'class-validator';

export class ShopInvoiceDto {
  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty()
  @IsInt()
  @IsPositive()
  credits: number;

  @ApiProperty()
  @IsInt()
  @IsPositive()
  price: number;

  @ApiProperty()
  @IsString()
  currency: string;
}
