import { IsInt, IsString, IsNotEmpty, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Entrada cruda del único input de texto del OmniBox. `largoMinimoCodigo`
 * viene de GetPantallaVentaInit.Settings (ver VentasService) — el frontend
 * lo reenvía tal cual, el BFF no lo persiste ni lo vuelve a resolver.
 */
export class ProcesarOmniboxDto {
  @Type(() => Number)
  @IsInt()
  notaVentaKey!: number;

  @IsString()
  @IsNotEmpty()
  input!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  largoMinimoCodigo!: number;

  @IsOptional()
  @IsString()
  categoriaIdl?: string;
}
