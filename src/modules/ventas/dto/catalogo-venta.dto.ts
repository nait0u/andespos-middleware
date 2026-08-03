import { IsOptional, IsString, IsInt, IsArray, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class GetCartaTouchDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  notaVentaKey?: number;
}

export class GetProductoDetallesDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  mitemKey!: number;
}

export class GetSelectorGeneralDto {
  @IsOptional()
  @IsString()
  textoBusqueda?: string;

  @IsOptional()
  @IsString()
  codigoBusqueda?: string;
}

export class FiltroCategoriasDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  colCatClasificadoras?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  colCatBuscadoras?: string[];

  @IsOptional()
  @IsString()
  textoBusqueda?: string;
}
