import {
  IsString,
  IsOptional,
  IsNumber,
  IsNotEmpty,
  IsBoolean,
} from 'class-validator';

export class GuardarClienteDto {
  @IsOptional()
  @IsNumber()
  clienteKeyIn?: number = 0;

  @IsNotEmpty()
  @IsString()
  clienteRUT!: string;

  @IsNotEmpty()
  @IsString()
  clienteGiro!: string;

  @IsNotEmpty()
  @IsString()
  clienteAddress!: string;

  @IsNotEmpty()
  @IsString()
  clienteComunaID!: string;

  @IsOptional()
  @IsString()
  clientePITipo?: string;

  @IsOptional()
  @IsString()
  clientePIValor?: string;

  @IsOptional()
  @IsString()
  clienteRazonSocial?: string;

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
  categoriaPrecioIdl?: string;

  @IsOptional()
  @IsString()
  clienteEmail?: string;

  @IsOptional()
  @IsString()
  clienteHomePhone?: string;

  @IsOptional()
  @IsString()
  clienteMobilPhone?: string;

  @IsOptional()
  @IsBoolean()
  clienteRetieneImpuestos?: boolean;

  @IsOptional()
  @IsNumber()
  clienteMatrizKey?: number;
}
