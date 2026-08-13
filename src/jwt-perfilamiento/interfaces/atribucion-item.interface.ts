/**
 * Atribución cruda tal como viene en el token: path del árbol funcional +
 * propiedad de permisos. Este paquete solo transporta el dato — interpretar
 * la propiedad (RWXD u otro modelo) es responsabilidad de la app consumidora.
 */
export interface AtribucionItem {
  AtribucionPath: string;
  Propiedad: string;
}
