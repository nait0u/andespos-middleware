import { IsOptional, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class FiltrosPreciosDto {
  @IsOptional()
  @IsString()
  codIntValor?: string;

  @IsOptional()
  @IsString()
  productoDescripcion?: string;

  @IsOptional()
  @IsString()
  ubicacion?: string;

  @IsOptional()
  @IsString()
  categoriaPrecioIdl?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  precioCantidad?: number;

  @IsOptional()
  @IsString()
  fechaFiltro?: string;

  @IsOptional()
  @IsString()
  lastSync?: string;
}
