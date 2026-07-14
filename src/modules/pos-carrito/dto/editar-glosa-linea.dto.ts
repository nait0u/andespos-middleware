import { IsInt, IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class EditarGlosaLineaDto {
  @Type(() => Number)
  @IsInt()
  notaVentaKey!: number;

  @Type(() => Number)
  @IsInt()
  notaVentaProductoLinea!: number;

  @IsString()
  @IsNotEmpty()
  notaVentaProductoGlosaContenido!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  loteKey?: number;
}
