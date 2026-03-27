import React, { useState } from 'react'
import ReactDOM from 'react-dom'

export const TYPES_MANUELS = [
  { value: 'parking_non_carto',  label: 'Parking existant non cartographié' },
  { value: 'parcelle_privee',    label: 'Parcelle privée potentiellement utilisable' },
  { value: 'parcelle_publique',  label: 'Parcelle publique' },
  { value: 'aire_informelle',    label: 'Aire de stationnement informelle' },
  { value: 'terrain_vague',      label: 'Terrain vague / friche' },
  { value: 'autre',              label: 'Autre' },
]

export default function ManualParkingForm({ onSave, onCancel }) {
  const [type, setType] = useState('parking_non_carto')
  const [obs,  setObs]  = useState('')

  const needsObs = type === 'autre'
  const canSave  = !needsObs || obs.trim().length > 0

  return ReactDOM.createPortal(
    <div className="manual-overlay">
      <div className="manual-modal">
        <div className="manual-modal-header">
          <span className="manual-modal-title">Nouveau parking — saisie manuelle</span>
        </div>

        <div className="manual-modal-body">
          <label className="manual-label">Type de zone</label>
          <select
            className="manual-select"
            value={type}
            onChange={e => setType(e.target.value)}
          >
            {TYPES_MANUELS.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>

          <label className="manual-label">
            Observation{needsObs && <span className="manual-required"> *</span>}
          </label>
          <textarea
            className="manual-textarea"
            value={obs}
            onChange={e => setObs(e.target.value)}
            placeholder={needsObs
              ? 'Description requise pour le type "Autre"…'
              : 'Source, contexte, remarques…'}
            rows={3}
          />
        </div>

        <div className="manual-modal-footer">
          <button className="manual-btn manual-btn-cancel" onClick={onCancel}>
            Annuler
          </button>
          <button
            className="manual-btn manual-btn-save"
            onClick={() => onSave({ type_manuel: type, observation: obs.trim() })}
            disabled={!canSave}
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
