// ── Passer à false pour désactiver les fonctions d'édition (annotations, géométrie, export)
export const EDIT_MODE = true

// ── true en mode démo client (npm run build:demo) — toolbar droite masquée, vue décideur par défaut
export const DEMO_CLIENT = import.meta.env.VITE_DEMO_CLIENT === 'true'

export const IGN_WMS_URL = 'https://data.geopf.fr/wms-r/wms'
export const IGN_LAYER_T1 = 'ORTHOIMAGERY.ORTHOPHOTOS2020'
export const GOOGLE_SAT_URL = 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'

// WMTS IGN — PM = WebMercator, aligné sur les tuiles standard {z}/{x}/{y}
export const IGN_WMTS_URL = (layer, format = 'image/jpeg') =>
  `https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${layer}&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=${format}`
export const IGN_LAYER_2024     = 'ORTHOIMAGERY.ORTHOPHOTOS2024'
export const IGN_LAYER_IRC_2024 = 'ORTHOIMAGERY.ORTHOPHOTOS.IRC.2024'

// Zone AO — 42 communes autour de Nîmes (Gard)
// Bounds : W=4.0761 S=43.4958 E=4.5835 N=43.9432
export const MAP_CENTER = [43.7296, 4.3251]
export const MAP_ZOOM = 10

// Zone pilote de démo
export const DEMO_BBOX = [43.804312, 4.454409, 43.840692, 4.515345] // [S, W, N, E]
