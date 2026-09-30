import { ImageResponse } from 'next/og'

export const alt = 'La Protectora del Alquiler: reseñas de inquilinos en Costa Rica'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function ImagenCompartida() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          background: '#faf9f5',
          color: '#20291f',
          padding: '64px 72px',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <svg width="66" height="66" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="10" fill="#385443" />
            <path d="m8 15 8-7 8 7M10 14v10h12V14M14 24v-7h4v7" fill="none" stroke="#faf9f5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 30, fontWeight: 700 }}>La Protectora</span>
            <span style={{ fontSize: 17, letterSpacing: 3 }}>DEL ALQUILER</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div style={{ display: 'flex', fontSize: 68, fontWeight: 700, letterSpacing: -2, lineHeight: 1.08, maxWidth: 1000 }}>
            Reseñas de inquilinos en Costa Rica
          </div>
          <div style={{ display: 'flex', fontSize: 29, lineHeight: 1.4, color: '#385443' }}>
            Experiencias de propietarios y agencias.
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #d5d9ce', paddingTop: 24 }}>
          <span style={{ fontSize: 23, color: '#5c665b' }}>Alquile con confianza.</span>
          <span style={{ fontSize: 23, color: '#385443' }}>protectoradelalquiler.com</span>
        </div>
      </div>
    ),
    size,
  )
}
