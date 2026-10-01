import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { runtimeMocks } from './runtime-mocks.mjs'

const require=createRequire(import.meta.url),ts=require('typescript')
export function cargar(file,mocks={},env={}) {
  const mod={exports:{}}
  vm.runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},
  }).outputText,{module:mod,exports:mod.exports,require:name=>mocks[name]??runtimeMocks[name]??require(name),
    process:{env},Buffer,Date,Intl,URL,URLSearchParams,console},{filename:file})
  return mod.exports
}
const util=cargar('lib/util.ts')
export const pruebas=cargar('lib/resultado-busqueda-confirmado.ts',{'server-only':{}},{SUPABASE_SECRET_KEY:'test-only-secret'})
const comunes={
  '@/lib/util':util,
  '@/lib/acceso-consulta':cargar('lib/acceso-consulta.ts'),
  '@/components/icono':cargar('components/icono.tsx'),
  '@/components/avatar':{Avatar:()=>null},
  '@/components/resultado-busqueda':{ResultadoBusqueda:({confirmacion})=>createElement('span',{'data-resultado':confirmacion,hidden:true})},
  '@/components/primera-consulta':{PrimeraConsulta:()=>null},
  '@/lib/consulta-confirmada':{confirmarConsulta:()=>null},
  '@/lib/resultado-busqueda-confirmado':pruebas,
  'next/navigation':{redirect:href=>{throw Object.assign(new Error('redirect'),{href})},notFound:()=>{throw new Error('notFound')}},
}
const BuscadorFichas=cargar('components/buscador-fichas.tsx',comunes).BuscadorFichas
const TarjetaFicha=cargar('components/tarjeta-ficha.tsx',comunes).TarjetaFicha
const EstadoVacio=cargar('components/estado-vacio.tsx',comunes).EstadoVacio
const Paginacion=cargar('components/paginacion.tsx',comunes).Paginacion
export const usuario={id:7,activo:true,rol:'propietario',identificacion:null}
export const ficha={persona:{id:42,identificacion:'102340567',nombre:'José',nombre2:null,apellido1:'Muñoz',apellido2:null,foto_url:null},resenas:2,ultima:'2026-10-01T10:00:00Z',coincidencia:'nombre_completo'}
export async function renderBusqueda({q='Jose Munoz',pagina='1',consulta='',total=1,fichas=[ficha],error=false,acceso=true,rol='propietario'}={}) {
  const Page=cargar('app/fichas/page.tsx',{
    ...comunes,'@/components/buscador-fichas':{BuscadorFichas},'@/components/tarjeta-ficha':{TarjetaFicha},
    '@/components/estado-vacio':{EstadoVacio},'@/components/paginacion':{Paginacion},
    '@/components/espera-aprobacion':{EsperaAprobacion:()=>createElement('p',null,'Permiso requerido')},
    '@/lib/dal':{requireUsuario:async()=>({...usuario,rol}),accesoConsulta:async()=>({puede_consultar:acceso}),
      buscarFichas:async()=>{if(error)throw new Error('Private error details');return{fichas,total}}},
  }).default
  return renderToStaticMarkup(await Page({searchParams:Promise.resolve({q,pagina,consulta})}))
}
export async function renderFicha({q='Jose Munoz',consulta='',resenas=[{id:1,estado:'publicada',creado_en:'2026-10-01T10:00:00Z',comentario:'Synthetic experience.'}],error=false,acceso=true}={}) {
  const Page=cargar('app/fichas/[id]/page.tsx',{
    ...comunes,'@/components/estado-vacio':{EstadoVacio},
    '@/lib/supabase/server':{sinSupabase:()=>false},'@/lib/correo-resenas':{correoResenasConfigurado:()=>false},
    '@/components/admin-formularios':{},'@/components/tarjeta-resena':{TarjetaResena:({resena})=>createElement('p',null,resena.comentario)},
    '@/components/espera-aprobacion':{EsperaAprobacion:()=>createElement('p',null,'Permiso requerido')},
    '@/components/aviso-configuracion':{AvisoConfiguracion:()=>null},
    '@/lib/dal':{requireUsuario:async()=>usuario,puedeConsultar:async()=>acceso,resenasPrivadasVisibles:async()=>[],
      obtenerFicha:async()=>{if(error)throw new Error('Private error');return{...ficha.persona,resenas}}},
  }).default
  return renderToStaticMarkup(await Page({params:Promise.resolve({id:'42'}),searchParams:Promise.resolve({q,consulta})}))
}
export function renderResumen(resumen) {
  const Component=cargar('components/resultados-busqueda-admin.tsx',comunes).ResultadosBusquedaAdmin
  return renderToStaticMarkup(createElement(Component,{resumen}))
}
