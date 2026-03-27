import React from 'react'

const LEGEND = [
  { stars: 5, label: 'Parking très probable — grand emprise, marquage au sol visible', color: '#e74c3c' },
  { stars: 4, label: 'Parking probable — nouvelle surface imperméabilisée identifiée', color: '#e67e22' },
  { stars: 3, label: 'Parking potentiel — emprise à confirmer sur orthophotos', color: '#f1c40f' },
  { stars: 2, label: 'À investiguer — surface suspecte, contexte ambigu', color: '#3498db' },
  { stars: 1, label: 'Signal faible — indice non confirmé', color: '#9b59b6' },
  { stars: 0, label: 'Non pertinent / hors périmètre', color: '#95a5a6' },
]

function starColor(value) {
  if (value >= 5) return '#e74c3c'
  if (value >= 4) return '#e67e22'
  if (value >= 3) return '#f1c40f'
  if (value >= 2) return '#3498db'
  if (value >= 1) return '#9b59b6'
  return '#95a5a6'
}

function renderStars(value) {
  const color = starColor(value)
  const full = '★'.repeat(value)
  const empty = '☆'.repeat(5 - value)
  return (
    <span className="star-display">
      <span style={{ color }}>{full}</span>
      <span style={{ color: '#3a4a6a' }}>{empty}</span>
    </span>
  )
}

export default function StarSlider({ value, onChange }) {
  return (
    <div className="star-slider">
      <label>Priorité</label>
      {renderStars(value)}
      <input
        type="range"
        min={0}
        max={5}
        step={1}
        value={value}
        onChange={e => onChange(parseInt(e.target.value, 10))}
      />
      <ul className="star-legend">
        {LEGEND.map(({ stars, label, color }) => (
          <li key={stars} style={{ opacity: stars >= value ? 1 : 0.4 }}>
            <span className="star-key" style={{ color }}>
              {'★'.repeat(stars) || '○'}
            </span>
            <span>{label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
