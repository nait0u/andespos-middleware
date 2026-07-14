import { IsInt, IsBoolean, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class ListaVendedoresDto {
  @Type(() => Number)
  @IsInt()
  vendedorKey!: number;

  @Type(() => Boolean)
  @IsBoolean()
  vendedorExige!: boolean;

  @IsOptional()
  @IsString()
  filtroOmniBox?: string;

  @IsOptional()
  @IsString()
  filtroGenerico?: string;
}
