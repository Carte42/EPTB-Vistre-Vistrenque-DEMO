# Carte42 — Détection Parkings · Consultation 2026-03

Analyse des aires de stationnement refuge en zone inondable.
Zone : 42 communes du bassin versant Vistre-Vistrenque (Gard, dpt 30).
Client : EPTB Vistre-Vistrenque · Dépôt démo : https://github.com/Carte42/EPTB-Vistre-Vistrenque-DEMO

## Lancer le projet

```bash
npm run dev                          # mode travail → http://localhost:5173
VITE_DEMO_CLIENT=true npm run dev    # mode démo en dev
npm run build:demo                   # build mode démo client (VITE_DEMO_CLIENT=true)
npx gh-pages -d dist                 # déployer sur GitHub Pages
```

Raccourci Windows : `Lancer l'app.bat` (via `Lancer Detection Parkings.lnk`) — propose les deux modes au démarrage.

## Architecture

```
public/
  data/
    classement_final.geojson   # SOURCE DE VÉRITÉ — 48 parkings classés, NE PAS écraser
    cheminements.geojson       # tracés exemple Prix 1 (hors d'eau) et Prix 3 (naufragés)
    emprise_zone.geojson       # union 42 communes (Polygon, ~34 Ko)
    demo_perimeter.geojson     # périmètre zone de démonstration
    alea/
      alea_t20.geojson         # zones inondables T20–40 (7 features, ~83Ko)
      alea_t100.geojson        # zones inondables T100 (4 features, ~60Ko) — basé sur PPRI Géorisques
      alea_t1000.geojson       # zones inondables T1000 (1 feature, ~107Ko)
    archive/                   # anciennes versions des fichiers aléa
    ref/
      ppri_demo.png            # capture WMS PPRI de référence visuelle
src/
  config.js                    # MAP_CENTER, MAP_ZOOM, DEMO_BBOX, DEMO_CLIENT
  App.jsx                      # état global (scenario, showPrix2, aleaLayers, overrides)
  utils/
    geo.js                     # cleanNom(), helpers GeoJSON
  components/
    MapView.jsx                # Leaflet + fonds IGN/Google/OSM + couches PPRI/cadastre
    MapLegend.jsx              # légende scénarios + toggles PPRI/cadastre (DEMO_CLIENT)
    Sidebar.jsx                # ScenarioSelector + compteur refuge/inondable + toggle Prix 2
    ScenarioSelector.jsx       # 3 boutons T20/T100/T1000 (DEMO_CLIENT seulement)
    ClassementSlider.jsx       # slider filtre par classe_finale (mode travail)
    FicheParking.jsx           # popup détail parking — statut scénario + bouton cheminement
    Onboarding.jsx             # écran bienvenue + 4 étapes tooltip
    FeatureDetail.jsx          # popup détail détection (mode EDIT, hors DEMO_CLIENT)
    RightToolbar.jsx           # barre outils droite (hors DEMO_CLIENT)
.claude/
  commands/
    lancer.md                  # slash command /lancer (documentation uniquement)
scripts/
  generate_alea_inondation.py  # v1 — bathtub LiDAR seul (archivé)
  generate_alea_v2.py          # v2 — PPRI WMS + LiDAR (méthode courante)
```

## Modes

| Mode | Variable | Effet |
|---|---|---|
| Travail | `VITE_DEMO_CLIENT` absent | Tous les outils visibles, détections éditables, slider classe |
| Démo client | `VITE_DEMO_CLIENT=true` | Sélecteur scénario T20/T100/T1000, couche publics colorée refuge/inondable, toggle Prix 2, cheminements au clic |

## Paramètres zone

```js
MAP_CENTER = [43.7296, 4.3251]                          // centroïde emprise
MAP_ZOOM = 10                                            // zoom initial
DEMO_BBOX = [43.804312, 4.454409, 43.840692, 4.515345]  // zone démo Caissargues/Manduel
```

Bounds emprise : `W=4.0761 S=43.4958 E=4.5835 N=43.9432`

## Format classement_final.geojson

