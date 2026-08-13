import { Injectable, Logger } from '@nestjs/common';
import type { AlcanceItem } from '../interfaces/alcance-item.interface.js';
import type { Problema } from '../interfaces/problema.interface.js';

export interface ResultadoResolucionAlcances {
  /** Un dict por cada raíz de alcance distinta encontrada, ya resuelto etiqueta→valor. */
  alcances: Record<string, Record<string, string>>;
  problemas: Problema[];
}

/**
 * Segmentos de un path/template delimitado por puntos: se descartan solo los
 * vacíos de los bordes; los vacíos o con espacio intermedios son datos reales
 * (p. ej. una sucursal ausente viene como segmento en blanco, no ausente).
 */
function segmentos(s: string): string[] {
  const partes = s.split('.');
  return partes.filter((seg, i) => !(seg === '' && (i === 0 || i === partes.length - 1)));
}

/**
 * Alinea valores del path contra etiquetas del template, anclado a la
 * izquierda. Si hay más valores que etiquetas (nombre con puntos, p. ej.
 * "ACEROS AZA S.A."), la última etiqueta absorbe los segmentos sobrantes
 * (tail greedy) reconstruyendo el valor con sus puntos. Generalizado a
 * cualquier alcance, no solo a uno con raíz "Empresa" — esto es lo que
 * cumple la promesa del doc §3.4 de que AC pueda agregar contextos nuevos
 * sin cambios de código en el consumidor.
 */
function alinear(etiquetas: string[], valores: string[]): Map<string, string> {
  const mapa = new Map<string, string>();
  if (valores.length > etiquetas.length && etiquetas.length > 0) {
    const ultima = etiquetas[etiquetas.length - 1]!;
    for (let i = 0; i < etiquetas.length - 1; i++) mapa.set(etiquetas[i]!, valores[i] ?? '');
    mapa.set(ultima, valores.slice(etiquetas.length - 1).join('.'));
  } else {
    for (let i = 0; i < etiquetas.length; i++) mapa.set(etiquetas[i]!, valores[i] ?? '');
  }
  return mapa;
}

function etiquetasRepetidas(etiquetas: string[]): string[] {
  const vistas = new Set<string>();
  const repetidas = new Set<string>();
  for (const e of etiquetas) {
    if (vistas.has(e)) repetidas.add(e);
    vistas.add(e);
  }
  return [...repetidas];
}

/** La raíz identifica a qué contexto pertenece el alcance (p. ej. "Empresa", "Ambiente"). */
function raizDe(etiquetas: string[], valores: string[]): string {
  const candidato = etiquetas[0] ?? valores[0] ?? '';
  return candidato.replace(/^\*/, '');
}

@Injectable()
export class AlcanceResolverService {
  private readonly logger = new Logger(AlcanceResolverService.name);

  /**
   * Resuelve TODOS los alcances del token (doc §3.4), sin distinguir a priori
   * cuál es "Empresa" u otra raíz conocida — cada alcance se resuelve por su
   * cuenta y queda disponible bajo la clave de su raíz.
   */
  resolver(items: AlcanceItem[]): ResultadoResolucionAlcances {
    this.logger.debug(`resolver: ${items.length} alcance(s) crudo(s) a resolver`);
    const resultado: ResultadoResolucionAlcances = { alcances: {}, problemas: [] };

    for (const item of items) {
      const { AlcancePath, AlcanceTemplatePath } = item;
      const valoresCompletos = segmentos(AlcancePath);
      const etiquetasCompletos = segmentos(AlcanceTemplatePath);
      const raiz = raizDe(etiquetasCompletos, valoresCompletos);
      // La posición 1 (raíz) solo identifica el template — no es un valor
      // etiquetado (doc §3.4). Se alinean únicamente las posiciones siguientes.
      const valores = valoresCompletos.slice(1);
      const etiquetas = etiquetasCompletos.slice(1);
      const detalleBase = `alcance '${AlcancePath}' vs template '${AlcanceTemplatePath}'`;

      const repetidas = etiquetasRepetidas(etiquetas);
      if (repetidas.length > 0) {
        resultado.problemas.push({
          tipo: 'etiqueta_repetida',
          detalle: `etiqueta(s) repetida(s) ${repetidas.join(', ')} en ${detalleBase}`,
        });
      }

      if (valores.length > etiquetas.length) {
        resultado.problemas.push({
          tipo: 'desborde_puntos',
          detalle: `${valores.length - etiquetas.length} segmento(s) de más (valor con puntos) en ${detalleBase}`,
        });
      } else if (valores.length < etiquetas.length) {
        resultado.problemas.push({
          tipo: 'alcance_corto',
          detalle: `${etiquetas.length - valores.length} valor(es) de menos en ${detalleBase}`,
        });
      }

      const mapa = alinear(etiquetas, valores);

      if (etiquetas.includes('SucursalIdL') && etiquetas.includes('SucursalNombre')) {
        const sucursalFantasma = ['SucursalIdL', 'SucursalNombre'].some((e) => (mapa.get(e) ?? '').trim() === '');
        if (sucursalFantasma) {
          resultado.problemas.push({
            tipo: 'sucursal_fantasma',
            detalle: `sucursal sin datos (segmentos en blanco) en ${detalleBase}`,
          });
        }
      }

      resultado.alcances[raiz] = Object.fromEntries(mapa);
      this.logger.debug(`resolver: raíz "${raiz}" → ${JSON.stringify(resultado.alcances[raiz])}`);
    }

    if (resultado.problemas.length > 0) {
      this.logger.warn(`resolver: ${resultado.problemas.length} problema(s) detectado(s):`);
      for (const p of resultado.problemas) {
        this.logger.warn(`  - [${p.tipo}] ${p.detalle}`);
      }
    }

    return resultado;
  }
}
