import assert from 'node:assert/strict'
import test from 'node:test'
import {renderBusqueda,renderFicha,renderResumen,pruebas} from './helpers/busqueda-vistas.mjs'

const enlaces=html=>[...html.matchAll(/href="([^"]+)"/g)].map(([,href])=>new URL(href.replaceAll('&amp;','&'),'https://example.test'))
const receipt=html=>html.match(/data-resultado="([^"]+)"/)?.[1]

test('ranked results distinguish match strength, mask identity and pass a bound receipt to record links',async()=>{
  const html=await renderBusqueda()
  assert.match(html,/Coincide el nombre completo/)
  assert.match(html,/Personas distintas pueden compartir un nombre/)
  assert.doesNotMatch(html,/102340567/)
  const search=pruebas.leerResultadoConfirmado(receipt(html),7)
  const link=enlaces(html).find(url=>url.pathname==='/fichas/42')
  assert.equal(link.searchParams.get('q'),'Jose Munoz')
  const opened=pruebas.leerResultadoConfirmado(link.searchParams.get('consulta'),7)
  assert.equal(opened.id,search.id);assert.equal(opened.persona,42)
  const detail=await renderFicha({consulta:link.searchParams.get('consulta')})
  assert.ok(receipt(detail))
  const back=enlaces(detail).find(url=>url.pathname==='/fichas')
  const returned=await renderBusqueda({consulta:back.searchParams.get('consulta')})
  assert.equal(pruebas.leerResultadoConfirmado(receipt(returned),7).id,search.id)
})

test('empty results provide search-specific recovery and invalid inputs are excluded from metrics',async()=>{
  const name=await renderBusqueda({q:'Nadie Encontrado',fichas:[],total:0})
  assert.match(name,/Pruebe estos pasos/);assert.match(name,/solo un apellido/)
  assert.equal(pruebas.leerResultadoConfirmado(receipt(name),7).resultados,false)
  const document=await renderBusqueda({q:'102340999',fichas:[],total:0})
  assert.match(document,/Los espacios, puntos y guiones no cambian/)
  assert.match(document,/historial positivo o negativo/)
  for(const q of ['J','123','%%___']) {
    const invalid=await renderBusqueda({q,fichas:[],total:0})
    assert.match(invalid,/Complete los datos para buscar/);assert.equal(receipt(invalid),undefined)
  }
})

test('errors, access denial, directory browsing and administration never emit outcome receipts',async()=>{
  for(const config of [{error:true},{acceso:false},{q:''},{rol:'admin'}]) assert.equal(receipt(await renderBusqueda(config)),undefined)
  for(const config of [{error:true},{acceso:false},{resenas:[]}]) assert.equal(receipt(await renderFicha(config)),undefined)
  assert.equal(receipt(await renderFicha()),undefined,'direct links are not attributed to a search')
})

test('pagination retains the search receipt and out-of-range pages redirect without recording',async()=>{
  const html=await renderBusqueda({total:21})
  const search=pruebas.leerResultadoConfirmado(receipt(html),7)
  const next=enlaces(html).find(url=>url.searchParams.get('pagina')==='2'&&url.pathname==='/fichas')
  assert.ok(next)
  const paged=await renderBusqueda({pagina:'2',consulta:next.searchParams.get('consulta'),total:21})
  assert.equal(pruebas.leerResultadoConfirmado(receipt(paged),7).id,search.id)
  await assert.rejects(renderBusqueda({pagina:'5',total:21,fichas:[]}),error=>error.href.includes('pagina=2'))
})

test('dashboard uses the correct member denominator and distinguishes missing, empty and observed data',()=>{
  const sample={busquedas:10,sin_resultados:3,con_resultados:7,con_apertura:4,miembros:5,miembros_con_apertura:2,miembros_recurrentes:1,documentos:6,nombres:4,iniciada_en:'2026-10-01T10:00:00Z'}
  const html=renderResumen(sample)
  assert.match(html,/40%/);assert.match(html,/30%/);assert.match(html,/20%/)
  assert.match(html,/2 de 5 miembros/)
  assert.doesNotMatch(html,/NaN|Infinity/)
  assert.match(renderResumen(null),/No pudimos cargar/)
  const empty=renderResumen({...sample,busquedas:0,sin_resultados:0,con_resultados:0,con_apertura:0,miembros:0,miembros_con_apertura:0,miembros_recurrentes:0,documentos:0,nombres:0})
  assert.match(empty,/Todavía no hay búsquedas medidas/);assert.doesNotMatch(empty,/NaN|Infinity|0%/)
})
