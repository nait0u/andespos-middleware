import { IsOptional, IsString } from 'class-validator';

export class FiltrosVentasDto {
  @IsOptional()
  @IsString()
  lastSync?: string;

  @IsOptional()
  @IsString()
  fechaFiltro?: string;

  @IsOptional()
  @IsString()
  nota?: string;

  @IsOptional()
  @IsString()
  clienteNombreCompleto?: string;
}
