import React, { useRef, useEffect, useState, useCallback } from 'react'
import ReactDOM from 'react-dom'
import {
  MapContainer,
  TileLayer,
  WMSTileLayer,
  GeoJSON,
  Rectangle,
  Circle,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-polylinedecorator'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'
import '@geoman-io/leaflet-geoman-free'
import buffer from '@turf/buffer'
import { lineString } from '@turf/helpers'
import FeatureDetail from './FeatureDetail.jsx'
import CaracPopup from './CaracPopup.jsx'
import PpriPopup from './PpriPopup.jsx'
import AccesPopup from './AccesPopup.jsx'
import FicheParking from './FicheParking.jsx'
import FicheParkingSimple from './FicheParkingSimple.jsx'
import { TYPES_MANUELS } from './ManualParkingForm.jsx'
import {
  GOOGLE_SAT_URL, IGN_WMTS_URL, IGN_LAYER_2024, IGN_LAYER_IRC_2024,
  MAP_CENTER, MAP_ZOOM, DEMO_BBOX,
} from '../config.js'

// Fix default icon paths broken by Vite bundling
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
  iconUrl:       new URL('leaflet/dist/images/marker-icon.png',   import.meta.url).href,
  shadowUrl:     new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
})

const OSM_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'

const STAR_STYLES = {
  5: { fillColor: '#e74c3c', color: '#c0392b', weight: 2, fillOpacity: 0.7 },
  4: { fillColor: '#e67e22', color: '#d35400', weight: 2, fillOpacity: 0.65 },
  3: { fillColor: '#f1c40f', color: '#f39c12', weight: 2, fillOpacity: 0.6 },
  2: { fillColor: '#3498db', color: '#2980b9', weight: 1.5, fillOpacity: 0.5 },
  1: { fillColor: '#9b59b6', color: '#8e44ad', weight: 1,   fillOpacity: 0.4 },
  0: { fillColor: '#95a5a6', color: '#7f8c8d', weight: 1,   fillOpacity: 0.3, dashArray: '4' },
}

function featureStyle(feature) {
  const stars = feature?.properties?.ia_etoiles ?? 0
  return STAR_STYLES[stars] || STAR_STYLES[0]
}

// ── Geoman draw controller ─────────────────────────────────────────────────
function GeomEditorControl({ editingGeom, onGeomEdited, onCancel }) {
  const map = useMap()

  useEffect(() => {
    map.pm.disableDraw()
    map.off('pm:create')

    if (!editingGeom) return

    const { id, mode } = editingGeom

    if (mode === 'polygon') {
      map.pm.enableDraw('Polygon', {
        snappable: true, snapDistance: 15,
        allowSelfIntersection: false, continueDrawing: false,
      })
    } else if (mode === 'line15m') {
      map.pm.enableDraw('Line', {
        snappable: true, snapDistance: 15, continueDrawing: false,
      })
    }

    function handleCreate(e) {
      const layer = e.layer
      let geometry = null
      if (mode === 'line15m') {
        const coords = layer.getLatLngs().map(ll => [ll.lng, ll.lat])
        if (coords.length >= 2) {
          try { geometry = buffer(lineString(coords), 15, { units: 'meters' }).geometry } catch {}
        }
      } else if (mode === 'polygon') {
        try { geometry = buffer(layer.toGeoJSON(), 15, { units: 'meters' }).geometry } catch {}
      }
      if (!geometry) geometry = layer.toGeoJSON().geometry
      map.removeLayer(layer)
      map.pm.disableDraw()
      map.off('pm:create')
      onGeomEdited(id, geometry)
    }

    map.on('pm:create', handleCreate)
    return () => { map.pm.disableDraw(); map.off('pm:create') }
  }, [editingGeom])

  return null
}

