import { IsInt, IsString, IsOptional, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Agrega un producto de catálogo al carrito (ProductoKey existente).
 * Distinto de un "ítem libre" (no soportado — no existe en el yaml xVenta).
 */
export class AgregarProductoCarritoDto {
  @Type(() => Number)
  @IsInt()
  notaVentaKey!: number;

  @IsOptional()
  @IsString()
  categoriaIdl?: string;

  @IsString()
  @IsNotEmpty()
  accion!: string;

  @Type(() => Number)
  @IsInt()
  productoKey!: number;

  /** GeneXus tipa Cantidad como string (admite formatos como "1,5") */
  @IsString()
  @IsNotEmpty()
  cantidad!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  loteKey?: number;
}
