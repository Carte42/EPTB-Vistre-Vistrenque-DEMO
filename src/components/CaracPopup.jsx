import React, { useState } from 'react'

export const CATEGORIES = [
  { value: '',              label: '— Non qualifié —' },
  { value: 'commercial',   label: 'Commerce / Grande surface' },
  { value: 'retail_park',  label: 'Retail park / Zone commerciale' },
  { value: 'residentiel',  label: 'Résidentiel / Copropriété' },
  { value: 'logistique',   label: 'Logistique / Industrie' },
  { value: 'equip_public', label: 'Équipement public' },
  { value: 'scolaire',     label: 'Scolaire / Sportif' },
  { value: 'transport',    label: 'Transport (gare, P+R…)' },
  { value: 'loisirs',      label: 'Loisirs / Tourisme' },
  { value: 'autre',        label: 'Autre' },
]

const STATUTS = [
  { value: 'public',   label: 'Public' },
  { value: 'prive',    label: 'Privé' },
  { value: 'mixte',    label: 'Mixte' },
  { value: 'inconnu',  label: 'Inconnu' },
]

const TYPE_LABELS = {
  surface:    'Surface',
  souterrain: 'Souterrain',
  silo:       'Silo / ouvrage',
  toiture:    'Toiture',
  auvent:     'Auvent / carports',
}

export default function CaracPopup({ feature, onSave, onClose }) {
  const p = feature?.properties || {}

  const [nom,               setNom]               = useState(p.nom              ?? '')
  const [categorie,         setCategorie]         = useState(p.categorie        ?? '')
  const [statut,            setStatut]            = useState(p.statut_foncier   ?? 'inconnu')
  const [nbCorrige,         setNbCorrige]         = useState(p.nb_vehicules_corrige ?? '')
  const [notes,             setNotes]             = useState(p.notes            ?? '')

  function handleSave() {
    onSave({
      nom,
      categorie,
      statut_foncier:       statut,
      nb_vehicules_corrige: nbCorrige !== '' ? Number(nbCorrige) : null,
      notes,
    })
  }

  const srcLabel = p.source === 'osm' ? 'OSM' : 'Saisie manuelle'
  const srcColor = p.source === 'osm' ? '#00bcd4' : '#34d399'

  return (
    <div className="carac-popup">
      {/* Header */}
      <div className="carac-popup-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="carac-popup-badge" style={{ background: `${srcColor}22`, color: srcColor }}>
            {srcLabel}
          </span>
          <span className="carac-popup-id">{p.id}</span>
        </div>
        <button className="ref-popup-close" onClick={onClose}>✕</button>
      </div>

      <div className="carac-popup-body">
        {/* Auto — lecture seule */}
        <div className="carac-section-title">Données automatiques</div>
        <div className="carac-auto-grid">
          <div className="carac-auto-item">
            <span className="carac-auto-label">Surface</span>
            <span className="carac-auto-val">{p.surface_m2?.toLocaleString('fr-FR')} m²</span>
          </div>
          <div className="carac-auto-item">
            <span className="carac-auto-label">Véhicules (est.)</span>
            <span className="carac-auto-val">{p.nb_vehicules_approx}</span>
          </div>
          <div className="carac-auto-item">
            <span className="carac-auto-label">Type</span>
            <span className="carac-auto-val">{TYPE_LABELS[p.type_parking] ?? p.type_parking ?? '—'}</span>
          </div>
          <div className="carac-auto-item">
            <span className="carac-auto-label">Commune</span>
            <span className="carac-auto-val">{p.commune || '—'}</span>
          </div>
        </div>

        {/* Éditable */}
        <div className="carac-section-title" style={{ marginTop: 10 }}>Qualification</div>

        <label className="carac-label">Nom / Désignation</label>
        <input
          className="carac-input"
          value={nom}
          onChange={e => setNom(e.target.value)}
          placeholder="ex. Parking Leclerc Nord…"
        />

        <label className="carac-label">Catégorie</label>
        <select className="carac-select" value={categorie} onChange={e => setCategorie(e.target.value)}>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>

        <label className="carac-label">
          Statut foncier
          {p._statut_auto && p._statut_auto !== statut &&
            <span className="carac-hint"> (auto : {p._statut_auto})</span>}
        </label>
        <select className="carac-select" value={statut} onChange={e => setStatut(e.target.value)}>
          {STATUTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>

        <label className="carac-label">Capacité corrigée (véhicules)</label>
        <input
          className="carac-input carac-input-nb"
          type="number"
          min={0}
          value={nbCorrige}
          onChange={e => setNbCorrige(e.target.value)}
          placeholder={p.nb_vehicules_approx}
        />

        <label className="carac-label">Notes</label>
        <textarea
          className="carac-textarea"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Accès, contexte, observations…"
          rows={3}
        />
      </div>

      <div className="carac-popup-footer">
        <button className="manual-btn manual-btn-cancel" onClick={onClose}>Fermer</button>
        <button className="manual-btn manual-btn-save" onClick={handleSave}>Enregistrer</button>
      </div>
    </div>
  )
}
