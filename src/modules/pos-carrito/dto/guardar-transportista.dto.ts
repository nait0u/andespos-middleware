import { IsInt, IsString, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Mapea a POS.AI_API.Venta.SDTTransportista — GeneXus prefija cada campo
 * con "NotaVenta" en el wire contract; el service se encarga de esa
 * traducción para no exponer ese detalle en el DTO del frontend.
 */
export class SDTTransportistaDto {
  @Type(() => Number)
  @IsInt()
  motivoTraslado!: number;

  @Type(() => Number)
  @IsInt()
  tipoTraslado!: number;

  @IsOptional()
  @IsString()
  rutChofer?: string;

  @IsOptional()
  @IsString()
  nombreChofer?: string;

  @IsOptional()
  @IsString()
  patente?: string;

  @IsOptional()
  @IsString()
  carroPatente?: string;

  @IsOptional()
  @IsString()
  salidaFecha?: string;

  @IsOptional()
  @IsString()
  salidaHora?: string;

  @IsOptional()
  @IsString()
  llegadaFecha?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  llegadaHora?: number;
}

export class GuardarTransportistaDto {
  @Type(() => Number)
  @IsInt()
  notaVentaKey!: number;

  @ValidateNested()
  @Type(() => SDTTransportistaDto)
  sdtTransportista!: SDTTransportistaDto;
}
