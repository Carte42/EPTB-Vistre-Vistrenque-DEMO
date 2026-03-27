import React from 'react'
import logo from '../assets/logo.png'
import ClassementSlider from './ClassementSlider.jsx'

export default function Sidebar({
  minClasse, onMinClasseChange,
  totalVisible, totalAll,
  onExport,
}) {
  return (
    <div className="sidebar">
      {/* Header */}
      <div className="header">
        <img src={logo} alt="Carte42" />
        <h1>
          Détection Parkings
          <span>Analyse automatique des emprises de stationnement</span>
        </h1>
      </div>

      {/* Classement slider */}
      <div data-ob-anchor="slider">
        <ClassementSlider value={minClasse} onChange={onMinClasseChange} />
      </div>

      {/* Compteur */}
      <div className="counter">
        <strong>{totalVisible}</strong> parking{totalVisible !== 1 ? 's' : ''} sur <strong>{totalAll}</strong>
      </div>

      <hr className="divider" />

      {/* Téléchargement */}
      <div className="export-row">
        <button
          className="export-btn"
          onClick={onExport}
          title="Télécharger le classement final complet au format GeoJSON"
          data-ob-anchor="export"
        >
          ⬇ Télécharger les données
        </button>
      </div>

      {/* À propos */}
      <div className="about-section">
        <details>
          <summary>À propos</summary>
          <div className="about-content">
            <p>Détection automatique des emprises de stationnement</p>
            <p>Analyse : orthophotographies IGN 2020 vs 2025</p>
            <p>Données : OSM, BD TOPO IGN, données administratives</p>
          </div>
        </details>
      </div>
    </div>
  )
}
