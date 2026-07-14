import { IsInt, IsString, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class CopiarClienteDto {
  @Type(() => Number)
  @IsInt()
  clienteKeyOrigen!: number;

  @IsString()
  @IsNotEmpty()
  clientePIValorNew!: string;

  @IsString()
  @IsNotEmpty()
  clienteAddressNew!: string;

  @IsString()
  @IsNotEmpty()
  clienteComunaIDNew!: string;
}
