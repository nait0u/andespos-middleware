import { IsInt, IsString, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class EditarGlosaCabeceraDto {
  @Type(() => Number)
  @IsInt()
  notaVentaKey!: number;

  @IsString()
  @IsNotEmpty()
  notaVentaGlosa!: string;
}
