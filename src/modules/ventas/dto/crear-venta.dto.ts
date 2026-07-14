import { IsOptional, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class CrearVentaDto {
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  clienteKey?: number;
}
