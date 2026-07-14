import { IsString, IsNotEmpty } from 'class-validator';

export class UploadPreciosDto {
  @IsString()
  @IsNotEmpty()
  parmTransConf!: string;

  @IsString()
  @IsNotEmpty()
  fileBlobFile!: string; // archivo en base64 (el middleware lo sube a /gxobject)

  @IsString()
  @IsNotEmpty()
  fileName!: string;
}
