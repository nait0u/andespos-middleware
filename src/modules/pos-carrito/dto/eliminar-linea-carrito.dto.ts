import { IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class EliminarLineaCarritoDto {
  @Type(() => Number)
  @IsInt()
  notaVentaKey!: number;

  @Type(() => Number)
  @IsInt()
  notaVentaProductoLinea!: number;
}
