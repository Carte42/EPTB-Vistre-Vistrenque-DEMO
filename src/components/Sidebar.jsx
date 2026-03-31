import React, { useState } from 'react'
import logo from '../assets/logo.png'
import ClassementSlider from './ClassementSlider.jsx'
import ScenarioSelector from './ScenarioSelector.jsx'
import { DEMO_CLIENT } from '../config.js'

function scenarioStats(features, scenario) {
  const publics = features.filter(f => f.properties?.categorie_cctp === 'public')
  const key = `inondable_${scenario}`
  const refuges   = publics.filter(f => !f.properties?.[key]).length
  const inondables = publics.filter(f =>  f.properties?.[key]).length
  return { refuges, inondables, total: publics.length }
}

export default function Sidebar({
  minClasse, onMinClasseChange,
  totalVisible, totalAll,
  onExport,
  // démo
  scenario, onScenarioChange,
  classementFinal = [],
  showPrix2, onTogglePrix2,
}) {
  const stats = DEMO_CLIENT ? scenarioStats(classementFinal, scenario) : null
  const [rapportOpen, setRapportOpen] = useState(false)

  return (
    <div className="sidebar">
      {/* Header */}
      <div className="header">
        <img src={logo} alt="Carte42" />
        <h1>
          Consultation 2026-03
          <span>Analyse des aires de stationnement publiques au regard du risque inondation</span>
        </h1>
      </div>

      {DEMO_CLIENT ? (
        <>
          {/* Sélecteur de scénario */}
          <div style={{ padding: '12px 0 4px' }} data-ob-anchor="slider">
            <ScenarioSelector value={scenario} onChange={onScenarioChange} />
          </div>

          {/* Compteur scénario */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '4px 0', fontSize: 21, color: '#8899bb' }}>
            <div>
              <span style={{ color: '#22c55e', fontWeight: 700 }}>{stats.refuges}</span>
              {' '}aire{stats.refuges !== 1 ? 's' : ''} de refuge
              <span style={{ color: '#94a3b8', fontSize: 15 }}> — hors d'eau</span>
            </div>
            <div>
              <span style={{ color: '#ef4444', fontWeight: 700 }}>{stats.inondables}</span>
              {' '}aire{stats.inondables !== 1 ? 's' : ''} inondable{stats.inondables !== 1 ? 's' : ''}
              <span style={{ color: '#94a3b8', fontSize: 15 }}> — à évacuer</span>
            </div>
          </div>

          <hr className="divider" />

          {/* Export */}
          <div className="export-row">
            <button className="export-btn" onClick={onExport}
              title="Télécharger les données au format GeoJSON"
              data-ob-anchor="export">
              ⬇ Télécharger les données
            </button>
          </div>

          {/* Rapports par commune */}
          <div style={{ position: 'relative', marginTop: 8 }}>
            <button
              className="export-btn"
              onClick={() => setRapportOpen(o => !o)}
              title="Télécharger le rapport par commune"
              style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <span>⬇ Télécharger le rapport par commune</span>
              <span style={{ marginLeft: 8, fontSize: 11 }}>{rapportOpen ? '▴' : '▾'}</span>
            </button>
            {rapportOpen && (
              <ul style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                margin: 0,
                padding: '4px 0',
                listStyle: 'none',
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '0 0 6px 6px',
                zIndex: 200,
                boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              }}>
                {[
                  { label: 'Manduel',  file: './fiches/rapport_Manduel.pdf' },
                  { label: 'Redessan', file: './fiches/rapport_Redessan.pdf' },
                ].map(({ label, file }) => (
                  <li key={label}>
                    <a
                      href={file}
                      download
                      style={{
                        display: 'block',
                        padding: '8px 14px',
                        color: '#e2e8f0',
                        textDecoration: 'none',
                        fontSize: 13,
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#334155'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      onClick={() => setRapportOpen(false)}
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Mode travail — slider classement */}
          <div data-ob-anchor="slider">
            <ClassementSlider value={minClasse} onChange={onMinClasseChange} />
          </div>
          <div className="counter">
            <strong>{totalVisible}</strong> parking{totalVisible !== 1 ? 's' : ''} sur <strong>{totalAll}</strong>
          </div>
          <hr className="divider" />
          <div className="export-row">
            <button className="export-btn" onClick={onExport}
              title="Télécharger le classement final complet au format GeoJSON"
              data-ob-anchor="export">
              ⬇ Télécharger les données
            </button>
          </div>
        </>
      )}

      {/* À propos */}
      <div className="about-section">
        <details>
          <summary>À propos</summary>
          <div className="about-content">
            <p>Identification des aires de stationnement publiques de surface</p>
            <p>Croisement aléa inondation : PPRI, études hydrauliques EPTB, CARTINO-2D CEREMA</p>
            <p>Sources : OSM, BD TOPO IGN, orthophotos 2024</p>
            <p style={{
              marginTop: 10, padding: '8px 10px',
              background: 'rgba(251,146,60,0.08)',
              border: '1px solid rgba(251,146,60,0.3)',
              borderRadius: 5, fontSize: 11, lineHeight: 1.5,
              color: '#94a3b8', fontStyle: 'italic',
            }}>
              ⚠ Les résultats présentés sont établis à des fins de démonstration uniquement.
              Ils ne constituent pas des résultats finaux ni des recommandations opérationnelles
              à ce stade de la consultation.
            </p>
          </div>
        </details>
      </div>
    </div>
  )
}
