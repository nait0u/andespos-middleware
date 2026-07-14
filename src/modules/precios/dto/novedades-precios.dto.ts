import { IsOptional, IsString } from 'class-validator';

export class NovedadesPreciosDto {
  @IsOptional()
  @IsString()
  ubiCod?: string;

  @IsOptional()
  @IsString()
  lastSync?: string; // ISO date-time; persistir TimeStampOut de la respuesta anterior
}