```json
{
  "type": "Feature",
  "geometry": { "type": "Polygon", "coordinates": [...] },
  "properties": {
    "id": "PKC_001",
    "nom": "Parking de la Mairie",
    "commune": "Milhaud",
    "surface_m2": 2400,
    "capacite_places": 80,
    "ppri_zone_brute": "hors_zone",
    "classe_ppri": "favorable",
    "justif_ppri": "...",
    "statut_foncier": "public",
    "rayon_captation_m": 1500,
    "nb_origines": 5,
    "demande_veh": 120,
    "ratio_capacite": 0.67,
    "saturation": "sous_sollicite",
    "temps_moyen_min": 4.2,
    "voie_acces_dom": "primary",
    "classe_acces": "acces_direct",
    "niveau": "communal",
    "classe_finale": "refuge_communal",
    "classe_label": "Refuge communal",
    "capacite_retenue": 80,
    "justif_finale": "...",
    "justif_manuelle": null,
    "inondable_t20": false,
    "inondable_t100": false,
    "inondable_t1000": false,
    "categorie_cctp": "public"
  }
}
```

### Champs scénarios (ajoutés 2026-03-30)

| Champ | Type | Valeur |
|---|---|---|
| `inondable_t20` | bool | true si ppri_zone_brute === 'Interdiction' |
| `inondable_t100` | bool | true si ppri_zone_brute in ['Interdiction', 'Prescriptions'] |
| `inondable_t1000` | bool | identique t100 provisoirement (CARTINO-2D à intégrer) |
| `categorie_cctp` | string | `public` / `mobilisable_prix2` / `exclure` |

Répartition : 20 publics · 21 mobilisables prix 2 · 7 exclus ("à supprimer" / "fermé")

### Classes (`classe_finale`)

| Valeur | Label | Critères |
|---|---|---|
| `aire_exposee` | Aire exposée | PPRI interdiction ou limitrophe |
| `refuge_local` | Refuge local | Hors PPRI, petite capacité, desserte locale |
| `refuge_communal` | Refuge communal | Hors PPRI, capacité moyenne, desserte communale |
| `refuge_territorial` | Refuge territorial | Hors PPRI, grande capacité, multi-communal |
| `mobilisable_sous_conditions` | Mobilisable sous conditions | Foncier privé/mixte, accès contraint, ou tiers gestionnaire |

## Points d'attention

- `cleanNom()` dans `utils/geo.js` — strip les flags internes ("- a supprimer", "- fermé") à l'affichage
- `justif_manuelle` : surcharge manuelle de justification (non affichée côté client si null)
- `justif_finale` : texte affiché dans la fiche popup client
- WMS IGN : EPSG:4326, bbox `(latmin, lonmin, latmax, lonmax)` — jamais EPSG:2154
- WMS Géorisques (`mapsref.brgm.fr`) : EPSG:4326, bbox `(lon_min, lat_min, lon_max, lat_max)` — format OGC standard, inverse de l'IGN
- WFS Géorisques : pas de couche zone PPRI polygone — seulement des agrégats communes (`PPRN_COMMUNE_RISQINOND_*`)
- NaN dans props GeoJSON → JSON invalide → filtrer `math.isnan()` dans les scripts Python
- `localStorage` clé : `carte42_parkings_overrides`

## Données externes

| Source | Accès | Usage |
|---|---|---|
| IGN Orthophotos 2020 | WMS `data.geopf.fr/wms-r/wms` · `ORTHOIMAGERY.ORTHOPHOTOS2020` | Fond de plan T1 |
| Google Satellite | `mt1.google.com/vt/lyrs=s` | Fond de plan actuel |
| PPRI Géorisques | WMS `mapsref.brgm.fr/wxs/georisques/risques` · `PPRN_ZONE_INOND` | Aléa inondation + base T100 pour les couches aléa |
| Cadastre | WMS `wxs.ign.fr` · `CADASTRALPARCELS.PARCELLAIRE_EXPRESS` | Foncier |

## Git

Email : allanderrien@users.noreply.github.com
Dépôt démo : `git remote` → `https://github.com/Carte42/EPTB-Vistre-Vistrenque-DEMO`

## Documents AO

- `2026-03-CCTP.pdf` — Cahier des clauses techniques particulières
- `AWS-MPI-1797834-RC.pdf` — Règlement de la consultation

## Communes couvertes (42)

Aigues-Mortes, Aigues-Vives, Aimargues, Aubais, Aubord, Beauvoisin, Bernis,
Bezouce, Boissières, Bouillargues, Cabrières, Caissargues, Calvisson, Caveirac,
Clarensac, Codognan, Congénies, Gallargues-le-Montueux, Garons, Générac,
Langlade, Le Cailar, Lédenon, Manduel, Marguerittes, Milhaud, Mus,
Nages-et-Solorgues, Nîmes, Poulx, Redessan, Rodilhan,
Saint-Côme-et-Maruéjols, Saint-Dionisy, Saint-Gervasy, Saint-Gilles,
Saint-Laurent-d'Aigouze, Sernhac, Uchaud, Vauvert, Vergèze, Vestric-et-Candiac
