import {
  IsInt,
  IsNumber,
  IsBoolean,
  IsString,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Enviar DescuentoPorcentaje/DescuentoTotal en 0 elimina el descuento
 * global vigente en la NotaVenta (convención GeneXus AplicarDescuentoGlobal).
 */
export class AplicarDescuentoGlobalDto {
  @Type(() => Number)
  @IsInt()
  notaVentaKey!: number;

  @IsBoolean()
  descuentoEsPorcentaje!: boolean;

  @Type(() => Number)
  @IsNumber()
  descuentoPorcentaje!: number;

  @Type(() => Number)
  @IsInt()
  descuentoTotal!: number;

  @IsOptional()
  @IsString()
  glosaContenido?: string;
}
