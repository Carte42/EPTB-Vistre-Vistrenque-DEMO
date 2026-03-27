# Carte42 — Détection Parkings

App de détection automatique des emprises de stationnement pour appel d'offres.
Zone : 42 communes autour de Nîmes (Gard, dpt 30).

## Lancer le projet

```bash
npm run dev    # → http://localhost:5173
# ou double-clic sur : Lancer Detection Parkings.lnk
```

## Architecture

```
fetch_emprise_communes.py          # génère public/data/emprise_zone.geojson (Overpass)
public/
  data/
    detections.geojson             # source de vérité — NE PAS écraser manuellement
    emprise_zone.geojson           # union 42 communes (Polygon, ~34 Ko)
src/
  config.js                        # MAP_CENTER, MAP_ZOOM, DEMO_BBOX
  App.jsx                          # état global + localStorage overrides
  components/
    MapView.jsx                    # Leaflet + fond IGN 2020 / Google 2025 / OSM
    Sidebar.jsx                    # slider priorité + export GeoJSON
    FeatureDetail.jsx              # popup détail zone au clic
    StarSlider.jsx                 # légende 0–5 étoiles adaptée parkings
    Onboarding.jsx                 # écran bienvenue + 3 étapes tooltip
```

## Paramètres zone

```js
MAP_CENTER = [43.7296, 4.3251]   // centroïde réel de l'emprise
MAP_ZOOM = 10                     // zoom initial (toute la zone)
DEMO_BBOX = [43.800, 4.330, 43.870, 4.420]  // Cap Costières / Nîmes Sud
```

Bounds emprise : `W=4.0761 S=43.4958 E=4.5835 N=43.9432`

## Communes couvertes (42)

Aigues-Mortes, Aigues-Vives, Aimargues, Aubais, Aubord, Beauvoisin, Bernis,
Bezouce, Boissières, Bouillargues, Cabrières, Caissargues, Calvisson, Caveirac,
Clarensac, Codognan, Congénies, Gallargues-le-Montueux, Garons, Générac,
Langlade, Le Cailar, Lédenon, Manduel, Marguerittes, Milhaud, Mus,
Nages-et-Solorgues, Nîmes, Poulx, Redessan, Rodilhan,
Saint-Côme-et-Maruéjols, Saint-Dionisy, Saint-Gervasy, Saint-Gilles,
Saint-Laurent-d'Aigouze, Sernhac, Uchaud, Vauvert, Vergèze, Vestric-et-Candiac

## Format detections.geojson

Chaque feature GeoJSON doit avoir :

```json
{
  "type": "Feature",
  "geometry": { "type": "Polygon", "coordinates": [...] },
  "properties": {
    "id": "PKG_001",
    "ia_etoiles": 4,
    "ia_label": "Parking commercial ZAC",
    "ia_justification": "Nouvelle surface imperméabilisée visible sur ortho 2023",
    "ia_categorie": "parking_commercial",
    "confiance": "haute",
    "surface_m2": 12500,
    "commune": "Milhaud",
    "source": "osm+ortho"
  }
}
```

### Catégories (`ia_categorie`)

| Valeur | Libellé |
|---|---|
| `nouveau_parking` | Nouveau parking |
| `extension_parking` | Extension parking |
| `parking_residentiel` | Parking résidentiel |
| `parking_commercial` | Parking commercial |
| `parking_logistique` | Parking logistique |
| `parking_voirie` | Stationnement sur voirie |
| `parking_silo` | Parking silo / ouvrage |
| `modification_marquage` | Modification marquage |
| `non_pertinent` | Non pertinent |

## Workflow

1. Scripts de détection Python → export vers `public/data/detections.geojson`
2. `npm run dev` → annoter/corriger via l'UI (EDIT_MODE=true)
3. Bouton "Télécharger les données" → `Detections_Parkings_Demo.geojson`
4. Ce fichier exporté devient la nouvelle source → écraser `public/data/detections.geojson`

## Points d'attention

- `localStorage` clé : `carte42_parkings_overrides` (isolé de SDE35)
- `EDIT_MODE = true` — interface de travail, pas de démo client
- Passer `EDIT_MODE = false` avant de publier une démo client
- `emprise_zone.geojson` : affiché en contour bleu pointillé, non cliquable
- WMS IGN : EPSG:4326, bbox `(latmin, lonmin, latmax, lonmax)` — jamais EPSG:2154
- NaN dans props GeoJSON → JSON invalide navigateur → filtrer `math.isnan()` dans les scripts Python

## Données IGN (WMS data.geopf.fr/wms-r/wms)

| Variable | Couche | Notes |
|---|---|---|
| `IGN_LAYER_T1` | `ORTHOIMAGERY.ORTHOPHOTOS2020` | RGB 2020 |
| Google Satellite | `mt1.google.com/vt/lyrs=s` | Vue actuelle ~2024-2025 |

## Git

Email git : allanderrien@users.noreply.github.com

## Documents AO (dans ce dossier)

- `2026-03-CCTP.pdf` — Cahier des clauses techniques particulières
- `AWS-MPI-1797834-RC.pdf` — Règlement de la consultation
