import { IsOptional, IsString } from 'class-validator';

export class ListaClientesXVentaDto {
  @IsOptional()
  @IsString()
  filtroRUT?: string;

  @IsOptional()
  @IsString()
  filtroNombre?: string;

  @IsOptional()
  @IsString()
  filtroGenerico?: string;
}
