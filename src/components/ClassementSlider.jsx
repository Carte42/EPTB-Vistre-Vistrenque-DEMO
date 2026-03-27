import React from 'react'

export const CLASSE_ORDER = [
  'aire_exposee',
  'mobilisable_sous_conditions',
  'refuge_local',
  'refuge_communal',
  'refuge_territorial',
]

const CLASSES = [
  {
    id:    'aire_exposee',
    icon:  '⚠',
    label: 'Aire exposée',
    desc:  'En zone PPRI — non mobilisable',
    color: '#ef4444',
  },
  {
    id:    'mobilisable_sous_conditions',
    icon:  '⚑',
    label: 'Aire refuge sous conditions',
    desc:  'Accord foncier ou institutionnel requis',
    color: '#f97316',
  },
  {
    id:    'refuge_local',
    icon:  '★',
    label: 'Aire refuge locale',
    desc:  '< 30 véhicules — échelle quartier',
    color: '#86efac',
  },
  {
    id:    'refuge_communal',
    icon:  '★★',
    label: 'Aire refuge communale',
    desc:  '30–100 véhicules — échelle commune',
    color: '#4ade80',
  },
  {
    id:    'refuge_territorial',
    icon:  '★★★',
    label: 'Aire refuge territoriale',
    desc:  '> 100 véhicules — multi-communes',
    color: '#16a34a',
  },
]

export default function ClassementSlider({ value, onChange }) {
  const current = CLASSES[value] || CLASSES[0]

  return (
    <div className="star-slider">
      <label>Filtre — afficher à partir de</label>

      <span className="star-display" style={{ color: current.color, fontSize: 15, letterSpacing: 1 }}>
        {current.icon} {current.label}
      </span>

      <input
        type="range"
        min={0}
        max={4}
        step={1}
        value={value}
        onChange={e => onChange(parseInt(e.target.value, 10))}
      />

      <ul className="star-legend">
        {[...CLASSES].reverse().map((cl, i) => {
          const idx = CLASSES.indexOf(cl)
          return (
            <li key={cl.id} style={{ opacity: idx >= value ? 1 : 0.35 }}>
              <span className="star-key" style={{ color: cl.color, minWidth: 22, display: 'inline-block' }}>
                {cl.icon}
              </span>
              <span>
                <strong style={{ color: cl.color }}>{cl.label}</strong>
                <span style={{ color: '#64748b' }}> — {cl.desc}</span>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