// ── Floating panel — anchored to a geographic latlng ──────────────────────
function FloatingPanel({ latlng, wrapperRef, children }) {
  const map = useMap()
  const [pos, setPos] = useState(null)

  const update = useCallback(() => {
    if (!latlng || !wrapperRef.current) return
    const pt = map.latLngToContainerPoint(latlng)
    const W = wrapperRef.current.clientWidth
    const H = wrapperRef.current.clientHeight
    const PANEL_W = 308, PANEL_H = 420
    setPos({
      left: Math.min(pt.x + 16, W - PANEL_W - 8),
      top:  Math.min(Math.max(pt.y - 20, 8), H - PANEL_H - 8),
    })
  }, [map, latlng, wrapperRef])

  useMapEvents({ move: update, zoom: update, moveend: update, zoomend: update })
  useEffect(() => { update() }, [update])

  if (!pos || !latlng || !wrapperRef.current) return null

  return ReactDOM.createPortal(
    <div className="map-feature-panel" style={{ top: pos.top, left: pos.left, right: 'auto' }}>
      {children}
    </div>,
    wrapperRef.current
  )
}

const EMPRISE_STYLE = {
  color: '#7eb3ff', weight: 3, fill: false, dashArray: '8 5', opacity: 0.85,
}

// ── Bbox filter helpers (from utils) ──────────────────────────────────────
import { inDemoBbox } from '../utils/geo.js'

// Masque inversé : couvre le monde avec un trou = DEMO_BBOX
const [bS, bW, bN, bE] = DEMO_BBOX
const BBOX_MASK = {
  type: 'Feature',
  geometry: {
    type: 'Polygon',
    coordinates: [
      [[-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]],
      [[bW, bS], [bW, bN], [bE, bN], [bE, bS], [bW, bS]],
    ],
  },
  properties: {},
}

// ── Ref layer styles ───────────────────────────────────────────────────────
const REF_STYLE = {
  osm: feature => {
    if (feature?.properties?.parking === 'street_side')
      return { color: '#6b7280', weight: 1, fillColor: '#6b7280', fillOpacity: 0.08, dashArray: '3 3' }
    return { color: '#00bcd4', weight: 1.5, fillColor: '#00bcd4', fillOpacity: 0.12 }
  },
  bdtopo: { color: '#ff9800', weight: 1.5, fillColor: '#ff9800', fillOpacity: 0.12 },
}

