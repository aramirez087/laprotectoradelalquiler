-- ============================================================================
-- Seeds de desarrollo — datos de lookups (CR) + demo
-- La migración legacy (scripts/migrar-legacy.mjs) sobreescribe/completa
-- provincias, cantones, distritos, barrios y etiquetas con los datos reales.
-- ============================================================================

INSERT INTO paises (iso2, nombre) VALUES
  ('CR', 'Costa Rica'),
  ('NI', 'Nicaragua'),
  ('PA', 'Panamá'),
  ('US', 'Estados Unidos'),
  ('MX', 'México'),
  ('ES', 'España')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO provincias (codigo, nombre) VALUES
  (1, 'San José'),
  (2, 'Alajuela'),
  (3, 'Cartago'),
  (4, 'Heredia'),
  (5, 'Guanacaste'),
  (6, 'Puntarenas'),
  (7, 'Limón')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO calificaciones (valor, texto) VALUES
  (1, 'Muy malo'),
  (2, 'Malo'),
  (3, 'Regular'),
  (4, 'Bueno'),
  (5, 'Excelente')
ON CONFLICT (valor) DO NOTHING;

INSERT INTO tipos_contrato (nombre) VALUES
  ('Mensual'), ('Trimestral'), ('Semestral'), ('Anual'), ('Por días'), ('Sin contrato')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO tipos_alquiler (nombre) VALUES
  ('Casa'), ('Apartamento'), ('Condominio'), ('Oficina'), ('Bodega'), ('Terreno'), ('Otro')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO tiempos_alquiler (nombre) VALUES
  ('Menos de 1 mes'), ('1 a 3 meses'), ('3 a 6 meses'),
  ('6 meses a 1 año'), ('1 a 2 años'), ('Más de 2 años')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO danos_vivienda (nombre) VALUES
  ('Sin daños'), ('Leve'), ('Moderado'), ('Grave'), ('Propiedad destruida')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO procesos_judiciales (nombre) VALUES
  ('Ninguno'), ('Demanda por rentas'), ('Proceso de desalojo'),
  ('Proceso penal'), ('Ejecución de sentencia')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO conductas (nombre) VALUES
  ('Puntual con los pagos'), ('Mantuvo la propiedad'), ('Respetuoso con vecinos'),
  ('Ruidoso'), ('Fiestas no autorizadas'), ('Huéspedes no declarados'),
  ('Retrasos constantes de pago'), ('Vandalismo')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO etiquetas (nombre, tipo) VALUES
  ('Puntual con pagos', 'inquilino'),
  ('Mantuvo la propiedad', 'inquilino'),
  ('Respetuoso', 'inquilino'),
  ('Ruidoso', 'inquilino'),
  ('Fiestas', 'inquilino'),
  ('Huéspedes no autorizados', 'inquilino'),
  ('No pagó rentas', 'inquilino'),
  ('Daños a la propiedad', 'inquilino'),
  ('Abandono de la propiedad', 'inquilino'),
  ('Mascotas no declaradas', 'inquilino'),
  ('Problemas con vecinos', 'inquilino'),
  ('Trabajador serio', 'inquilino'),
  ('Comunicativo', 'propietario'),
  ('Responde rápido', 'propietario'),
  ('Mantenimientos al día', 'propietario')
ON CONFLICT (nombre, tipo) DO NOTHING;

-- Demo local (solo para desarrollo)
INSERT INTO usuarios (email, nombre, rol, activo) VALUES
  ('admin@laprotec.test', 'Administración La Protectora', 'admin', true),
  ('propietario@laprotec.test', 'María Solís', 'propietario', true),
  ('inquilino@laprotec.test', 'Jorge Mora', 'inquilino', true)
ON CONFLICT (email) DO NOTHING;

-- Personas demo con cédulas ficticias (para probar la búsqueda de fichas)
INSERT INTO personas (identificacion, nombre, apellido1, apellido2, provincia_id, sexo) VALUES
  ('7-1234-0001', 'José', 'Quesada', 'Pérez',   1, 'masculino'),
  ('7-5678-0002', 'Ana',  'Castro',  'Ramírez', 1, 'femenino'),
  ('2-9012-0003', 'Carlos','Solano', 'Vargas',  2, 'masculino')
ON CONFLICT (identificacion) DO NOTHING;

-- Reseñas demo escritas por el usuario propietario@laprotec.test
INSERT INTO resenas (persona_id, autor_id, tipo, calificacion_id, recomienda, drogas,
                     dano_vivienda_id, proceso_judicial_id, tipo_alquiler_id, comentario, estado, fuente, id_fuente)
SELECT p.id,
       (SELECT id FROM usuarios WHERE email = 'propietario@laprotec.test'),
       'inquilino', c.id, r.recomienda, r.drogas,
       (SELECT id FROM danos_vivienda WHERE nombre = r.dano),
       (SELECT id FROM procesos_judiciales WHERE nombre = 'Ninguno'),
       (SELECT id FROM tipos_alquiler WHERE nombre = 'Apartamento'),
       r.comentario, 'publicada', 'demo', r.id_fuente
FROM (VALUES
  ('7-1234-0001', 4, true,  false, 'Sin daños',  1, 'Excelente inquilino: puntual con los pagos y dejó el apartamento impecable.'),
  ('7-5678-0002', 2, false, false, 'Moderado',   2, 'Pagó con retrasos y dejó daños en el piso. No lo volvería a alquilar.'),
  ('2-9012-0003', 3, true,  false, 'Leve',       3, 'Regular: se fue sin avisar, pero la propiedad quedó en buen estado.')
) AS r (identificacion, valor, recomienda, drogas, dano, id_fuente, comentario)
JOIN personas p ON p.identificacion = r.identificacion
JOIN calificaciones c ON c.valor = r.valor
ON CONFLICT (fuente, id_fuente) DO NOTHING;

INSERT INTO resena_etiquetas (resena_id, etiqueta_id)
SELECT r.id, e.id
FROM resenas r
JOIN personas p ON p.id = r.persona_id
JOIN etiquetas e ON e.nombre = 'Puntual con pagos'
WHERE r.fuente = 'demo' AND r.id_fuente = 1
ON CONFLICT DO NOTHING;

INSERT INTO resena_etiquetas (resena_id, etiqueta_id)
SELECT r.id, e.id
FROM resenas r
JOIN personas p ON p.id = r.persona_id
JOIN etiquetas e ON e.nombre = 'Mantuvo la propiedad'
WHERE r.fuente = 'demo' AND r.id_fuente = 1
ON CONFLICT DO NOTHING;

INSERT INTO resena_etiquetas (resena_id, etiqueta_id)
SELECT r.id, e.id
FROM resenas r
JOIN personas p ON p.id = r.persona_id
JOIN etiquetas e ON e.nombre = 'Daños a la propiedad'
WHERE r.fuente = 'demo' AND r.id_fuente = 2
ON CONFLICT DO NOTHING;
