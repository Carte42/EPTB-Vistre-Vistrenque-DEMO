import { DEMO_BBOX } from '../config.js'

// Retire les suffixes de gestion interne des noms de parkings affichés
export function cleanNom(nom, id) {
  if (!nom) return id || '—'
  return nom.replace(/\s*[-–]\s*a supprimer\s*/gi, '').replace(/\s*[-–]\s*fermé\s*/gi, '').trim() || id || '—'
}

// ── Bbox filter ──────────────────────────────────────────────────────────────
export function flatCoords(geometry) {
  const t = geometry?.type
  if (!t) return []
  if (t === 'Point')                            return [geometry.coordinates]
  if (t === 'MultiPoint' || t === 'LineString') return geometry.coordinates
  if (t === 'Polygon' || t === 'MultiLineString') return geometry.coordinates.flat()
  if (t === 'MultiPolygon')                     return geometry.coordinates.flat(2)
  return []
}

export function inDemoBbox(feature) {
  const [S, W, N, E] = DEMO_BBOX
  const coords = flatCoords(feature?.geometry)
  if (!coords.length) return false
  let fW = Infinity, fE = -Infinity, fS = Infinity, fN = -Infinity
  for (const [lon, lat] of coords) {
    if (lon < fW) fW = lon; if (lon > fE) fE = lon
    if (lat < fS) fS = lat; if (lat > fN) fN = lat
  }
  return fW <= E && fE >= W && fS <= N && fN >= S
}

// ── Area (Shoelace, projection locale lat ~43.8°N) ───────────────────────────
const LAT_M = 111130
const LON_M = 80360

function ringAreaM2(ring) {
  let a = 0
  for (let i = 0; i < ring.length - 1; i++) {
    const x1 = ring[i][0]   * LON_M, y1 = ring[i][1]   * LAT_M
    const x2 = ring[i+1][0] * LON_M, y2 = ring[i+1][1] * LAT_M
    a += x1 * y2 - x2 * y1
  }
  return Math.abs(a) / 2
}

export function approxAreaM2(geometry) {
  if (!geometry) return 0
  if (geometry.type === 'Polygon')
    return ringAreaM2(geometry.coordinates[0])
  if (geometry.type === 'MultiPolygon')
    return geometry.coordinates.reduce((s, p) => s + ringAreaM2(p[0]), 0)
  return 0
}

// ── OSM tag inference ────────────────────────────────────────────────────────
export function inferStatut(p) {
  const acc = (p.access || '').toLowerCase()
  if (['private', 'no', 'customers', 'delivery'].includes(acc)) return 'prive'
  if (['yes', 'public', 'permissive'].includes(acc)) return 'public'
  if (p.fee === 'no') return 'public'
  return 'inconnu'
}

export function inferTypeParkking(p) {
  const pk = (p.parking || '').toLowerCase()
  if (pk === 'underground')   return 'souterrain'
  if (pk === 'multi-storey')  return 'silo'
  if (pk === 'rooftop')       return 'toiture'
  if (pk === 'carports')      return 'auvent'
  return 'surface'
}
