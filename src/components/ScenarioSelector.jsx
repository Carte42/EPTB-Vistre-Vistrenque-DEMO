import React from 'react'

const SCENARIOS = [
  {
    id: 't20',
    label: 'T20–40',
    desc: 'Crue fréquente',
    sublabel: 'Période de retour 20–40 ans',
    color: '#f97316',
    icon: '🌦',
  },
  {
    id: 't100',
    label: 'T100',
    desc: 'Crue de référence',
    sublabel: 'Période de retour 100 ans',
    color: '#60a5fa',
    icon: '🌧',
  },
  {
    id: 't1000',
    label: 'T1000',
    desc: 'Crue exceptionnelle',
    sublabel: 'Période de retour 1 000 ans',
    color: '#7c3aed',
    icon: '⛈',
  },
]

export default function ScenarioSelector({ value, onChange }) {
  return (
    <div style={{ padding: '0 0 2px' }}>
      <div style={{
        fontSize: 15, color: '#475569', textTransform: 'uppercase',
        letterSpacing: '0.08em', marginBottom: 10, fontWeight: 600,
      }}>
        Scénario d'inondation
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {SCENARIOS.map(s => {
          const active = value === s.id
          return (
            <button
              key={s.id}
              onClick={() => onChange(s.id)}
              title={s.sublabel}
              style={{
                flex: 1,
                padding: '9px 4px',
                borderRadius: 6,
                border: `1.5px solid ${active ? s.color : '#2a4060'}`,
                background: active ? `${s.color}22` : 'transparent',
                color: active ? s.color : '#64748b',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ fontSize: 40, lineHeight: 1, marginBottom: 3 }}>{s.icon}</div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{s.label}</div>
              <div style={{ fontSize: 12, marginTop: 2, opacity: 0.85 }}>{s.desc}</div>
            </button>
          )
        })}
      </div>
      <div style={{ fontSize: 13, color: '#475569', marginTop: 8, fontStyle: 'italic', lineHeight: 1.4 }}>
        {SCENARIOS.find(s => s.id === value)?.sublabel}
        {value === 't1000' && (
          <span style={{ color: '#7c3aed99' }}> — données T1000 provisoires (CARTINO-2D en cours d'intégration)</span>
        )}
      </div>
    </div>
  )
}
