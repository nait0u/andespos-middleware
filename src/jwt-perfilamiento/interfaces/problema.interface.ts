/** Diagnóstico no fatal detectado al resolver un alcance — no interrumpe el pipeline. */
export type TipoProblema =
  | 'desborde_puntos'
  | 'alcance_corto'
  | 'etiqueta_repetida'
  | 'sucursal_fantasma';

export interface Problema {
  tipo: TipoProblema;
  detalle: string;
}
