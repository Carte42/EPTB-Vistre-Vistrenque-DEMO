import React, { useState, useEffect, useCallback } from 'react'
import MapView from './components/MapView.jsx'
import Sidebar from './components/Sidebar.jsx'
import Onboarding from './components/Onboarding.jsx'
import RightToolbar from './components/RightToolbar.jsx'
import ManualParkingForm from './components/ManualParkingForm.jsx'
import { inDemoBbox, approxAreaM2, inferStatut, inferTypeParkking } from './utils/geo.js'
import { DEMO_CLIENT } from './config.js'
import { CLASSE_ORDER } from './components/ClassementSlider.jsx'

const LS_KEY         = 'carte42_parkings_overrides'
const LS_MANUAL_KEY  = 'carte42_parkings_manual'
const LS_CARAC_OV    = 'carte42_carac_overrides'
const LS_PPRI_OV     = 'carte42_ppri_overrides'

function loadOverrides() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') }
  catch { return {} }
}

function loadManualFromLS() {
  try { return JSON.parse(localStorage.getItem(LS_MANUAL_KEY) || '[]') }
  catch { return [] }
}

function loadCaracOv() {
  try { return JSON.parse(localStorage.getItem(LS_CARAC_OV) || '{}') }
  catch { return {} }
}

// ── Construction de la couche caractérisée depuis OSM + saisies manuelles ──
function buildCaracFeatures(osmFeatures, manualFeatures) {
  const out = []
  let idx = 1

  for (const f of osmFeatures) {
    const p = f.properties || {}
    if (p.parking === 'street_side') continue
    if (!inDemoBbox(f)) continue

    const surface = Math.round(approxAreaM2(f.geometry))
    const statut  = inferStatut(p)
    out.push({
      type: 'Feature',
      geometry: f.geometry,
      properties: {
        id:                   `PKC_${String(idx++).padStart(3, '0')}`,
        source:               'osm',
        id_osm:               p.osm_id,
        nom:                  p.name || '',
        commune:              p['addr:city'] || p['is_in:city'] || '',
        surface_m2:           surface,
        nb_vehicules_approx:  Math.max(1, Math.round(surface / 25)),
        nb_vehicules_corrige: null,
        type_parking:         inferTypeParkking(p),
        statut_foncier:       statut,
        _statut_auto:         statut,
        categorie:            '',
        notes:                '',
        ppri_zone:            '',
        date_maj:             new Date().toISOString().slice(0, 10),
      },
    })
  }

  for (const f of manualFeatures) {
    const p       = f.properties || {}
    const surface = Math.round(approxAreaM2(f.geometry))
    out.push({
      type: 'Feature',
      geometry: f.geometry,
      properties: {
        id:                   `PKC_M_${p.id || String(idx++)}`,
        source:               'saisie_manuelle',
        id_osm:               null,
        nom:                  '',
        commune:              '',
        surface_m2:           surface,
        nb_vehicules_approx:  Math.max(1, Math.round(surface / 25)),
        nb_vehicules_corrige: null,
        type_parking:         p.type_manuel || 'surface',
        statut_foncier:       'inconnu',
        _statut_auto:         'inconnu',
        categorie:            '',
        notes:                p.observation || '',
        ppri_zone:            '',
        date_maj:             p.date_saisie || new Date().toISOString().slice(0, 10),
      },
    })
  }

  return out
}

function saveOverrides(ov) {
  localStorage.setItem(LS_KEY, JSON.stringify(ov))
}

function saveManual(features) {
  localStorage.setItem(LS_MANUAL_KEY, JSON.stringify(features))
}