// ── Ref feature popup content ──────────────────────────────────────────────
function RefPopupContent({ feature, onClose }) {
  const props = feature?.properties || {}
  const SKIP = new Set(['source', 'wfs_layer'])
  const entries = Object.entries(props).filter(([k, v]) => !SKIP.has(k) && v != null && v !== '')
  return (
    <div className="ref-popup">
      <div className="ref-popup-header">
        <span className="ref-popup-badge" style={{
          background: props.source === 'bdtopo' ? 'rgba(255,152,0,.25)' : 'rgba(0,188,212,.25)',
          color:      props.source === 'bdtopo' ? '#ff9800' : '#00bcd4',
        }}>
          {props.source === 'bdtopo' ? 'BD Topo' : 'OSM'}
        </span>
        <button className="ref-popup-close" onClick={onClose}>✕</button>
      </div>
      <div className="ref-popup-body">
        <table className="ref-popup-table">
          <tbody>
            {entries.map(([k, v]) => (
              <tr key={k}>
                <td className="ref-popup-key">{k}</td>
                <td className="ref-popup-val">{String(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {entries.length === 0 && <p className="ref-popup-empty">Pas d'attributs</p>}
      </div>
    </div>
  )
}

// ── Manual draw controller ─────────────────────────────────────────────────
function ManualDrawController({ active, onDrawn, onCancel }) {
  const map = useMap()
  useEffect(() => {
    if (!active) { map.pm.disableDraw(); map.off('pm:create'); return }
    map.pm.enableDraw('Polygon', { snappable: true, snapDistance: 15, continueDrawing: false })
    function handleCreate(e) {
      const geometry = e.layer.toGeoJSON().geometry
      map.removeLayer(e.layer)
      map.pm.disableDraw()
      map.off('pm:create')
      onDrawn(geometry)
    }
    map.on('pm:create', handleCreate)
    return () => { map.pm.disableDraw(); map.off('pm:create') }
  }, [active])
  return null
}

// ── Main component ─────────────────────────────────────────────────────────
const GEORISQUES_WMS    = 'https://mapsref.brgm.fr/wxs/georisques/risques'
const MANUAL_STYLE      = { color: '#34d399', weight: 2, fillColor: '#34d399', fillOpacity: 0.18 }
const MANUAL_STYLE_EDIT = { color: '#fff', weight: 2, fillColor: '#34d399', fillOpacity: 0.1, dashArray: '5 4' }

function ManualPopupContent({ feature, onClose, onDelete }) {
  const p = feature?.properties || {}
  const typeLabel = TYPES_MANUELS.find(t => t.value === p.type_manuel)?.label ?? p.type_manuel
  return (
    <div className="ref-popup">
      <div className="ref-popup-header">
        <span className="ref-popup-badge" style={{ background: 'rgba(52,211,153,.2)', color: '#34d399' }}>
          Saisie manuelle
        </span>
        <button className="ref-popup-close" onClick={onClose}>✕</button>
      </div>
      <div className="ref-popup-body">
        <table className="ref-popup-table">
          <tbody>
            <tr><td className="ref-popup-key">ID</td><td className="ref-popup-val">{p.id}</td></tr>
            <tr><td className="ref-popup-key">Type</td><td className="ref-popup-val">{typeLabel}</td></tr>
            {p.observation && <tr><td className="ref-popup-key">Observation</td><td className="ref-popup-val">{p.observation}</td></tr>}
            <tr><td className="ref-popup-key">Date</td><td className="ref-popup-val">{p.date_saisie}</td></tr>
          </tbody>
        </table>
        <button className="manual-delete-btn" onClick={() => { onDelete(p.id); onClose() }}>
          Supprimer cette zone
        </button>
      </div>
    </div>
  )
}

function routeColor(temps_min) {
  if (temps_min <= 3) return '#22c55e'
  if (temps_min <= 5) return '#f97316'
  return '#ef4444'
}

// Couche routes avec flèches — impératif car leaflet-polylinedecorator n'est pas react-leaflet
function ArrowRoutes({ features, selectedId }) {
  const map = useMap()

  useEffect(() => {
    if (!features?.length || !selectedId) return
    const routes = features.filter(f => f.properties?.parking_id === selectedId)
    const layers = []

    routes.forEach(f => {
      const color = routeColor(f.properties?.temps_min || 0)
      // Inverser les coordonnées : le script route parking→origine, on veut origine→parking
      const coords = [...f.geometry.coordinates]
        .reverse()
        .map(([lon, lat]) => [lat, lon])

      if (coords.length < 2) return

      const line = L.polyline(coords, { color, weight: 3, opacity: 0.85 })
      const deco = L.polylineDecorator(line, {
        patterns: [{
          offset: '30%', repeat: '40%',
          symbol: L.Symbol.arrowHead({
            pixelSize: 10,
            polygon: false,
            pathOptions: { color, stroke: true, weight: 2.5, opacity: 0.9 },
          }),
        }],
      })

      line.addTo(map)
      deco.addTo(map)
      layers.push(line, deco)
    })

    return () => layers.forEach(l => map.removeLayer(l))
  }, [features, selectedId, map])

  return null
}

const PPRI_COLORS = {
  'exposé':           { color: '#ef4444', fillColor: '#ef4444' },
  'a_analyser':       { color: '#f97316', fillColor: '#f97316' },
  'refuge_potentiel': { color: '#22c55e', fillColor: '#22c55e' },
}

const FINAL_COLORS = {
  aire_exposee:               '#ef4444',
  refuge_territorial:         '#16a34a',
  refuge_communal:            '#4ade80',
  refuge_local:               '#86efac',
  mobilisable_sous_conditions:'#f97316',
}

export default function MapView({
  features, selectedFeature, clickLatlng, onSelectFeature,
  basemap, onBasemapChange, editingGeom, geomVersion, onGeomEdited, onCancelGeomEdit,
  onCloseFeature, onEditFeature, onEditGeomFeature,
  refLayers, onRefCountsUpdate, aleaLayers,
  zonesOrigine, showZonesOrigine,
  accesFeatures, routesFeatures, showAcces, selectedAccesId, onSelectAcces,
  ppriFeatures, showPpriClassement, onPpriReclassify,
  classementFinal, showClassementFinal, selectedFinalId, onSelectFinal, onFinalDelete,
  showClassementSimple,
  caracFeatures, caracVersion, showCarac, onCaracEdit,
  manualFeatures, isDrawingManual, onManualDrawn, onManualCancelDraw, onManualDelete,
}) {
  const wrapperRef = useRef(null)
  const [emprise, setEmprise] = useState(null)
  useEffect(() => {
    fetch('./data/emprise_zone.geojson').then(r => r.json()).then(setEmprise).catch(() => {})
  }, [])

  // Ref layers data
  const [refData, setRefData]         = useState({})
  const [refPopup, setRefPopup]       = useState(null)
  const [manualPopup, setManualPopup] = useState(null)
  const [caracPopup, setCaracPopup]   = useState(null)
  const [ppriPopup, setPpriPopup]       = useState(null)
  const [accesPopup, setAccesPopup]     = useState(null)
  const [finalPopup, setFinalPopup]     = useState(null)
  const [simplePopup, setSimplePopup]   = useState(null)

  useEffect(() => {
    const sources = { osm: './data/ref/parkings_osm.geojson', bdtopo: './data/ref/parkings_bdtopo.geojson' }
    Object.entries(sources).forEach(([id, url]) => {
      if (refLayers?.[id] && !refData[id]) {
        fetch(url)
          .then(r => r.json())
          .then(gj => {
            setRefData(prev => ({ ...prev, [id]: gj }))
            onRefCountsUpdate?.(id, gj.features?.length ?? 0)
          })
          .catch(() => {})
      }
    })
  }, [refLayers])

  const editingGeomId = editingGeom?.id ?? null
  const bboxFeatures  = features.filter(inDemoBbox)
  const pointFeatures = bboxFeatures.filter(f => f.geometry?.type === 'Point')
  const polyFeatures  = bboxFeatures.filter(f => f.geometry?.type !== 'Point')
  const polyGeoJSON   = { type: 'FeatureCollection', features: polyFeatures }
  const geoJsonKey    = bboxFeatures.map(f => f.properties?._demo_id || '').join(',') + '-v' + geomVersion

  function featureStyleWithEdit(feature) {
    const base = featureStyle(feature)
    if (feature.properties?._demo_id !== editingGeomId) return base
    return { ...base, dashArray: '6 4', weight: 3, fillOpacity: 0.25, color: '#fff' }
  }

  function handleEachFeature(feature, layer) {
    layer.on('click', e => onSelectFeature(feature, e.latlng))
  }

  const BASEMAPS = [
    { id: 'osm',        label: 'Plan OSM',  icon: '🗺' },
    { id: 'ortho2024',  label: 'Ortho 24',  icon: '📷' },
    { id: 'irc2024',    label: 'IRC 24',    icon: '🌿' },
    { id: 'google2025', label: 'Google 25', icon: '🛰' },
  ]

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%', height: '100%' }}>

      <div className="basemap-switcher">
        {BASEMAPS.map(bm => (
          <button
            key={bm.id}
            className={`basemap-switch-btn${basemap === bm.id ? ' active' : ''}`}
            onClick={() => onBasemapChange(bm.id)}
          >
            <span className="basemap-switch-icon">{bm.icon}</span>
            <span>{bm.label}</span>
          </button>
        ))}
      </div>

      {editingGeomId && (
        <div className="geom-edit-banner">
          ✏ Mode dessin actif — utilisez les boutons dans le panneau latéral
          <button onClick={onCancelGeomEdit}>Annuler</button>
        </div>
      )}

      <MapContainer
        center={MAP_CENTER}
        zoom={MAP_ZOOM}
        style={{ width: '100%', height: '100%' }}
        preferCanvas={false}
      >
        {basemap === 'osm' && (
          <TileLayer key="osm" url={OSM_URL} maxZoom={19}
            attribution="© OpenStreetMap contributors" className="osm-faded" />
        )}
        {basemap === 'irc2024' && (
          <TileLayer key="irc2024" url={IGN_WMTS_URL(IGN_LAYER_IRC_2024)} maxZoom={20}
            attribution="IGN BD ORTHO IRC 2024" />
        )}
        {basemap === 'google2025' && (
          <TileLayer key="google" url={GOOGLE_SAT_URL} maxZoom={20}
            attribution="Google Satellite" />
        )}
        {basemap === 'ortho2024' && (
          <TileLayer key="ign2024" url={IGN_WMTS_URL(IGN_LAYER_2024)} maxZoom={20}
            attribution="IGN BD ORTHO 2024" />
        )}

        {/* Couche aléa PPRI (WMS transparent) */}
        {aleaLayers?.ppri && (
          <WMSTileLayer
            key="ppri"
            url={GEORISQUES_WMS}
            layers="PPRN_ZONE_INOND"
            version="1.3.0"
            format="image/png"
            transparent={true}
            opacity={0.65}
            attribution="Géorisques — PPRI Inondation"
          />
        )}

        {/* Cadastre (WMS IGN) */}
        {aleaLayers?.cadastre && (
          <WMSTileLayer
            key="cadastre"
            url="https://data.geopf.fr/wms-r/wms"
            layers="CADASTRALPARCELS.PARCELLAIRE_EXPRESS"
            version="1.3.0"
            format="image/png"
            transparent={true}
            opacity={0.7}
            attribution="IGN — Cadastre Parcellaire Express"
          />
        )}

        {/* Masque : assombrit l'extérieur de la bbox pilote */}
        <GeoJSON
          key="bbox-mask"
          data={BBOX_MASK}
          style={{ fillColor: '#0a1228', fillOpacity: 0.52, color: 'none', weight: 0 }}
          interactive={false}
        />

        {emprise && (
          <GeoJSON key="emprise" data={emprise} style={EMPRISE_STYLE} interactive={false} />
        )}

        <Rectangle
          bounds={[[DEMO_BBOX[0], DEMO_BBOX[1]], [DEMO_BBOX[2], DEMO_BBOX[3]]]}
          pathOptions={{ color: '#f0c040', weight: 2, fill: false, dashArray: '6 4', opacity: 0.9 }}
          interactive={false}
        />

        {/* Routes d'accès avec flèches — visibles uniquement pour le parking sélectionné */}
        {showAcces && (
          <ArrowRoutes features={routesFeatures} selectedId={selectedAccesId} />
        )}

        {/* Couche classement accessibilité — étape 2 */}
        {showAcces && accesFeatures?.length > 0 && (
          <GeoJSON
            key={`acces-${accesFeatures.length}-${selectedAccesId}`}
            data={{ type: 'FeatureCollection', features: accesFeatures }}
            style={f => {
              const cl = f.properties?.classe_acces
              const selected = f.properties?.id === selectedAccesId
              const colors = {
                tres_accessible: '#22c55e',
                accessible:      '#86efac',
                acces_moyen:     '#f97316',
                acces_difficile: '#ef4444',
                non_connecte:    '#64748b',
              }
              const color = colors[cl] || '#64748b'
              return {
                color, fillColor: color,
                weight: selected ? 4 : 2.5,
                fillOpacity: selected ? 0.55 : 0.3,
                dashArray: selected ? null : '4 2',
              }
            }}
            onEachFeature={(feature, layer) => {
              layer.on('click', e => {
                L.DomEvent.stopPropagation(e)
                const id = feature.properties?.id
                onSelectAcces?.(id)
                setAccesPopup({ feature, latlng: e.latlng })
              })
            }}
          />
        )}

        {/* Zones d'origine — demande d'évacuation */}
        {showZonesOrigine && zonesOrigine?.length > 0 && (
          <GeoJSON
            key={`zones-origine-${zonesOrigine.length}`}
            data={{ type: 'FeatureCollection', features: zonesOrigine }}
            style={f => {
              const statut = f.properties?.statut_ppri
              if (statut === 'interdiction')
                return { color: '#dc2626', fillColor: '#dc2626', weight: 2, fillOpacity: 0.35, dashArray: '4 3' }
              return { color: '#94a3b8', fillColor: '#94a3b8', weight: 1, fillOpacity: 0.08, dashArray: '2 4' }
            }}
            onEachFeature={(feature, layer) => {
              const p = feature.properties || {}
              const titre = p.nom || p.type_label || p.type_zone
              const statut = p.statut_ppri === 'interdiction' ? '🔴 Zone interdiction' : '⬜ Hors zone critique'
              layer.bindTooltip(
                `<b>${titre}</b><br>${statut}<br>${p.surface_m2?.toLocaleString()} m² · ~${p.veh_estimes} véhicules`,
                { sticky: true, className: 'leaflet-tooltip-dark' }
              )
            }}
            interactive={true}
          />
        )}

        {/* Couche classement final — étape 3 */}
        {showClassementFinal && classementFinal?.length > 0 && (
          <GeoJSON
            key={`final-${classementFinal.length}-${selectedFinalId}`}
            data={{ type: 'FeatureCollection', features: classementFinal }}
            style={f => {
              const cl = f.properties?.classe_finale
              const color = FINAL_COLORS[cl] || '#64748b'
              const selected = f.properties?.id === selectedFinalId
              return {
                color, fillColor: color,
                weight: selected ? 4 : 2.5,
                fillOpacity: selected ? 0.55 : 0.28,
                dashArray: cl === 'mobilisable_sous_conditions' ? '5 3' : null,
              }
            }}
            onEachFeature={(feature, layer) => {
              layer.on('click', e => {
                L.DomEvent.stopPropagation(e)
                onSelectFinal?.(feature.properties?.id)
                setFinalPopup({ feature, latlng: e.latlng })
              })
            }}
          />
        )}

        {/* Couche vue décideur — simplifiée */}
        {showClassementSimple && classementFinal?.length > 0 && (
          <GeoJSON
            key={`simple-${classementFinal.length}`}
            data={{ type: 'FeatureCollection', features: classementFinal }}
            style={f => {
              const cl = f.properties?.classe_finale
              const color = FINAL_COLORS[cl] || '#64748b'
              return { color, fillColor: color, weight: 2.5, fillOpacity: 0.28,
                dashArray: cl === 'mobilisable_sous_conditions' ? '5 3' : null }
            }}
            onEachFeature={(feature, layer) => {
              layer.on('click', e => {
                L.DomEvent.stopPropagation(e)
                setSimplePopup({ feature, latlng: e.latlng })
              })
            }}
          />
        )}

        {/* Couche classement PPRI étape 1 */}
        {showPpriClassement && ppriFeatures?.length > 0 && (
          <GeoJSON
            key={`ppri-classement-${ppriFeatures.length}`}
            data={{ type: 'FeatureCollection', features: ppriFeatures }}
            style={f => {
              const classe = f.properties?.classe_ppri || 'refuge_potentiel'
              const colors = PPRI_COLORS[classe] || PPRI_COLORS['refuge_potentiel']
              return { ...colors, weight: 2.5, fillOpacity: 0.3 }
            }}
            onEachFeature={(feature, layer) => {
              layer.on('click', e => {
                L.DomEvent.stopPropagation(e)
                setPpriPopup({ feature, latlng: e.latlng })
              })
            }}
          />
        )}

        {/* Couche caractérisée */}
        {showCarac && caracFeatures?.length > 0 && (
          <GeoJSON
            key={`carac-v${caracVersion}`}
            data={{ type: 'FeatureCollection', features: caracFeatures }}
            style={f => {
              const s = f.properties?.statut_foncier
              const base = { weight: 2.5, fillOpacity: 0.22 }
              if (s === 'public')  return { ...base, color: '#0ea5e9', fillColor: '#0ea5e9' }
              if (s === 'prive')   return { ...base, color: '#f43f5e', fillColor: '#f43f5e' }
              if (s === 'mixte')   return { ...base, color: '#7c3aed', fillColor: '#7c3aed' }
              return { ...base, color: '#64748b', fillColor: '#64748b', dashArray: '4 3', fillOpacity: 0.12 }
            }}
            onEachFeature={(feature, layer) => {
              layer.on('click', e => {
                L.DomEvent.stopPropagation(e)
                setCaracPopup({ feature, latlng: e.latlng })
              })
            }}
          />
        )}

        {/* Couches de référence (filtrées à la bbox) */}
        {['osm', 'bdtopo'].map(id => {
          if (!refLayers?.[id] || !refData[id]) return null
          const clipped = { ...refData[id], features: refData[id].features.filter(inDemoBbox) }
          return (
            <GeoJSON
              key={`ref-${id}`}
              data={clipped}
              style={REF_STYLE[id]}
              onEachFeature={(feature, layer) => {
                layer.on('click', e => {
                  L.DomEvent.stopPropagation(e)
                  setRefPopup({ feature, latlng: e.latlng })
                })
              }}
            />
          )
        })}

        {polyFeatures.length > 0 && (
          <GeoJSON
            key={geoJsonKey + '-poly'}
            data={polyGeoJSON}
            style={featureStyleWithEdit}
            onEachFeature={handleEachFeature}
          />
        )}

        {pointFeatures.map((feat, i) => {
          const stars = feat.properties?.ia_etoiles ?? 0
          const style = STAR_STYLES[stars] || STAR_STYLES[0]
          const [lng, lat] = feat.geometry.coordinates
          const radiusM = feat.properties?.r_road_m || 40
          return (
            <Circle key={`pt-${i}`} center={[lat, lng]} radius={radiusM}
              pathOptions={style}
              eventHandlers={{ click: e => onSelectFeature(feat, e.latlng) }} />
          )
        })}

        {/* Couche saisie manuelle */}
        {manualFeatures?.length > 0 && (
          <GeoJSON
            key={`manual-${manualFeatures.length}`}
            data={{ type: 'FeatureCollection', features: manualFeatures }}
            style={f => f.properties?.id === manualPopup?.feature?.properties?.id ? MANUAL_STYLE_EDIT : MANUAL_STYLE}
            onEachFeature={(feature, layer) => {
              layer.on('click', e => {
                L.DomEvent.stopPropagation(e)
                setManualPopup({ feature, latlng: e.latlng })
              })
            }}
          />
        )}

        <GeomEditorControl
          editingGeom={editingGeom}
          onGeomEdited={onGeomEdited}
          onCancel={onCancelGeomEdit}
        />

        <ManualDrawController
          active={isDrawingManual}
          onDrawn={onManualDrawn}
          onCancel={onManualCancelDraw}
        />

        {selectedFeature && clickLatlng && (
          <FloatingPanel latlng={clickLatlng} wrapperRef={wrapperRef}>
            <FeatureDetail
              feature={selectedFeature}
              onClose={onCloseFeature}
              onEdit={patch => onEditFeature(selectedFeature.properties._demo_id, patch)}
              onEditGeom={onEditGeomFeature}
              editingGeomId={editingGeomId}
            />
          </FloatingPanel>
        )}

        {refPopup && (
          <FloatingPanel latlng={refPopup.latlng} wrapperRef={wrapperRef}>
            <RefPopupContent feature={refPopup.feature} onClose={() => setRefPopup(null)} />
          </FloatingPanel>
        )}

        {manualPopup && (
          <FloatingPanel latlng={manualPopup.latlng} wrapperRef={wrapperRef}>
            <ManualPopupContent
              feature={manualPopup.feature}
              onClose={() => setManualPopup(null)}
              onDelete={id => { onManualDelete(id); setManualPopup(null) }}
            />
          </FloatingPanel>
        )}

        {caracPopup && (
          <FloatingPanel latlng={caracPopup.latlng} wrapperRef={wrapperRef}>
            <CaracPopup
              feature={caracPopup.feature}
              onClose={() => setCaracPopup(null)}
              onSave={patch => {
                onCaracEdit(caracPopup.feature.properties.id, patch)
                setCaracPopup(null)
              }}
            />
          </FloatingPanel>
        )}

        {accesPopup && (
          <FloatingPanel latlng={accesPopup.latlng} wrapperRef={wrapperRef}>
            <AccesPopup feature={accesPopup.feature} onClose={() => { setAccesPopup(null); onSelectAcces?.(null) }} />
          </FloatingPanel>
        )}

        {ppriPopup && (
          <FloatingPanel latlng={ppriPopup.latlng} wrapperRef={wrapperRef}>
            <PpriPopup
              feature={ppriPopup.feature}
              onClose={() => setPpriPopup(null)}
              onReclassify={(nouvelle_classe, justif) => {
                onPpriReclassify?.(ppriPopup.feature.properties.id, nouvelle_classe, justif)
                setPpriPopup(null)
              }}
            />
          </FloatingPanel>
        )}

        {finalPopup && (
          <FloatingPanel latlng={finalPopup.latlng} wrapperRef={wrapperRef}>
            <FicheParking
              feature={finalPopup.feature}
              onClose={() => { setFinalPopup(null); onSelectFinal?.(null) }}
              onDelete={id => { onFinalDelete?.(id); setFinalPopup(null) }}
            />
          </FloatingPanel>
        )}

        {simplePopup && (
          <FloatingPanel latlng={simplePopup.latlng} wrapperRef={wrapperRef}>
            <FicheParkingSimple
              feature={simplePopup.feature}
              onClose={() => setSimplePopup(null)}
            />
          </FloatingPanel>
        )}
      </MapContainer>
    </div>
  )
}
