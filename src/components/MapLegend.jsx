import React from 'react'
import { DEMO_CLIENT } from '../config.js'

const S = {
  sectionTitle: {
    fontSize: 12, color: '#64748b', textTransform: 'uppercase',
    letterSpacing: '0.08em', fontWeight: 600, marginBottom: 6,
  },
  item: { color: '#cbd5e1', fontSize: 14 },
}

function SectionTitle({ children }) {
  return <div style={S.sectionTitle}>{children}</div>
}

function Item({ svg, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
      {svg}
      <span style={S.item}>{label}</span>
    </div>
  )
}

export default function MapLegend({ showPrix2, onTogglePrix2 }) {
  return (
    <div
      data-ob-anchor="legend"
      style={{
        position: 'absolute', bottom: 28, right: 12, zIndex: 900,
        background: 'rgba(10,18,40,0.92)', border: '1px solid #2a4060',
        borderRadius: 10, padding: '12px 16px', width: 232,
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        backdropFilter: 'blur(6px)',
      }}
    >
      <div style={{ fontSize: 16, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, fontWeight: 600 }}>
        Légende
      </div>

      {/* Périmètres */}
      <Item svg={<svg width="36" height="12"><line x1="0" y1="6" x2="36" y2="6" stroke="#f0c040" strokeWidth="2.5" strokeDasharray="6 3"/></svg>}
            label="Zone de démonstration" />
      <div style={{ marginBottom: 10 }}>
        <Item svg={<svg width="36" height="12"><line x1="0" y1="6" x2="36" y2="6" stroke="#7eb3ff" strokeWidth="2.5" strokeDasharray="8 4"/></svg>}
              label="Périmètre de la consultation" />
      </div>

      {DEMO_CLIENT ? (
        <>
          {/* Zones aléa */}
          <div style={{ borderTop: '1px solid #1e293b', paddingTop: 10, marginBottom: 10 }}>
            <SectionTitle>Zones inondables (aléa)</SectionTitle>
            <Item svg={<svg width="24" height="14"><rect x="1" y="1" width="22" height="12" rx="2" fill="#fb923c44" stroke="#fb923c" strokeWidth="1.5"/></svg>}
                  label="Crue fréquente T20–40" />
            <Item svg={<svg width="24" height="14"><rect x="1" y="1" width="22" height="12" rx="2" fill="#60a5fa44" stroke="#60a5fa" strokeWidth="1.5"/></svg>}
                  label="Crue de référence T100" />
            <Item svg={<svg width="24" height="14"><rect x="1" y="1" width="22" height="12" rx="2" fill="#a78bfa44" stroke="#a78bfa" strokeWidth="1.5"/></svg>}
                  label="Crue exceptionnelle T1000" />
          </div>

          {/* Aires de stationnement */}
          <div style={{ borderTop: '1px solid #1e293b', paddingTop: 10, marginBottom: 10 }}>
            <SectionTitle>Aires de stationnement publiques</SectionTitle>
            <Item svg={<svg width="24" height="14"><rect x="1" y="1" width="22" height="12" rx="2" fill="#22c55e44" stroke="#22c55e" strokeWidth="2"/></svg>}
                  label="Aire de refuge (hors d'eau)" />
            <Item svg={<svg width="24" height="14"><rect x="1" y="1" width="22" height="12" rx="2" fill="#ef444444" stroke="#ef4444" strokeWidth="2"/></svg>}
                  label="Aire inondable (à évacuer)" />
          </div>

          {/* Prix 2 */}
          <div style={{ borderTop: '1px solid #1e293b', paddingTop: 10, marginBottom: 10 }}>
            <div
              onClick={onTogglePrix2}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: 8 }}
            >
              <span style={{ ...S.item, fontWeight: 600, color: showPrix2 ? '#e2e8f0' : '#64748b' }}>
                Mobilisable (prix 2)
              </span>
              <div style={{
                position: 'relative', width: 36, height: 20, flexShrink: 0,
                background: showPrix2 ? '#22c55e' : '#334155',
                borderRadius: 10, transition: 'background 0.2s',
                border: `1px solid ${showPrix2 ? '#16a34a' : '#475569'}`,
              }}>
                <div style={{
                  position: 'absolute', top: 2, left: showPrix2 ? 17 : 2,
                  width: 14, height: 14, background: '#fff', borderRadius: '50%',
                  transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                }}/>
              </div>
            </div>
            <Item svg={<svg width="24" height="14"><rect x="1" y="1" width="22" height="12" rx="2" fill="#22c55e22" stroke="#22c55e" strokeWidth="1.5" strokeDasharray="6 4"/></svg>}
                  label="Hors d'eau" />
            <Item svg={<svg width="24" height="14"><rect x="1" y="1" width="22" height="12" rx="2" fill="#ef444422" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="6 4"/></svg>}
                  label="Inondable" />
          </div>

          {/* Itinéraires */}
          <div style={{ borderTop: '1px solid #1e293b', paddingTop: 10 }}>
            <SectionTitle>Itinéraires (au clic sur un parking)</SectionTitle>
            <Item svg={<svg width="24" height="8"><line x1="0" y1="4" x2="24" y2="4" stroke="#4ade80" strokeWidth="2.5"/></svg>}
                  label="Route accessible" />
            <Item svg={<svg width="24" height="8"><line x1="0" y1="4" x2="24" y2="4" stroke="#ef4444" strokeWidth="2.5"/></svg>}
                  label="Segment inondé / bloqué" />
            <Item svg={<svg width="24" height="10"><circle cx="12" cy="5" r="4" fill="#f59e0b" stroke="#f59e0b" strokeWidth="1.5"/></svg>}
                  label="Point d'accès naufragés de la route (prix 3)" />
          </div>
        </>
      ) : null}
    </div>
  )
}
