import { IsInt, IsNumber, IsString } from 'class-validator';

export class CrearPrecioDto {
  @IsInt()
  productoKey!: number;

  @IsString()
  ubiCod!: string;

  @IsNumber()
  precioValor!: number;
}
