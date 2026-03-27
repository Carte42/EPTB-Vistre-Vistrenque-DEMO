import React from 'react'
import { cleanNom } from '../utils/geo.js'

const CLASSE_META = {
  tres_accessible:  { label: 'Très accessible',       color: '#22c55e' },
  accessible:       { label: 'Accessible',             color: '#86efac' },
  acces_moyen:      { label: 'Accès moyen',            color: '#f97316' },
  acces_difficile:  { label: 'Accès difficile',        color: '#ef4444' },
  non_connecte:     { label: 'Non connecté',           color: '#64748b' },
}

const SAT_META = {
  sous_sollicite:    { label: 'Sous-sollicité',    color: '#22c55e' },
  bien_dimensionne:  { label: 'Bien dimensionné',  color: '#86efac' },
  sur_sollicite:     { label: 'Sur-sollicité',     color: '#ef4444' },
}

export default function AccesPopup({ feature, onClose }) {
  const p    = feature?.properties || {}
  const meta = CLASSE_META[p.classe_acces] || CLASSE_META['non_connecte']
  const sat  = SAT_META[p.saturation]      || { label: '—', color: '#94a3b8' }

  return (
    <div className="carac-popup">
      <div className="carac-popup-header">
        <span className="carac-popup-title">{cleanNom(p.nom, p.id)}</span>
        <button className="carac-popup-close" onClick={onClose}>✕</button>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ background: meta.color, color: '#0f172a', borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
          {meta.label}
        </span>
        <span style={{ background: sat.color, color: '#0f172a', borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
          {sat.label}
        </span>
      </div>

      <div className="carac-field-row">
        <span className="carac-field-label">Capacité</span>
        <span className="carac-field-value">{p.capacite} véhicules</span>
      </div>
      <div className="carac-field-row">
        <span className="carac-field-label">Rayon captation</span>
        <span className="carac-field-value">{p.rayon_captation_m} m</span>
      </div>
      <div className="carac-field-row">
        <span className="carac-field-label">Îlots desservis</span>
        <span className="carac-field-value">{p.nb_origines} (≤ {p.temps_moyen_min} min en moy.)</span>
      </div>
      <div className="carac-field-row">
        <span className="carac-field-label">Demande estimée</span>
        <span className="carac-field-value">{p.demande_veh} véhicules ({p.ratio_capacite}× capacité)</span>
      </div>
      <div className="carac-field-row">
        <span className="carac-field-label">Voie d'accès dom.</span>
        <span className="carac-field-value">{p.voie_acces_dom || '—'}</span>
      </div>

      <div style={{ marginTop: 8, fontSize: 10, color: '#64748b' }}>
        Cliquer sur ce parking affiche ses trajets depuis les îlots d'origine.
      </div>
    </div>
  )
}
