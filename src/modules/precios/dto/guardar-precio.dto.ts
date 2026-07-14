import { IsInt, IsNumber, IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class GuardarPrecioDto {
  @IsInt()
  productoKey!: number;

  @IsString()
  @IsNotEmpty()
  precioTimeInicio!: string; // date-time ISO 8601

  @IsString()
  ubiCod!: string;

  @IsString()
  categoriaPrecioIdl!: string;

  @IsNumber()
  precioCantidad!: number;

  @IsString()
  @IsNotEmpty()
  precioHoraInicio!: string;

  @IsString()
  @IsNotEmpty()
  precioHoraFin!: string;

  @IsOptional()
  @IsString()
  precioTimeFin?: string; // date-time ISO 8601

  @IsNumber()
  precioValor!: number;

  @IsNumber()
  precioDescuentoPorcentaje!: number;

  @IsNumber()
  precioDescuentoMax!: number;
}
