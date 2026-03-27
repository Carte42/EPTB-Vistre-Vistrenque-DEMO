import React from 'react'
import { cleanNom } from '../utils/geo.js'

const CLASSE_META = {
  aire_exposee: {
    label: 'Aire exposée',
    color: '#ef4444',
    bg: '#450a0a',
    icon: '⚠',
    desc: "Parking en zone PPRI d'interdiction — non mobilisable comme refuge.",
  },
  refuge_territorial: {
    label: 'Aire refuge territoriale',
    color: '#16a34a',
    bg: '#052e16',
    icon: '★★★',
    desc: "Capacité > 100 véhicules — mobilisable à l'échelle de plusieurs communes.",
  },
  refuge_communal: {
    label: 'Aire refuge communale',
    color: '#4ade80',
    bg: '#052e16',
    icon: '★★',
    desc: "Capacité 30–100 véhicules — mobilisable à l'échelle d'une commune.",
  },
  refuge_local: {
    label: 'Aire refuge locale',
    color: '#86efac',
    bg: '#052e16',
    icon: '★',
    desc: "Capacité < 30 véhicules — mobilisable à l'échelle d'un quartier.",
  },
  mobilisable_sous_conditions: {
    label: 'Aire refuge sous conditions',
    color: '#f97316',
    bg: '#431407',
    icon: '⚑',
    desc: 'Mobilisation soumise à accord préalable (foncier, usage, statut).',
  },
}

export default function FicheParkingSimple({ feature, onClose }) {
  const p    = feature?.properties || {}
  const meta = CLASSE_META[p.classe_finale] || CLASSE_META['mobilisable_sous_conditions']

  return (
    <div className="carac-popup" style={{ minWidth: 240, maxWidth: 300 }}>
      {/* Header */}
      <div className="carac-popup-header" style={{ alignItems: 'flex-start' }}>
        <div>
          <div className="carac-popup-title" style={{ lineHeight: 1.3 }}>
            {cleanNom(p.nom, p.id)}
          </div>
          <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{p.commune || '—'}</div>
        </div>
        <button className="carac-popup-close" onClick={onClose} style={{ flexShrink: 0, marginLeft: 8 }}>✕</button>
      </div>

      <div style={{ padding: '10px 14px 12px' }}>
        {/* Bandeau classe */}
        <div style={{
          background: meta.bg,
          border: `1px solid ${meta.color}44`,
          borderRadius: 6,
          padding: '8px 12px',
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{meta.icon}</span>
          <div>
            <div style={{ color: meta.color, fontWeight: 700, fontSize: 13 }}>{meta.label}</div>
            <div style={{ color: '#94a3b8', fontSize: 10, marginTop: 2, lineHeight: 1.4 }}>{meta.desc}</div>
          </div>
        </div>

        {/* Capacité */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid #1e293b' }}>
          <span style={{ fontSize: 16 }}>🚗</span>
          <span style={{ color: '#94a3b8', fontSize: 11, flex: 1 }}>Capacité</span>
          <span style={{ color: '#f1f5f9', fontSize: 13, fontWeight: 700 }}>
            {p.capacite_retenue ?? '—'} véhicules
          </span>
        </div>

        {/* Surface */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0' }}>
          <span style={{ fontSize: 16 }}>📐</span>
          <span style={{ color: '#94a3b8', fontSize: 11, flex: 1 }}>Surface</span>
          <span style={{ color: '#f1f5f9', fontSize: 13, fontWeight: 700 }}>
            {p.surface_m2 ? p.surface_m2.toLocaleString('fr-FR') + ' m²' : '—'}
          </span>
        </div>
      </div>
    </div>
  )
}
