import React from 'react'

const REF_LAYERS = [
  { id: 'osm',    label: 'Parkings OSM',    color: '#00bcd4' },
  { id: 'bdtopo', label: 'Parkings BD Topo', color: '#ff9800' },
]

const GEORISQUES_WMS = 'https://mapsref.brgm.fr/wxs/georisques/risques'

const ALEA_LAYERS = [
  {
    id:     'ppri',
    label:  'Aléa inondation (PPRI)',
    color:  '#6c8eff',
    hint:   'Zonage réglementaire — Géorisques',
    legend: `${GEORISQUES_WMS}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetLegendGraphic&LAYER=PPRN_ZONE_INOND&FORMAT=image/png`,
  },
]

const FONCIER_LAYERS = [
  {
    id:    'cadastre',
    label: 'Cadastre',
    color: '#c084fc',
    hint:  'Parcellaire express — IGN Géoplateforme',
  },
]

const FINAL_LEGEND = [
  { color: '#ef4444', label: 'Aire exposée' },
  { color: '#16a34a', label: 'Aire refuge territoriale' },
  { color: '#4ade80', label: 'Aire refuge communale' },
  { color: '#86efac', label: 'Aire refuge locale' },
  { color: '#f97316', label: 'Aire refuge sous conditions' },
]

