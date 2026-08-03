import { IsOptional, IsString, IsInt, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class GetClientesDto {
  @IsOptional()
  @IsString()
  filtroRut?: string;

  @IsOptional()
  @IsString()
  filtroNombre?: string;

  @IsOptional()
  @IsString()
  filtroGenerico?: string;
}

export class AsignarClienteDto {
  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  notaVentaKey!: number;

  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  clienteKey!: number;
}
