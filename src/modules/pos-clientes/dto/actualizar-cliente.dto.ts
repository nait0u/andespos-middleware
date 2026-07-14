import { IsOptional, IsString } from 'class-validator';

/** Mapea a POS.AI_API.Venta.SDTClientePayload */
export class ActualizarClienteDto {
  @IsOptional()
  @IsString()
  clienteRUT?: string;

  @IsOptional()
  @IsString()
  clienteGiro?: string;

  @IsOptional()
  @IsString()
  clienteAddress?: string;

  @IsOptional()
  @IsString()
  clienteComunaId?: string;

  @IsOptional()
  @IsString()
  clienteMobilPhone?: string;

  @IsOptional()
  @IsString()
  clienteEmail?: string;

  @IsOptional()
  @IsString()
  clienteNombre?: string;

  @IsOptional()
  @IsString()
  clienteApellidoPaterno?: string;

  @IsOptional()
  @IsString()
  clienteApellidoMaterno?: string;

  @IsOptional()
  @IsString()
  clienteRazonSocial?: string;
}
