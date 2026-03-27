import React from 'react'

const GEORISQUES_WMS = 'https://mapsref.brgm.fr/wxs/georisques/risques'
const PPRI_LEGEND    = `${GEORISQUES_WMS}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetLegendGraphic&LAYER=PPRN_ZONE_INOND&FORMAT=image/png`

export default function MapLegend({ aleaLayers, onToggleAleaLayer }) {
  const ppriActive     = !!aleaLayers?.ppri
  const cadastreActive = !!aleaLayers?.cadastre

  return (
    <div
      data-ob-anchor="legend"
      style={{
        position: 'absolute', bottom: 28, right: 12, zIndex: 900,
        background: 'rgba(10,18,40,0.92)', border: '1px solid #2a4060',
        borderRadius: 10, padding: '14px 20px', minWidth: 300,
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        backdropFilter: 'blur(6px)',
      }}
    >
      <div style={{ fontSize: 13, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, fontWeight: 600 }}>
        Légende
      </div>

      {/* Périmètres */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
        <svg width="36" height="12"><line x1="0" y1="6" x2="36" y2="6" stroke="#f0c040" strokeWidth="2.5" strokeDasharray="6 3"/></svg>
        <span style={{ color: '#e2e8f0', fontSize: 14 }}>Zone de démonstration</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <svg width="36" height="12"><line x1="0" y1="6" x2="36" y2="6" stroke="#7eb3ff" strokeWidth="2.5" strokeDasharray="8 4"/></svg>
        <span style={{ color: '#e2e8f0', fontSize: 14 }}>Périmètre de la consultation</span>
      </div>

      <div style={{ borderTop: '1px solid #1e293b', paddingTop: 10, marginBottom: 4 }}>
        <div style={{ fontSize: 13, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, fontWeight: 600 }}>
          Couches optionnelles
        </div>

        {/* PPRI */}
        <button
          onClick={() => onToggleAleaLayer('ppri')}
          style={{
            display: 'flex', alignItems: 'center', gap: 9, width: '100%',
            background: ppriActive ? 'rgba(108,142,255,0.15)' : 'transparent',
            border: `1px solid ${ppriActive ? '#6c8eff66' : '#2a406066'}`,
            borderRadius: 5, padding: '6px 10px', cursor: 'pointer',
            color: ppriActive ? '#6c8eff' : '#94a3b8', fontSize: 14,
            marginBottom: 6, textAlign: 'left',
          }}
        >
          <span style={{ fontSize: 18 }}>🌊</span>
          <span>Aléa inondation (PPRI)</span>
          <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, opacity: 0.8 }}>{ppriActive ? 'ON' : 'OFF'}</span>
        </button>
        {ppriActive && (
          <div style={{ marginBottom: 6, background: '#fff', borderRadius: 4, padding: '6px 8px' }}>
            <img src={PPRI_LEGEND} alt="Légende PPRI" style={{ maxWidth: '100%', display: 'block' }} />
          </div>
        )}

        {/* Cadastre */}
        <button
          onClick={() => onToggleAleaLayer('cadastre')}
          style={{
            display: 'flex', alignItems: 'center', gap: 9, width: '100%',
            background: cadastreActive ? 'rgba(192,132,252,0.15)' : 'transparent',
            border: `1px solid ${cadastreActive ? '#c084fc66' : '#2a406066'}`,
            borderRadius: 5, padding: '6px 10px', cursor: 'pointer',
            color: cadastreActive ? '#c084fc' : '#94a3b8', fontSize: 14,
            textAlign: 'left',
          }}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>⊞</span>
          <span>Cadastre parcellaire</span>
          <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, opacity: 0.8 }}>{cadastreActive ? 'ON' : 'OFF'}</span>
        </button>
      </div>
    </div>
  )
}
