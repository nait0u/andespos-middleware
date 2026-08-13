import { IsOptional, IsString } from 'class-validator';

/**
 * Cuerpo aceptado por `POST api/setsession` (doc §2.1): JSON o form-urlencoded.
 * El nombre del claim se busca de forma tolerante (`JWT`/`jwt`), por eso se
 * declaran ambas variantes.
 */
export class SetsessionDto {
  @IsOptional()
  @IsString()
  JWT?: string;

  @IsOptional()
  @IsString()
  jwt?: string;

  @IsOptional()
  @IsString()
  parametro?: string;
}
