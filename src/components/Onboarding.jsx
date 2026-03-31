import React, { useState, useEffect } from 'react'

export default function Onboarding() {
  const [step, setStep] = useState('welcome')
  const [cardTop2, setCardTop2] = useState(230)
  const [cardTop3, setCardTop3] = useState(430)
  const [cardTop4, setCardTop4] = useState(400)

  useEffect(() => {
    function computePositions() {
      if (step === 2) {
        const el = document.querySelector('[data-ob-anchor="slider"]')
        if (el) {
          const rect = el.getBoundingClientRect()
          const ideal = Math.round(rect.top + rect.height / 2)
          setCardTop2(Math.max(80, Math.min(ideal, window.innerHeight - 230)))
        }
      }
      if (step === 3) {
        const el = document.querySelector('[data-ob-anchor="export"]')
        if (el) {
          const rect = el.getBoundingClientRect()
          const ideal = Math.round(rect.top + rect.height / 2 - 85)
          setCardTop3(Math.max(80, Math.min(ideal, window.innerHeight - 260)))
        }
      }
      if (step === 4) {
        const el = document.querySelector('[data-ob-anchor="legend"]')
        if (el) {
          const rect = el.getBoundingClientRect()
          const ideal = Math.round(rect.top - 60)
          setCardTop4(Math.max(80, Math.min(ideal, window.innerHeight - 260)))
        }
      }
    }
    computePositions()
    window.addEventListener('resize', computePositions)
    return () => window.removeEventListener('resize', computePositions)
  }, [step])

  function next() {
    if (step === 'welcome') setStep(1)
    else if (step === 1) setStep(2)
    else if (step === 2) setStep(3)
    else if (step === 3) setStep(4)
    else if (step === 4) setStep(5)
    else setStep('done')
  }

  if (step === 'done') return null

  return (
    <div className="ob-overlay">

      {/* ── Écran de bienvenue ── */}
      {step === 'welcome' && (
        <div className="ob-welcome-card">
          <div className="ob-glow" />
          <div className="ob-welcome-title">Bienvenue sur l'interface de démonstration</div>
          <div className="ob-welcome-subtitle">Cartographie des aires de refuge — Carte42</div>
          <div className="ob-welcome-text">
            Démonstration de la méthodologie Carte42 en réponse à la Consultation 2026-03
            de l'EPTB Vistre-Vistrenque — identification et classement des aires de stationnement
            refuge au regard du risque inondation.
          </div>
          <button className="ob-start" onClick={next}>Découvrir →</button>
        </div>
      )}

      {/* ── Étape 1 : fond de plan ── */}
      {step === 1 && (
        <div className="ob-card ob-card--bottom">
          <div className="ob-glow" />
          <div className="ob-body">
            <div className="ob-emoji">🗺</div>
            <div className="ob-title">Choisissez votre fond de plan</div>
            <div className="ob-text">
              Basculez entre le plan OSM, les orthophotos IGN 2024
              et la vue satellite Google pour contextualiser chaque parking
              dans son environnement urbain.
            </div>
          </div>
          <button className="ob-ok" onClick={next}>OK, compris →</button>
          <div className="ob-arrow--down">▼</div>
        </div>
      )}

      {/* ── Étape 2 : sélecteur de scénario ── */}
      {step === 2 && (
        <div className="ob-card ob-card--left" style={{ top: cardTop2 }}>
          <div className="ob-glow" />
          <div className="ob-arrow--left-ext">◀</div>
          <div className="ob-body">
            <div className="ob-emoji">🌦</div>
            <div className="ob-title">Sélectionnez un scénario</div>
            <div className="ob-text">
              Trois scénarios de crue : T20–40 (fréquente), T100 (référence PPRI)
              et T1000 (exceptionnel). Chaque scénario colore les aires en vert
              (refuge hors d'eau) ou rouge (aire inondable à évacuer).
            </div>
          </div>
          <button className="ob-ok" onClick={next}>OK, compris →</button>
        </div>
      )}

      {/* ── Étape 3 : export ── */}
      {step === 3 && (
        <div className="ob-card ob-card--left-low" style={{ top: cardTop3 }}>
          <div className="ob-glow" />
          <div className="ob-body">
            <div className="ob-emoji">📥</div>
            <div className="ob-title">Téléchargez les données</div>
            <div className="ob-text">
              Exportez le classement complet au format GeoJSON
              (compatible QGIS, ArcGIS) avec l'ensemble des attributs —
              capacité, foncier, accessibilité et justification.
            </div>
          </div>
          <button className="ob-ok" onClick={next}>OK, compris →</button>
          <div className="ob-arrow--left-ext-bottom">◀</div>
        </div>
      )}

      {/* ── Étape 4 : légende / prix 2 ── */}
      {step === 4 && (
        <div className="ob-card ob-card--right-low">
          <div className="ob-glow" />
          <div className="ob-body">
            <div className="ob-emoji">🅿</div>
            <div className="ob-title">Activez les aires mobilisables</div>
            <div className="ob-text">
              Le toggle <strong>Mobilisable (prix 2)</strong> dans la légende
              affiche les parkings privés et semi-publics activables sous conditions —
              colorés selon leur exposition au scénario actif.
            </div>
          </div>
          <button className="ob-ok" onClick={next}>OK, compris →</button>
          <div className="ob-arrow--right-ext">▶</div>
        </div>
      )}

      {/* ── Étape 5 : clic sur un parking ── */}
      {step === 5 && (
        <div className="ob-card ob-card--bottom">
          <div className="ob-glow" />
          <div className="ob-body">
            <div className="ob-emoji">📋</div>
            <div className="ob-title">Consultez la fiche de chaque parking</div>
            <div className="ob-text">
              Cliquez sur n'importe quel parking pour afficher ses caractéristiques
              détaillées — statut selon le scénario, capacité, accessibilité —
              et télécharger sa fiche action au format PDF.
            </div>
          </div>
          <button className="ob-ok" onClick={next}>C'est parti ✓</button>
        </div>
      )}
    </div>
  )
}
