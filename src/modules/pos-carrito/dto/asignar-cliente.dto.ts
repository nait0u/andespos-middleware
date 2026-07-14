import { IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class AsignarClienteDto {
  @Type(() => Number)
  @IsInt()
  notaVentaKey!: number;

  /** 0 desasigna el cliente actual de la NotaVenta */
  @Type(() => Number)
  @IsInt()
  clienteKey!: number;
}
