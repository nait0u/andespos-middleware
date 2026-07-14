import { IsInt, IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Entrada del flujo OmniBox: el cajero escanea/digita un código y el BFF
 * resuelve el ProductoKey y el lote antes de mutar el carrito
 * (ver PosCarritoService.agregarProductoPorOmnibox).
 */
export class AgregarPorOmniboxDto {
  @Type(() => Number)
  @IsInt()
  notaVentaKey!: number;

  @IsString()
  @IsNotEmpty()
  codigoEscaneado!: string;

  @IsOptional()
  @IsString()
  cantidad?: string;

  @IsOptional()
  @IsString()
  accion?: string;
}
