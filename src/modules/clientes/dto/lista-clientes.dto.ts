import { IsOptional, IsString } from 'class-validator';

/**
 * Body de POST /clientes/lista.
 *
 * GeneXus (xCliente/GetListaClientesPreVenta) recibe un único campo de
 * texto libre — la búsqueda es server-side, sin paginación. El front
 * debe disparar la query con debounce (~300ms) en cada cambio del input.
 */
export class ListaClientesDto {
  @IsOptional()
  @IsString()
  filtroBuscador?: string = '';
}