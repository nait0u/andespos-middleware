import {
  IsInt,
  IsString,
  IsArray,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ReferenciaItemDto {
  @IsString()
  tipoDocumento!: string;

  @IsString()
  folio!: string;

  @IsOptional()
  @IsString()
  fecha?: string;

  @IsOptional()
  @IsString()
  razon?: string;
}

/**
 * Operación bulk: reemplaza el estado completo de referencias de la
 * NotaVenta. Un array vacío elimina todas las referencias existentes.
 */
export class SincronizarReferenciasDto {
  @Type(() => Number)
  @IsInt()
  notaVentaKey!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReferenciaItemDto)
  referencias!: ReferenciaItemDto[];
}
