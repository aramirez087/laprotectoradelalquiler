// information_schema puede ocultar tablas sin permisos. Consultar directamente
// permite distinguir una tabla ausente de una cuenta sin acceso de lectura.
export async function existeTablaLegacy(conexion, tabla) {
  try {
    await conexion.query('SELECT 1 FROM ?? LIMIT 0', [tabla]);
    return true;
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE') return false;
    if (['ER_TABLEACCESS_DENIED_ERROR', 'ER_COLUMNACCESS_DENIED_ERROR'].includes(error.code)) {
      throw new Error(`MySQL no permite leer la tabla ${tabla}. Revise los permisos SELECT de la cuenta de lectura.`, { cause: error });
    }
    throw error;
  }
}