export default function App() {
  const [rawFeatures, setRawFeatures]       = useState([])
  const [loading, setLoading]               = useState(true)
  const [minClasse, setMinClasse]           = useState(0)
  const [selectedId, setSelectedId]         = useState(null)
  const [clickLatlng, setClickLatlng]       = useState(null)
  const [basemap, setBasemap]               = useState('osm')
  const [overrides, setOverrides]           = useState(loadOverrides)
  const [editingGeom, setEditingGeom]       = useState(null)
  const [geomVersion, setGeomVersion]       = useState(0)
  const [refLayers, setRefLayers]           = useState({ osm: false, bdtopo: false })
  const [refCounts, setRefCounts]           = useState({})
  const [aleaLayers, setAleaLayers]         = useState({ ppri: false, cadastre: false })
  const [zonesOrigine, setZonesOrigine]         = useState([])
  const [showZonesOrigine, setShowZonesOrigine] = useState(false)
  const [accesFeatures, setAccesFeatures]       = useState([])
  const [routesFeatures, setRoutesFeatures]     = useState([])
  const [showAcces, setShowAcces]               = useState(false)
  const [selectedAccesId, setSelectedAccesId]   = useState(null)
  const [ppriClassement, setPpriClassement] = useState([])
  const [showPpriClassement, setShowPpriClassement] = useState(false)
  const [classementFinal, setClassementFinal]   = useState([])
  const [showClassementFinal, setShowClassementFinal] = useState(false)
  const [selectedFinalId, setSelectedFinalId]   = useState(null)
  const [showClassementSimple, setShowClassementSimple] = useState(DEMO_CLIENT)
  const [scenario, setScenario]                         = useState('t100')
  const [showPrix2, setShowPrix2]                       = useState(false)
  const [finalExcludes, setFinalExcludes]       = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('carte42_final_excludes') || '[]')) } catch { return new Set() }
  })
  const [ppriOverrides, setPpriOverrides]   = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_PPRI_OV) || '{}') } catch { return {} }
  })

  // ── Saisie manuelle ──────────────────────────────────────────────────────
  const [manualFeatures, setManualFeatures] = useState(loadManualFromLS)
  const [isDrawingManual, setIsDrawingManual] = useState(false)
  const [pendingManualGeom, setPendingManualGeom] = useState(null)

  // Au démarrage : si un fichier statique existe, le fusionner (priorité fichier)
  useEffect(() => {
    fetch('./data/parkings_manuels.geojson')
      .then(r => r.ok ? r.json() : null)
      .then(gj => {
        if (gj?.features?.length) {
          setManualFeatures(gj.features)
          saveManual(gj.features)
        }
      })
      .catch(() => {})
  }, [])

  function handleManualDrawn(geometry) {
    setIsDrawingManual(false)
    setPendingManualGeom(geometry)
  }

  function handleManualSave(props) {
    const idx = manualFeatures.length + 1
    const id  = `MANUAL_${String(idx).padStart(3, '0')}`
    const feature = {
      type: 'Feature',
      geometry: pendingManualGeom,
      properties: { id, source: 'saisie_manuelle', date_saisie: new Date().toISOString().slice(0, 10), ...props },
    }
    const next = [...manualFeatures, feature]
    setManualFeatures(next)
    saveManual(next)
    setPendingManualGeom(null)
  }

  function handleManualDelete(id) {
    const next = manualFeatures.filter(f => f.properties.id !== id)
    setManualFeatures(next)
    saveManual(next)
  }

  function handleManualExport() {
    const gj   = { type: 'FeatureCollection', features: manualFeatures }
    const blob = new Blob([JSON.stringify(gj, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    Object.assign(document.createElement('a'), { href: url, download: 'parkings_manuels.geojson' }).click()
    URL.revokeObjectURL(url)
  }

  // ── Caractérisation ───────────────────────────────────────────────────────
  const [caracBase,      setCaracBase]      = useState([])
  const [caracOverrides, setCaracOverrides] = useState(loadCaracOv)
  const [caracVersion,   setCaracVersion]   = useState(0)
  const [showCarac,      setShowCarac]      = useState(false)

  useEffect(() => {
    // Priorité : fichier statique exporté → sinon construction depuis OSM
    fetch('./data/parkings_caracterises.geojson')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(gj => { if (gj?.features?.length) setCaracBase(gj.features) })
      .catch(() => {
        Promise.all([
          fetch('./data/ref/parkings_osm.geojson').then(r => r.json()),
          fetch('./data/parkings_manuels.geojson').then(r => r.ok ? r.json() : { features: [] }).catch(() => ({ features: [] })),
        ]).then(([osmGj, manGj]) => {
          setCaracBase(buildCaracFeatures(osmGj.features || [], manGj.features || []))
        }).catch(() => {})
      })
  }, [])

  const caracFeatures = caracBase.map(f => {
    const ov = caracOverrides[f.properties.id]
    if (!ov) return f
    return { ...f, properties: { ...f.properties, ...ov } }
  })

  function handleCaracEdit(id, patch) {
    const next = { ...caracOverrides, [id]: { ...(caracOverrides[id] || {}), ...patch } }
    setCaracOverrides(next)
    setCaracVersion(v => v + 1)
    localStorage.setItem(LS_CARAC_OV, JSON.stringify(next))
  }

  function handleCaracExport() {
    const gj   = { type: 'FeatureCollection', features: caracFeatures }
    const blob = new Blob([JSON.stringify(gj, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    Object.assign(document.createElement('a'), { href: url, download: 'parkings_caracterises.geojson' }).click()
    URL.revokeObjectURL(url)
  }

  // ── Zones d'origine ──────────────────────────────────────────────────────
  useEffect(() => {
    fetch('./data/zones_origine.geojson')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(gj => setZonesOrigine(gj.features || []))
      .catch(() => {})
  }, [])

  // ── Classement accessibilité ──────────────────────────────────────────────
  useEffect(() => {
    fetch('./data/classement_accessibilite.geojson')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(gj => setAccesFeatures(gj.features || []))
      .catch(() => {})
    fetch('./data/routes_acces.geojson')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(gj => setRoutesFeatures(gj.features || []))
      .catch(() => {})
  }, [])

  // ── Classement final ─────────────────────────────────────────────────────
  useEffect(() => {
    fetch('./data/classement_final.geojson')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(gj => setClassementFinal(gj.features || []))
      .catch(() => {})
  }, [])

  const classementFinalVisible = classementFinal.filter(f => {
    if (finalExcludes.has(f.properties?.id)) return false
    const idx = CLASSE_ORDER.indexOf(f.properties?.classe_finale)
    return idx >= minClasse
  })

  function handleFinalDelete(id) {
    const next = new Set(finalExcludes)
    next.add(id)
    setFinalExcludes(next)
    localStorage.setItem('carte42_final_excludes', JSON.stringify([...next]))
    if (selectedFinalId === id) setSelectedFinalId(null)
  }

  function handleFinalExport() {
    // Export complet : toutes les propriétés, filtré par slider + exclusions
    const gj   = { type: 'FeatureCollection', features: classementFinalVisible }
    const blob = new Blob([JSON.stringify(gj, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    Object.assign(document.createElement('a'), { href: url, download: 'classement_final.geojson' }).click()
    URL.revokeObjectURL(url)
  }

  // ── Classement PPRI ──────────────────────────────────────────────────────
  useEffect(() => {
    fetch('./data/classement_ppri.geojson')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(gj => setPpriClassement(gj.features || []))
      .catch(() => {})
  }, [])

  const ppriFeatures = ppriClassement.map(f => {
    const ov = ppriOverrides[f.properties?.id]
    if (!ov) return f
    return { ...f, properties: { ...f.properties, ...ov } }
  })
  const ppriModifiedCount = Object.keys(ppriOverrides).length

  function handlePpriReclassify(id, nouvelle_classe, justif_manuelle) {
    const next = {
      ...ppriOverrides,
      [id]: { classe_ppri: nouvelle_classe, justif_manuelle: justif_manuelle || '' }
    }
    setPpriOverrides(next)
    localStorage.setItem(LS_PPRI_OV, JSON.stringify(next))
  }

  function handlePpriExport() {
    const gj = { type: 'FeatureCollection', features: ppriFeatures }
    const blob = new Blob([JSON.stringify(gj, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    Object.assign(document.createElement('a'), { href: url, download: 'classement_ppri.geojson' }).click()
    URL.revokeObjectURL(url)
  }

  // ── Couches ──────────────────────────────────────────────────────────────
  const handleToggleRefLayer    = useCallback(id => setRefLayers(p => ({ ...p, [id]: !p[id] })), [])
  const handleRefCountsUpdate   = useCallback((id, n) => setRefCounts(p => ({ ...p, [id]: n })), [])
  const handleToggleAleaLayer   = useCallback(id => setAleaLayers(p => ({ ...p, [id]: !p[id] })), [])

  // ── Détections ───────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('./data/detections.geojson')
      .then(r => r.json())
      .then(gj => {
        const feats = (gj.features || []).map((f, i) => ({
          ...f,
          properties: { ...f.properties, _demo_id: String(f.properties?.id || i) },
        }))
        setRawFeatures(feats)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const features = rawFeatures.map(f => {
    const ov = overrides[f.properties._demo_id]
    if (!ov) return f
    const { _geometry, ...propOv } = ov
    return { ...f, geometry: _geometry || f.geometry, properties: { ...f.properties, ...propOv } }
  })

  const selectedFeature = selectedId != null
    ? features.find(f => f.properties._demo_id === selectedId) ?? null
    : null

  function handleEdit(demoId, patch) {
    const next = { ...overrides, [demoId]: { ...(overrides[demoId] || {}), ...patch } }
    setOverrides(next)
    saveOverrides(next)
  }

  function handleGeomEdited(demoId, newGeometry) {
    handleEdit(demoId, { _geometry: newGeometry })
    setEditingGeom(null)
    setGeomVersion(v => v + 1)
  }

  function handleExport() {
    const exported = {
      type: 'FeatureCollection',
      features: features.map(({ properties: { _demo_id, ...rest }, ...f }) => ({ ...f, properties: rest })),
    }
    const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    Object.assign(document.createElement('a'), { href: url, download: 'Detections_Parkings_Demo.geojson' }).click()
    URL.revokeObjectURL(url)
  }

  function handleClose() {
    setSelectedId(null)
    setEditingGeom(null)
    setClickLatlng(null)
  }

  return (
    <div className="app">
      <Onboarding />
      <Sidebar
        minClasse={minClasse}
        onMinClasseChange={setMinClasse}
        totalVisible={classementFinalVisible.length}
        totalAll={classementFinal.filter(f => !finalExcludes.has(f.properties?.id)).length}
        onExport={handleFinalExport}
        scenario={scenario}
        onScenarioChange={setScenario}
        classementFinal={classementFinal}
        showPrix2={showPrix2}
        onTogglePrix2={() => setShowPrix2(v => !v)}
      />
      <div className="map-container">
        <MapView
          features={features}
          selectedFeature={selectedFeature}
          clickLatlng={clickLatlng}
          onSelectFeature={(f, latlng) => { setSelectedId(f.properties._demo_id); setClickLatlng(latlng) }}
          basemap={basemap}
          onBasemapChange={setBasemap}
          editingGeom={editingGeom}
          geomVersion={geomVersion}
          onGeomEdited={handleGeomEdited}
          onCancelGeomEdit={() => setEditingGeom(null)}
          onCloseFeature={handleClose}
          onEditFeature={handleEdit}
          onEditGeomFeature={(demoId, mode) => demoId ? setEditingGeom({ id: demoId, mode }) : setEditingGeom(null)}
          refLayers={refLayers}
          onRefCountsUpdate={handleRefCountsUpdate}
          aleaLayers={aleaLayers}
          onToggleAleaLayer={handleToggleAleaLayer}
          zonesOrigine={zonesOrigine}
          showZonesOrigine={showZonesOrigine}
          accesFeatures={accesFeatures}
          routesFeatures={routesFeatures}
          showAcces={showAcces}
          selectedAccesId={selectedAccesId}
          onSelectAcces={id => setSelectedAccesId(prev => prev === id ? null : id)}
          ppriFeatures={ppriFeatures}
          showPpriClassement={showPpriClassement}
          onPpriReclassify={handlePpriReclassify}
          classementFinal={classementFinalVisible}
          showClassementFinal={showClassementFinal}
          showClassementSimple={showClassementSimple}
          scenario={scenario}
          showPrix2={showPrix2}
          onTogglePrix2={() => setShowPrix2(v => !v)}
          selectedFinalId={selectedFinalId}
          onSelectFinal={id => setSelectedFinalId(prev => prev === id ? null : id)}
          onFinalDelete={handleFinalDelete}
          caracFeatures={caracFeatures}
          caracVersion={caracVersion}
          showCarac={showCarac}
          onCaracEdit={handleCaracEdit}
          manualFeatures={manualFeatures}
          isDrawingManual={isDrawingManual}
          onManualDrawn={handleManualDrawn}
          onManualCancelDraw={() => setIsDrawingManual(false)}
          onManualDelete={handleManualDelete}
        />
        {!DEMO_CLIENT && <RightToolbar
          refLayers={refLayers}
          onToggleLayer={handleToggleRefLayer}
          refCounts={refCounts}
          aleaLayers={aleaLayers}
          onToggleAleaLayer={handleToggleAleaLayer}
          zonesOrigineCount={zonesOrigine.filter(f => f.properties?.statut_ppri === 'interdiction').length}
          showZonesOrigine={showZonesOrigine}
          onToggleZonesOrigine={() => setShowZonesOrigine(v => !v)}
          accesCount={accesFeatures.length}
          showAcces={showAcces}
          onToggleAcces={() => { setShowAcces(v => !v); setSelectedAccesId(null) }}
          ppriClassementCount={ppriFeatures.length}
          ppriModifiedCount={ppriModifiedCount}
          showPpriClassement={showPpriClassement}
          onTogglePpriClassement={() => setShowPpriClassement(v => !v)}
          onExportPpri={handlePpriExport}
          classementFinalCount={classementFinalVisible.length}
          finalExcludesCount={finalExcludes.size}
          showClassementFinal={showClassementFinal}
          onToggleClassementFinal={() => { setShowClassementFinal(v => !v); setSelectedFinalId(null) }}
          showClassementSimple={showClassementSimple}
          onToggleClassementSimple={() => setShowClassementSimple(v => !v)}
          onExportFinal={handleFinalExport}
          onResetFinalExcludes={() => { setFinalExcludes(new Set()); localStorage.removeItem('carte42_final_excludes') }}
          showCarac={showCarac}
          onToggleCarac={() => setShowCarac(v => !v)}
          caracCount={caracFeatures.length}
          onExportCarac={handleCaracExport}
          manualCount={manualFeatures.length}
          isDrawingManual={isDrawingManual}
          onStartDraw={() => setIsDrawingManual(true)}
          onExportManual={handleManualExport}
        />}
      </div>
      {pendingManualGeom && (
        <ManualParkingForm
          onSave={handleManualSave}
          onCancel={() => setPendingManualGeom(null)}
        />
      )}
    </div>
  )
}
