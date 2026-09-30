export type ContenidoCorreo = {
  titulo: string
  resumen: string
  parrafos: string[]
  accion?: { texto: string; url: string }
  nota?: string
  codigo?: string
}

function escapar(valor: string) {
  return valor.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

/** Inline styles and presentation tables also work in clients without web fonts/CSS. */
export function plantillaCorreo(contenido: ContenidoCorreo) {
  const url = contenido.accion?.url
  if (url && url !== '{{ .ConfirmationURL }}') {
    const destino = new URL(url)
    if (destino.protocol !== 'https:' || destino.username || destino.password) throw new Error('El enlace del correo debe ser HTTPS.')
  }
  const parrafos = contenido.parrafos.map((p) => `<p style="margin:0 0 18px;font-size:16px;line-height:26px;color:#252b26;">${escapar(p)}</p>`).join('\n')
  const accion = contenido.accion ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:26px 0;"><tr><td bgcolor="#385443" style="border-radius:8px;text-align:center;"><a href="${escapar(contenido.accion.url)}" style="display:inline-block;padding:16px 24px;border:1px solid #385443;border-radius:8px;color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;line-height:22px;">${escapar(contenido.accion.texto)}</a></td></tr></table>` : ''
  const respaldo = contenido.accion ? `<p style="margin:24px 0 8px;font-size:13px;line-height:21px;color:#666b63;">Si el botón no funciona, copie y pegue este enlace en su navegador:</p><p style="margin:0;font-size:12px;line-height:20px;word-break:break-all;overflow-wrap:anywhere;"><a href="${escapar(contenido.accion.url)}" style="color:#385443;text-decoration:underline;">${escapar(contenido.accion.url)}</a></p>` : ''
  const codigo = contenido.codigo ? `<p style="margin:24px 0;padding:18px;background:#edf1e9;border:1px solid #e3e5dc;border-radius:8px;text-align:center;color:#252b26;font-size:30px;letter-spacing:8px;font-weight:600;">${escapar(contenido.codigo)}</p>` : ''
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${escapar(contenido.titulo)}</title></head>
<body style="margin:0;padding:0;background:#faf9f5;color:#252b26;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapar(contenido.resumen)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#faf9f5"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 8px 24px;color:#385443;font-size:17px;font-weight:600;line-height:24px;">La Protectora del Alquiler</td></tr>
<tr><td bgcolor="#ffffff" style="padding:32px 24px;border:1px solid #e3e5dc;border-top:4px solid #385443;border-radius:12px;">
<p style="margin:0 0 16px;color:#666b63;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;">Su cuenta · La Protectora</p>
<h1 style="margin:0 0 24px;font-size:28px;font-weight:500;letter-spacing:-0.6px;line-height:35px;color:#252b26;">${escapar(contenido.titulo)}</h1>
${parrafos}${codigo}${accion}
${contenido.nota ? `<p style="margin:24px 0 0;padding-top:20px;border-top:1px solid #e3e5dc;color:#666b63;font-size:13px;line-height:22px;">${escapar(contenido.nota)}</p>` : ''}
${respaldo}
</td></tr><tr><td align="center" style="padding:24px 16px;color:#666b63;font-size:12px;line-height:20px;">La Protectora del Alquiler<br><a href="https://www.protectoradelalquiler.com" style="color:#385443;text-decoration:underline;">protectoradelalquiler.com</a><br><span style="display:inline-block;padding-top:10px;">Este correo es automático. No responda a este mensaje.</span></td></tr>
</table></td></tr></table></body></html>`
}
