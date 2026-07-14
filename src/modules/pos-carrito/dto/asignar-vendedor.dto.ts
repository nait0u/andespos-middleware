import { IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class AsignarVendedorDto {
  @Type(() => Number)
  @IsInt()
  notaVentaKey!: number;

  @Type(() => Number)
  @IsInt()
  vendedorKey!: number;
}
