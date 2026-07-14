import { IsInt, IsNumber, IsString, IsNotEmpty } from 'class-validator';

export class CaducarPrecioDto {
  @IsInt()
  productoKey!: number;

  @IsString()
  @IsNotEmpty()
  precioTimeInicio!: string; // date-time ISO 8601

  @IsString()
  precioUbiCod!: string;

  @IsString()
  categoriaPrecioIdl!: string;

  @IsNumber()
  precioCantidad!: number;

  @IsString()
  @IsNotEmpty()
  precioHoraInicio!: string;
}
