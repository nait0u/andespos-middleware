import { IsOptional, IsInt, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class PantallaVentaInitDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  notaVentaKey?: number;

  @IsOptional()
  @IsString()
  pmodo?: string;
}

export class PantallaVentaDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  notaVentaKey?: number;
}
