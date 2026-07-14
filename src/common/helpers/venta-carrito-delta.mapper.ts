import type {
  GxCarritoDeltaResponse,
  DeltaCarritoResponseDto,
} from '../interfaces/venta-carrito-delta.interfaces.js';

/**
 * Aplana el SDTVentaCarrito (Delta) + SDTVentaTotales crudos de GeneXus al
 * shape que consume el frontend.
 *
 * `SDTVentaCarrito` viene ausente del body en algunos procedures/ambientes
 * (confirmado en AgregarProductoCarrito — GeneXus solo devolvió
 * `SDTVentaTotales`, pese a que el yaml lo declara en el output) — se
 * tolera su ausencia devolviendo un Delta vacío en vez de asumir que
 * siempre está presente.
 */
export function mapVentaCarritoDelta(
  gx: GxCarritoDeltaResponse,
): DeltaCarritoResponseDto {
  const c = gx.SDTVentaCarrito;
  const t = gx.SDTVentaTotales;
  return {
    carrito: {
      sync: { timeStamp: c?.Sync?.TimeStamp ?? '' },
      itemsActualizados: (c?.ItemsActualizados ?? []).map((i) => ({
        linea: Number(i.Linea),
        productoKey: Number(i.ProductoKey),
        codigoInterno: i.CodigoInterno,
        descripcion: i.Descripcion,
        unidadMedida: i.UnidadMedida,
        cantidad: Number(i.Cantidad),
        precio: Number(i.Precio),
        descuentoMonto: Number(i.DescuentoMonto),
        totalItem: Number(i.TotalItem),
        esNoFacturableOk: i.EsNoFacturableOk,
        editaGlosaOk: i.EditaGlosaOk,
        esAnuladoOk: i.EsAnuladoOk,
        esDescuentoOk: i.EsDescuentoOk,
      })),
      lineasEliminadas: (c?.LineasEliminadas ?? []).map((l) => ({
        lineaEliminadaItem: Number(l.LineaEliminadaItem),
      })),
    },
    totales: {
      montos: {
        totalBruto: Number(t.Montos.TotalBruto),
        totalPagos: Number(t.Montos.TotalPagos),
        vuelto: Number(t.Montos.Vuelto),
        totalLista: Number(t.Montos.TotalLista),
        vueltoLista: Number(t.Montos.VueltoLista),
        totalAMostrar: Number(t.Montos.TotalAMostrar),
      },
      estadoCarrito: {
        existeProductoOk: t.EstadoCarrito.ExisteProductoOk,
        tieneItemLibreOk: t.EstadoCarrito.TieneItemLibreOk,
        tieneProductoTabOk: t.EstadoCarrito.TieneProductoTabOk,
        existeProductoXEncargarDeliveryOk:
          t.EstadoCarrito.ExisteProductoXEncargarDeliveryOk,
      },
      flags: {
        mostrarTotalOk: t.Flags.MostrarTotalOk,
        mostrarPagosOk: t.Flags.MostrarPagosOk,
        mostrarVueltoOk: t.Flags.MostrarVueltoOk,
        mostrarBtnPagosOk: t.Flags.MostrarBtnPagosOk,
      },
    },
  };
}
