// Each pair is [destination column, source column]. IDs belong to their own
// database: never assume a seeded destination ID has the legacy meaning.
export const catalogos = [
  { tabla: 'paises', fuentes: ['tb_paises'], campos: [['iso2', 'iso'], ['nombre', 'nombre']], id: 'id' },
  { tabla: 'provincias', fuentes: ['tb_provincia'], campos: [['codigo', 'camp_provincia'], ['nombre', 'camp_nombre_provincia']], id: 'camp_id_provincia' },
  { tabla: 'cantones', fuentes: ['tb_canton'], campos: [['provincia_id', 'camp_idProvincia'], ['codigo', 'camp_codigo'], ['nombre', 'camp_canton']], id: 'camp_id', padre: ['provincia_id', 'provincias'] },
  { tabla: 'distritos', fuentes: ['tb_distrito'], campos: [['canton_id', 'camp_idCanton'], ['codigo', 'camp_codigo'], ['nombre', 'camp_distrito']], id: 'camp_id', padre: ['canton_id', 'cantones'] },
  { tabla: 'barrios', fuentes: ['tb_barrio'], campos: [['distrito_id', 'camp_idDistrito'], ['codigo', 'camp_codigo'], ['nombre', 'camp_barrio']], id: 'camp_id', padre: ['distrito_id', 'distritos'] },
  { tabla: 'calificaciones', fuentes: ['tb_calificacion', 'tb_calificaciones'], campos: [['valor', 'camp_valor'], ['texto', 'camp_texto']], id: 'camp_id_calificacion' },
  { tabla: 'etiquetas', fuentes: ['tb_etiquetainquilino'], campos: [['nombre', 'camp_etiquetaInquilino_nombre']], id: 'camp_id_etiquetaInquilino', constantes: { tipo: 'inquilino' } },
  { tabla: 'conductas', fuentes: ['tb_conducta'], campos: [['nombre', 'camp_conducta']], id: 'camp_id_conducta' },
  { tabla: 'tipos_alquiler', fuentes: ['tb_tipoalquiler'], campos: [['nombre', 'camp_tipoAlquiler_nombre']], id: 'camp_id_tipoAlquiler' },
  { tabla: 'tipos_contrato', fuentes: ['tb_tipo_contrato', 'tb_tipos_contrato'], campos: [['nombre', 'camp_nombre']], id: 'camp_id_tipo_contrato' },
  { tabla: 'tiempos_alquiler', fuentes: ['tb_tiempo_alquiler', 'tb_tiempoalquiler'], campos: [['nombre', 'camp_nombre']], id: 'camp_id' },
  { tabla: 'danos_vivienda', fuentes: ['tb_dano_vivienda', 'tb_danovivienda'], campos: [['nombre', 'camp_nombre']], id: 'camp_id' },
  { tabla: 'procesos_judiciales', fuentes: ['tb_proceso_judicial', 'tb_procesojudicial'], campos: [['nombre', 'camp_nombre']], id: 'camp_id' },
];

const normal = (v) => String(v ?? '').trim().toLocaleLowerCase('es');
const clave = (config, fila) => JSON.stringify([
  config.padre ? fila[config.padre[0]] : null,
  config.tabla === 'calificaciones' ? Number(fila.valor) : normal(fila.nombre),
  fila.tipo ?? null,
]);

export async function importarCatalogos({ db, buscarTabla, filas, avisar }) {
  const mapas = {};
  const cantidades = {};
  for (const config of catalogos) {
    const { tabla, fuentes, campos, id, padre } = config;
    const mapa = mapas[tabla] = new Map();
    const fuente = await buscarTabla(fuentes);
    if (!fuente) continue;
    const origen = await filas(`SELECT ${[id, ...campos.map(([, campo]) => campo)].map((c) => `\`${c}\``).join(', ')} FROM \`${fuente}\` ORDER BY \`${id}\``);
    const destino = (await db.query(`SELECT * FROM ${tabla}`)).rows;
    const porClave = new Map();
    for (const fila of destino) {
      const k = clave(config, fila);
      if (porClave.has(k)) throw new Error(`Catálogo ${tabla}: hay coincidencias ambiguas en el destino.`);
      porClave.set(k, fila);
    }
    let importadas = 0;
    const nuevas = new Map();
    const equivalencias = new Map();
    for (const r of origen) {
      const valores = Object.fromEntries(campos.map(([col, source]) => [col, r[source]]));
      Object.assign(valores, config.constantes);
      for (const campo of ['nombre', 'texto']) {
        if (campo in valores) {
          valores[campo] = String(valores[campo] ?? '').trim();
          if (!valores[campo]) {
            valores[campo] = `Sin nombre legacy (${fuente}#${r[id]})`;
            avisar('catalogo_sin_nombre', 'Se conservaron entradas de catálogo sin nombre con una etiqueta de origen.');
          }
        }
      }
      if (padre) {
        valores[padre[0]] = valores[padre[0]] == null ? null : mapas[padre[1]].get(Number(valores[padre[0]])) ?? null;
        if (valores[padre[0]] == null) {
          avisar(`catalogo_huerfano_${tabla}`, `${tabla}: entradas sin ubicación superior válida; sus referencias quedarán vacías.`);
          continue;
        }
      }
      const k = clave(config, valores);
      if (!porClave.has(k)) nuevas.set(k, valores);
      equivalencias.set(Number(r[id]), k);
      importadas++;
    }
    const pendientes = [...nuevas.values()];
    for (let inicio = 0; inicio < pendientes.length; inicio += 500) {
      const lote = pendientes.slice(inicio, inicio + 500);
      const columnas = Object.keys(lote[0]);
      const placeholders = lote.map((_, fila) => `(${columnas.map((_, col) => `$${fila * columnas.length + col + 1}`).join(', ')})`);
      const q = await db.query(
        `INSERT INTO ${tabla} (${columnas.join(', ')}) VALUES ${placeholders.join(', ')} RETURNING *`,
        lote.flatMap((r) => columnas.map((c) => r[c])),
      );
      for (const r of q.rows) porClave.set(clave(config, r), r);
    }
    for (const [legacyId, k] of equivalencias) mapa.set(legacyId, porClave.get(k).id);
    cantidades[fuente] = importadas;
  }
  return { mapas, cantidades };
}
