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
        borderRadius: 8, padding: '10px 14px', minWidth: 210,
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        backdropFilter: 'blur(6px)',
      }}
    >
      <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
        Légende
      </div>

      {/* Périmètres */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
        <svg width="28" height="10"><line x1="0" y1="5" x2="28" y2="5" stroke="#f0c040" strokeWidth="2" strokeDasharray="6 3"/></svg>
        <span style={{ color: '#e2e8f0', fontSize: 11 }}>Zone de démonstration</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <svg width="28" height="10"><line x1="0" y1="5" x2="28" y2="5" stroke="#7eb3ff" strokeWidth="2" strokeDasharray="8 4"/></svg>
        <span style={{ color: '#e2e8f0', fontSize: 11 }}>Périmètre de la consultation</span>
      </div>

      <div style={{ borderTop: '1px solid #1e293b', paddingTop: 8, marginBottom: 4 }}>
        <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
          Couches optionnelles
        </div>

        {/* PPRI */}
        <button
          onClick={() => onToggleAleaLayer('ppri')}
          style={{
            display: 'flex', alignItems: 'center', gap: 7, width: '100%',
            background: ppriActive ? 'rgba(108,142,255,0.15)' : 'transparent',
            border: `1px solid ${ppriActive ? '#6c8eff66' : '#2a406066'}`,
            borderRadius: 4, padding: '4px 8px', cursor: 'pointer',
            color: ppriActive ? '#6c8eff' : '#94a3b8', fontSize: 11,
            marginBottom: 4, textAlign: 'left',
          }}
        >
          <span style={{ fontSize: 13 }}>🌊</span>
          <span>Aléa inondation (PPRI)</span>
          <span style={{ marginLeft: 'auto', fontSize: 10, opacity: 0.7 }}>{ppriActive ? 'ON' : 'OFF'}</span>
        </button>
        {ppriActive && (
          <div style={{ marginBottom: 4 }}>
            <img src={PPRI_LEGEND} alt="Légende PPRI" style={{ maxWidth: '100%', borderRadius: 4 }} />
          </div>
        )}

        {/* Cadastre */}
        <button
          onClick={() => onToggleAleaLayer('cadastre')}
          style={{
            display: 'flex', alignItems: 'center', gap: 7, width: '100%',
            background: cadastreActive ? 'rgba(192,132,252,0.15)' : 'transparent',
            border: `1px solid ${cadastreActive ? '#c084fc66' : '#2a406066'}`,
            borderRadius: 4, padding: '4px 8px', cursor: 'pointer',
            color: cadastreActive ? '#c084fc' : '#94a3b8', fontSize: 11,
            textAlign: 'left',
          }}
        >
          <span style={{ fontSize: 13 }}>🗂</span>
          <span>Cadastre parcellaire</span>
          <span style={{ marginLeft: 'auto', fontSize: 10, opacity: 0.7 }}>{cadastreActive ? 'ON' : 'OFF'}</span>
        </button>
      </div>
    </div>
  )
}