export default function RightToolbar({
  refLayers, onToggleLayer, refCounts,
  aleaLayers, onToggleAleaLayer,
  zonesOrigineCount, showZonesOrigine, onToggleZonesOrigine,
  accesCount, showAcces, onToggleAcces,
  ppriClassementCount, ppriModifiedCount, showPpriClassement, onTogglePpriClassement, onExportPpri,
  classementFinalCount, finalExcludesCount, showClassementFinal, onToggleClassementFinal, onExportFinal, onResetFinalExcludes,
  showClassementSimple, onToggleClassementSimple,
  showCarac, onToggleCarac, caracCount, onExportCarac,
  manualCount, isDrawingManual, onStartDraw, onExportManual,
}) {
  return (
    <div className="right-toolbar">

      {/* ── Référentiels ─────────────────────────────────────────────── */}
      <div className="right-toolbar-title">Référentiels</div>
      {REF_LAYERS.map(layer => {
        const active = !!refLayers[layer.id]
        const count  = refCounts?.[layer.id]
        return (
          <button
            key={layer.id}
            className={`ref-layer-btn${active ? ' active' : ''}`}
            style={{ '--layer-color': layer.color }}
            onClick={() => onToggleLayer(layer.id)}
          >
            <span className="ref-layer-dot" />
            <span className="ref-layer-label">{layer.label}</span>
            {active && count != null && (
              <span className="ref-layer-count">{count}</span>
            )}
          </button>
        )
      })}

      {/* ── Foncier ──────────────────────────────────────────────────── */}
      <div className="right-toolbar-title" style={{ marginTop: 8 }}>Foncier</div>
      {FONCIER_LAYERS.map(layer => {
        const active = !!aleaLayers?.[layer.id]
        return (
          <button
            key={layer.id}
            className={`ref-layer-btn${active ? ' active' : ''}`}
            style={{ '--layer-color': layer.color }}
            onClick={() => onToggleAleaLayer(layer.id)}
            title={layer.hint}
          >
            <span className="ref-layer-dot" style={{ borderRadius: 2 }} />
            <span className="ref-layer-label">{layer.label}</span>
          </button>
        )
      })}

      {/* ── Aléas ────────────────────────────────────────────────────── */}
      <div className="right-toolbar-title" style={{ marginTop: 8 }}>Aléas</div>
      {ALEA_LAYERS.map(layer => {
        const active = !!aleaLayers?.[layer.id]
        return (
          <React.Fragment key={layer.id}>
            <button
              className={`ref-layer-btn${active ? ' active' : ''}`}
              style={{ '--layer-color': layer.color }}
              onClick={() => onToggleAleaLayer(layer.id)}
              title={layer.hint}
            >
              <span className="ref-layer-dot" style={{ borderRadius: 2 }} />
              <span className="ref-layer-label">{layer.label}</span>
            </button>
            {active && layer.legend && (
              <div className="alea-legend">
                <img src={layer.legend} alt={`Légende ${layer.label}`} />
              </div>
            )}
          </React.Fragment>
        )
      })}

      {/* ── Workflow ─────────────────────────────────────────────────── */}
      <div className="right-toolbar-title" style={{ marginTop: 8 }}>Workflow</div>

      {/* 1 — Caractérisation */}
      <button
        className={`ref-layer-btn${showCarac ? ' active' : ''}`}
        style={{ '--layer-color': '#f59e0b' }}
        onClick={onToggleCarac}
      >
        <span className="ref-layer-dot" style={{ borderRadius: 2 }} />
        <span className="ref-layer-label">Caractérisation</span>
        {caracCount > 0 && <span className="ref-layer-count">{caracCount}</span>}
      </button>
      {showCarac && caracCount > 0 && (
        <div className="manual-toolbar-row">
          <span className="manual-toolbar-count" style={{ color: '#fcd34d' }}>
            bleu=public · rose=privé · violet=mixte
          </span>
          <button className="manual-export-btn" onClick={onExportCarac} title="Exporter parkings_caracterises.geojson">
            Exporter
          </button>
        </div>
      )}

      {/* 2 — Croisement PPRI */}
      <button
        className={`ref-layer-btn${showPpriClassement ? ' active' : ''}`}
        style={{ '--layer-color': '#a855f7' }}
        onClick={onTogglePpriClassement}
        title="Classement provisoire issu du croisement PPRI (step1_croisement_ppri.py)"
        disabled={!ppriClassementCount}
      >
        <span className="ref-layer-dot" style={{ borderRadius: 2 }} />
        <span className="ref-layer-label">Croisement PPRI</span>
        {ppriClassementCount > 0 && <span className="ref-layer-count">{ppriClassementCount}</span>}
      </button>
      {showPpriClassement && ppriClassementCount > 0 && (
        <div className="manual-toolbar-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
          <span className="manual-toolbar-count" style={{ color: '#e2e8f0', lineHeight: 1.5 }}>
            <span style={{ color: '#ef4444' }}>■</span> exposé &nbsp;
            <span style={{ color: '#f97316' }}>■</span> prescription &nbsp;
            <span style={{ color: '#22c55e' }}>■</span> refuge
          </span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {ppriModifiedCount > 0 && (
              <span style={{ fontSize: 10, color: '#f97316' }}>{ppriModifiedCount} modifié{ppriModifiedCount > 1 ? 's' : ''}</span>
            )}
            <button className="manual-export-btn" onClick={onExportPpri} title="Exporter classement_ppri.geojson avec modifications manuelles">
              Exporter
            </button>
          </div>
        </div>
      )}
      {!ppriClassementCount && (
        <div style={{ fontSize: 10, color: '#475569', padding: '2px 4px' }}>
          Lancez step1_croisement_ppri.py
        </div>
      )}

      {/* 3 — Zones d'origine */}
      <button
        className={`ref-layer-btn${showZonesOrigine ? ' active' : ''}`}
        style={{ '--layer-color': '#dc2626' }}
        onClick={onToggleZonesOrigine}
        title="Zones bâties en PPRI interdiction — demande estimée de véhicules à évacuer"
        disabled={!zonesOrigineCount}
      >
        <span className="ref-layer-dot" style={{ borderRadius: 2 }} />
        <span className="ref-layer-label">Zones d'origine</span>
        {zonesOrigineCount > 0 && <span className="ref-layer-count">{zonesOrigineCount}</span>}
      </button>
      {!zonesOrigineCount && (
        <div style={{ fontSize: 10, color: '#475569', padding: '2px 4px' }}>
          Lancez step2a_zones_origine.py
        </div>
      )}

      {/* 4 — Accessibilité */}
      <button
        className={`ref-layer-btn${showAcces ? ' active' : ''}`}
        style={{ '--layer-color': '#22c55e' }}
        onClick={onToggleAcces}
        title="Classement accessibilité (étape 2) — cliquez un parking pour voir ses trajets"
        disabled={!accesCount}
      >
        <span className="ref-layer-dot" style={{ borderRadius: 2 }} />
        <span className="ref-layer-label">Accessibilité</span>
        {accesCount > 0 && <span className="ref-layer-count">{accesCount}</span>}
      </button>
      {showAcces && accesCount > 0 && (
        <div className="manual-toolbar-row">
          <span className="manual-toolbar-count" style={{ color: '#e2e8f0', lineHeight: 1.6 }}>
            <span style={{ color: '#22c55e' }}>■</span> très acc. &nbsp;
            <span style={{ color: '#86efac' }}>■</span> acc. &nbsp;
            <span style={{ color: '#f97316' }}>■</span> moyen &nbsp;
            <span style={{ color: '#ef4444' }}>■</span> difficile
          </span>
        </div>
      )}
      {!accesCount && (
        <div style={{ fontSize: 10, color: '#475569', padding: '2px 4px' }}>
          Lancez step2b_routage.py
        </div>
      )}

      {/* 5 — Classement */}
      <button
        className={`ref-layer-btn${showClassementFinal ? ' active' : ''}`}
        style={{ '--layer-color': '#a855f7' }}
        onClick={onToggleClassementFinal}
        title="Classement final — 5 classes (step3)"
        disabled={!classementFinalCount}
      >
        <span className="ref-layer-dot" style={{ borderRadius: 2 }} />
        <span className="ref-layer-label">Classement</span>
        {classementFinalCount > 0 && <span className="ref-layer-count">{classementFinalCount}</span>}
      </button>
      {showClassementFinal && classementFinalCount > 0 && (
        <div className="manual-toolbar-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 3 }}>
          {FINAL_LEGEND.map(({ color, label }) => (
            <span key={label} style={{ color: '#e2e8f0', fontSize: 10 }}>
              <span style={{ color }}>■</span> {label}
            </span>
          ))}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
            {finalExcludesCount > 0 && (
              <button
                className="manual-export-btn"
                onClick={onResetFinalExcludes}
                title="Restaurer les parkings supprimés"
                style={{ color: '#f97316', borderColor: '#f9731666' }}
              >
                {finalExcludesCount} supprimé{finalExcludesCount > 1 ? 's' : ''} ↺
              </button>
            )}
            <button className="manual-export-btn" onClick={onExportFinal} title="Télécharger classement_final.geojson">
              Exporter
            </button>
          </div>
        </div>
      )}
      {!classementFinalCount && (
        <div style={{ fontSize: 10, color: '#475569', padding: '2px 4px' }}>
          Lancez step3_classement_final.py
        </div>
      )}

      {/* 6 — Vue décideur */}
      <button
        className={`ref-layer-btn${showClassementSimple ? ' active' : ''}`}
        style={{ '--layer-color': '#38bdf8' }}
        onClick={onToggleClassementSimple}
        title="Vue simplifiée pour décideurs — fiche capacité + surface"
        disabled={!classementFinalCount}
      >
        <span className="ref-layer-dot" style={{ borderRadius: 2 }} />
        <span className="ref-layer-label">Vue décideur</span>
      </button>

      {/* ── Saisie manuelle ──────────────────────────────────────────── */}
      <div className="right-toolbar-title" style={{ marginTop: 8 }}>Saisie manuelle</div>
      <button
        className={`manual-draw-btn${isDrawingManual ? ' active' : ''}`}
        onClick={onStartDraw}
        disabled={isDrawingManual}
      >
        {isDrawingManual ? '✏ Dessinez le polygone…' : '+ Ajouter un parking'}
      </button>
      {manualCount > 0 && (
        <div className="manual-toolbar-row">
          <span className="manual-toolbar-count">{manualCount} zone{manualCount > 1 ? 's' : ''}</span>
          <button className="manual-export-btn" onClick={onExportManual} title="Exporter → parkings_manuels.geojson">
            Exporter
          </button>
        </div>
      )}

    </div>
  )
}
