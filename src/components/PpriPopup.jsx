import React, { useState } from 'react'
import { cleanNom } from '../utils/geo.js'

const CLASSE_LABELS = {
  'exposé':           { label: 'Aire exposée',        color: '#ef4444' },
  'a_analyser':       { label: 'À analyser finement', color: '#f97316' },
  'refuge_potentiel': { label: 'Refuge potentiel',    color: '#22c55e' },
}

export default function PpriPopup({ feature, onClose, onReclassify }) {
  const p = feature?.properties || {}
  const classe = p.classe_ppri || 'refuge_potentiel'
  const meta = CLASSE_LABELS[classe] || CLASSE_LABELS['refuge_potentiel']
  const [justif, setJustif] = useState(p.justif_manuelle || '')

  return (
    <div className="carac-popup">
      <div className="carac-popup-header">
        <span className="carac-popup-title">{cleanNom(p.nom, p.id)}</span>
        <button className="carac-popup-close" onClick={onClose}>✕</button>
      </div>

      <div style={{ marginBottom: 8 }}>
        <span style={{
          display: 'inline-block',
          background: meta.color,
          color: '#fff',
          borderRadius: 4,
          padding: '2px 8px',
          fontSize: 12,
          fontWeight: 600,
        }}>
          {meta.label}
        </span>
      </div>

      <div className="carac-field-row">
        <span className="carac-field-label">Zone PPRI brute</span>
        <span className="carac-field-value">{p.ppri_zone_brute || '—'}</span>
      </div>
      <div className="carac-field-row">
        <span className="carac-field-label">Justification auto</span>
        <span className="carac-field-value" style={{ fontStyle: 'italic', fontSize: 11 }}>
          {p.justif_ppri || '—'}
        </span>
      </div>
      <div className="carac-field-row">
        <span className="carac-field-label">Surface</span>
        <span className="carac-field-value">{p.surface_m2 ? `${p.surface_m2} m²` : '—'}</span>
      </div>
      <div className="carac-field-row">
        <span className="carac-field-label">Statut foncier</span>
        <span className="carac-field-value">{p.statut_foncier || '—'}</span>
      </div>
      <div className="carac-field-row">
        <span className="carac-field-label">Catégorie</span>
        <span className="carac-field-value">{p.categorie || '—'}</span>
      </div>

      {/* Justification manuelle — visible pour tous */}
      {onReclassify && (
        <div style={{ marginTop: 10, borderTop: '1px solid #334155', paddingTop: 8 }}>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
            {classe === 'a_analyser' ? 'Cas intermédiaire — analyse fine :' : 'Ajuster le classement :'}
          </div>
          <textarea
            value={justif}
            onChange={e => setJustif(e.target.value)}
            placeholder="Justification du classement…"
            rows={2}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: '#1e293b', color: '#e2e8f0',
              border: '1px solid #334155', borderRadius: 4,
              padding: '4px 6px', fontSize: 11, resize: 'vertical',
              marginBottom: 6,
            }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className="carac-save-btn"
              style={{ background: '#ef4444', flex: 1 }}
              onClick={() => onReclassify('exposé', justif)}
            >
              → Exposé
            </button>
            <button
              className="carac-save-btn"
              style={{ background: '#22c55e', flex: 1 }}
              onClick={() => onReclassify('refuge_potentiel', justif)}
            >
              → Refuge
            </button>
            {justif && classe !== 'a_analyser' && (
              <button
                className="carac-save-btn"
                style={{ background: '#475569', flex: 1 }}
                onClick={() => onReclassify(classe, justif)}
              >
                Sauver note
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
