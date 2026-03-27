import React, { useState, useEffect } from 'react'

export default function Onboarding() {
  const [step, setStep] = useState('welcome')  // 'welcome' | 1 | 2 | 3 | 'done'
  const [cardTop2, setCardTop2] = useState(230)
  const [cardTop3, setCardTop3] = useState(430)

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
    }
    computePositions()
    window.addEventListener('resize', computePositions)
    return () => window.removeEventListener('resize', computePositions)
  }, [step])

  function next() {
    if (step === 'welcome') setStep(1)
    else if (step === 1) setStep(2)
    else if (step === 2) setStep(3)
    else setStep('done')
  }

  if (step === 'done') return null

  return (
    <div className="ob-overlay">

      {/* ── Écran de bienvenue ── */}
      {step === 'welcome' && (
        <div className="ob-welcome-card">
          <div className="ob-glow" />
          <div className="ob-welcome-title">Bienvenue sur l'interface de démo</div>
          <div className="ob-welcome-subtitle">Cartographie des aires de refuge — Carte42</div>
          <div className="ob-welcome-text">
            Cette interface présente les résultats du pipeline d'analyse des parkings
            refuge en zone inondable, réalisé par Carte42 dans le cadre du marché.
            <br /><br />
            Elle intègre le croisement PPRI, la caractérisation foncière, le calcul
            d'accessibilité par routage et le classement final en cinq classes
            (aires exposées, aires refuge locales, communales, territoriales
            et aires mobilisables sous conditions).
            <br /><br />
            <span style={{ color: '#94a3b8', fontSize: 12 }}>
              Note : la barre d'outils de droite expose l'ensemble du workflow d'analyse.
              La version finale de l'interface ne conservera que la Vue décideur,
              le filtre et le téléchargement des données.
            </span>
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

      {/* ── Étape 2 : slider ── */}
      {step === 2 && (
        <div className="ob-card ob-card--left" style={{ top: cardTop2 }}>
          <div className="ob-glow" />
          <div className="ob-arrow--left-ext">◀</div>
          <div className="ob-body">
            <div className="ob-emoji">★</div>
            <div className="ob-title">Filtrez par classe de refuge</div>
            <div className="ob-text">
              Le slider permet de n'afficher que les classes qui vous intéressent —
              des aires exposées jusqu'aux refuges territoriaux de grande capacité.
              Activez la <strong>Vue décideur</strong> dans la barre de droite
              pour la carte épurée.
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
            <div className="ob-title">Téléchargez le classement</div>
            <div className="ob-text">
              Exportez le classement final complet au format GeoJSON
              (compatible QGIS, ArcGIS) avec l'ensemble des attributs —
              capacité, foncier, accessibilité et justification de classe.
            </div>
          </div>
          <button className="ob-ok" onClick={next}>C'est parti ✓</button>
          <div className="ob-arrow--left-ext-bottom">◀</div>
        </div>
      )}
    </div>
  )
}
