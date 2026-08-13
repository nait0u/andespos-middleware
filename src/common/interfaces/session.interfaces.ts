/** Objeto unificado de contexto de sesion para el frontend React */
export interface SessionContext {
  Contexto: {
    EmpKey: number;
    Ambiente: string;
    TokenSeguridad: string;
  };
}
