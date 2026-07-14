import { IsString, IsNotEmpty } from 'class-validator';

/**
 * Query de GET /api/pos/omnibox/resolver.
 * EmpKey/PuntoAccesoKey se toman del contexto POS (@ContextoPOS), no del query.
 */
export class ResolverOmniboxDto {
  @IsString()
  @IsNotEmpty()
  codigoEscaneado!: string;
}
