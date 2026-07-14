import { IsInt, IsString, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Fija la cantidad ABSOLUTA de una línea de producto (reemplaza, no suma).
 * Ver PosCarritoService.establecerCantidadProducto para el detalle del
 * flujo de dos llamadas requerido por ProductoEdit_API (GeneXus).
 */
export class EstablecerCantidadProductoDto {
  @Type(() => Number)
  @IsInt()
  notaVentaKey!: number;

  @Type(() => Number)
  @IsInt()
  productoKey!: number;

  /** Cantidad final de la línea — reemplaza el valor actual, no se suma */
  @IsString()
  @IsNotEmpty()
  cantidad!: string;
}
