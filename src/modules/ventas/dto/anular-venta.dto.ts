import { IsInt, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class AnularVentaDto {
  @IsNotEmpty()
  @IsInt()
  @Type(() => Number)
  notaVentaKey!: number;
}
