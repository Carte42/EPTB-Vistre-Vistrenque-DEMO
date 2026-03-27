"""
Étape 2a — Zones d'origine (v2)

1. Télécharge les bâtiments OSM (DEMO_BBOX) → cache local
2. Télécharge le raster PPRI (WMS GetMap) → cache PNG
3. Pour chaque bâtiment, lookup pixel PPRI → filtre zones interdiction
4. Clustering spatial (100 m, BFS) → îlots à l'échelle lotissement
5. Calcule poids + véhicules estimés par îlot
Output : public/data/zones_origine.geojson

Usage :
  python step2a_zones_origine.py
  python step2a_zones_origine.py --no-cache   (force re-téléchargement)
"""
import json, sys, os, math, time, io, requests, collections
sys.stdout.reconfigure(encoding='utf-8')

from PIL import Image
from shapely.geometry import shape, mapping, MultiPolygon, Polygon, Point
from shapely.ops import unary_union

# ── Paramètres ────────────────────────────────────────────────────────────────

# DEMO_BBOX (depuis config.js) : [S, W, N, E]
LAT_MIN, LON_MIN, LAT_MAX, LON_MAX = 43.804312, 4.454409, 43.840692, 4.515345

CACHE_BUILDINGS = "public/data/ref/batiments_demo.geojson"
CACHE_RASTER    = "public/data/ref/ppri_demo.png"
OUT             = "public/data/zones_origine.geojson"

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
WMS_URL      = "https://mapsref.brgm.fr/wxs/georisques/risques"

# Résolution du raster téléchargé
RASTER_W, RASTER_H = 1200, 900

# Seuil clustering (mètres)
CLUSTER_DIST_M = 100

# Véhicules estimés par m² de bâti selon type
VEH_PER_M2 = {
    "apartments": 1.2 / 70,
    "house":      1.5 / 100,
    "detached":   1.5 / 100,
    "residential":1.0 / 80,
    "retail":     1.0 / 40,
    "commercial": 1.0 / 50,
    "yes":        1.0 / 70,   # générique résidentiel
}
VEH_DEFAULT = 1.0 / 80

NO_CACHE = "--no-cache" in sys.argv

# ── Phase 1 : Bâtiments Overpass ──────────────────────────────────────────────

def download_buildings():
    if not NO_CACHE and os.path.exists(CACHE_BUILDINGS):
        print(f"  Cache bâtiments : {CACHE_BUILDINGS}")
        with open(CACHE_BUILDINGS, encoding="utf-8") as f:
            return json.load(f).get("features", [])

    print("  Requête Overpass bâtiments…")
    q = f"""[out:json][timeout:90];
(
  way["building"]({LAT_MIN},{LON_MIN},{LAT_MAX},{LON_MAX});
  node["building"]({LAT_MIN},{LON_MIN},{LAT_MAX},{LON_MAX});
);
out body geom;"""

    for attempt in range(3):
        try:
            r = requests.post(OVERPASS_URL, data={"data": q}, timeout=100)
            r.raise_for_status()
            els = r.json().get("elements", [])
            print(f"  {len(els)} éléments reçus")
            break
        except Exception as e:
            print(f"  Tentative {attempt+1} : {e}")
            if attempt < 2: time.sleep(15)
    else:
        raise RuntimeError("Overpass inaccessible")

    features = []
    for el in els:
        tags  = el.get("tags", {})
        btype = tags.get("building", "yes")

        if el["type"] == "node":
            lon, lat = el["lon"], el["lat"]
            geom = {"type": "Point", "coordinates": [lon, lat]}
            surface = 80  # estimation forfaitaire pour un nœud
        elif el["type"] == "way":
            coords = [[nd["lon"], nd["lat"]] for nd in el.get("geometry", [])]
            if len(coords) < 3:
                continue
            if coords[0] != coords[-1]:
                coords.append(coords[0])
            geom = {"type": "Polygon", "coordinates": [coords]}
            # Surface approx
            lat_m = 111_000
            lon_m = 111_000 * math.cos(math.radians(sum(c[1] for c in coords) / len(coords)))
            try:
                s = shape(geom)
                surface = max(10, int(s.area * lon_m * lat_m))
            except Exception:
                surface = 80
        else:
            continue

        features.append({
            "type": "Feature",
            "geometry": geom,
            "properties": {"building": btype, "surface_m2": surface, "nom": tags.get("name", "")},
        })

    os.makedirs(os.path.dirname(CACHE_BUILDINGS), exist_ok=True)
    with open(CACHE_BUILDINGS, "w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "features": features}, f)
    print(f"  Cache écrit : {CACHE_BUILDINGS}")
    return features

# ── Phase 2 : Raster PPRI ─────────────────────────────────────────────────────

def download_raster():
    if not NO_CACHE and os.path.exists(CACHE_RASTER):
        print(f"  Cache raster : {CACHE_RASTER}")
        return Image.open(CACHE_RASTER).convert("RGBA")

    print("  Téléchargement raster PPRI (WMS GetMap)…")
    params = {
        "SERVICE": "WMS", "VERSION": "1.1.1", "REQUEST": "GetMap",
        "LAYERS": "PPRN_ZONE_INOND", "STYLES": "",
        "BBOX": f"{LON_MIN},{LAT_MIN},{LON_MAX},{LAT_MAX}",
        "WIDTH": str(RASTER_W), "HEIGHT": str(RASTER_H),
        "SRS": "EPSG:4326", "FORMAT": "image/png", "TRANSPARENT": "TRUE",
    }
    r = requests.get(WMS_URL, params=params, timeout=30)
    r.raise_for_status()
    img = Image.open(io.BytesIO(r.content)).convert("RGBA")
    os.makedirs(os.path.dirname(CACHE_RASTER), exist_ok=True)
    img.save(CACHE_RASTER)
    print(f"  Raster {img.size[0]}×{img.size[1]} px enregistré : {CACHE_RASTER}")
    return img

# ── Phase 3 : Lookup pixel PPRI ───────────────────────────────────────────────

def make_ppri_lookup(img):
    """Retourne une fonction (lon, lat) → 'interdiction' | 'prescription' | 'hors_zone'."""
    pixels = img.load()
    w, h   = img.size

    def classify_color(r, g, b, a):
        if a < 30:
            return "hors_zone"
        # Rouge dominant → interdiction
        if r > 200 and g < 150 and b < 150:
            return "interdiction"
        # Bleu dominant → prescription
        if b > 200 and r < 80 and g < 80:
            return "prescription"
        return "autre"

    def lookup(lon, lat):
        # Convertit coordonnées géo → pixel
        px = int((lon - LON_MIN) / (LON_MAX - LON_MIN) * w)
        py = int((LAT_MAX - lat) / (LAT_MAX - LAT_MIN) * h)
        px = max(0, min(w - 1, px))
        py = max(0, min(h - 1, py))
        r, g, b, a = pixels[px, py]
        return classify_color(r, g, b, a)

    return lookup

# ── Phase 4 : Centroïdes + filtrage PPRI ─────────────────────────────────────

def get_centroid(feature):
    geom = feature["geometry"]
    t    = geom["type"]
    if t == "Point":
        return geom["coordinates"][0], geom["coordinates"][1]
    if t == "Polygon":
        coords = geom["coordinates"][0]
        return (sum(c[0] for c in coords) / len(coords),
                sum(c[1] for c in coords) / len(coords))
    return None, None

# ── Phase 5 : Clustering BFS (sans scipy) ────────────────────────────────────

def deg_to_m(dlat, dlon, lat):
    """Distance approx en mètres entre deux points proches."""
    dy = dlat * 111_000
    dx = dlon * 111_000 * math.cos(math.radians(lat))
    return math.sqrt(dx*dx + dy*dy)

def cluster_points(points, dist_m=CLUSTER_DIST_M):
    """
    points : liste de (lon, lat, surface, btype)
    Retourne une liste de clusters, chaque cluster = liste d'indices.
    Algorithme BFS O(n²) — acceptable car points filtrés (quelques centaines).
    """
    n = len(points)
    visited  = [False] * n
    clusters = []

    for i in range(n):
        if visited[i]:
            continue
        cluster = [i]
        visited[i] = True
        queue = collections.deque([i])
        while queue:
            cur = queue.popleft()
            cx, cy = points[cur][0], points[cur][1]
            for j in range(n):
                if visited[j]:
                    continue
                jx, jy = points[j][0], points[j][1]
                if deg_to_m(abs(cy - jy), abs(cx - jx), cy) <= dist_m:
                    visited[j] = True
                    cluster.append(j)
                    queue.append(j)
        clusters.append(cluster)

    return clusters

# ── Phase 6 : Construire les îlots ───────────────────────────────────────────

def build_ilots(points, clusters, source_features):
    """
    Construit un GeoJSON Feature par cluster.
    Géométrie : convex hull des centroides (ou buffer si trop petit).
    """
    ilots = []
    lat_m = 111_000
    for idx_cluster, indices in enumerate(clusters):
        pts      = [points[i] for i in indices]
        features = [source_features[i] for i in indices]

        lons = [p[0] for p in pts]
        lats = [p[1] for p in pts]
        lon_c = sum(lons) / len(lons)
        lat_c = sum(lats) / len(lats)
        lon_m = lat_m * math.cos(math.radians(lat_c))

        total_surface = sum(p[2] for p in pts)
        nb_batiments  = len(pts)

        # Type dominant
        from collections import Counter
        btypes = Counter(p[3] for p in pts)
        type_dom = btypes.most_common(1)[0][0]

        # Véhicules estimés
        veh_per_m2 = VEH_PER_M2.get(type_dom, VEH_DEFAULT)
        veh_estimes = max(1, round(total_surface * veh_per_m2))

        # Géométrie : convex hull des centroïdes ou buffer si un seul point
        shapely_pts = [Point(p[0], p[1]) for p in pts]
        if len(shapely_pts) == 1:
            # Buffer ~50m en degrés
            buf_deg = 50 / lon_m
            hull = shapely_pts[0].buffer(buf_deg)
        else:
            hull = unary_union(shapely_pts).convex_hull
            # Buffer léger pour la lisibilité visuelle (~20m)
            buf_deg = 20 / lon_m
            hull = hull.buffer(buf_deg)

        ilots.append({
            "type": "Feature",
            "geometry": mapping(hull),
            "properties": {
                "id":           f"ORI_{idx_cluster+1:03d}",
                "nb_batiments": nb_batiments,
                "type_dom":     type_dom,
                "surface_m2":   total_surface,
                "veh_estimes":  veh_estimes,
                "statut_ppri":  "interdiction",
                "lon_c":        round(lon_c, 6),
                "lat_c":        round(lat_c, 6),
            },
        })

    return ilots

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("═══ Étape 2a — Zones d'origine ═══\n")

    # Phase 1
    print("── Phase 1 : Bâtiments OSM ──")
    buildings = download_buildings()
    print(f"  {len(buildings)} bâtiments chargés\n")

    # Phase 2
    print("── Phase 2 : Raster PPRI ──")
    img    = download_raster()
    lookup = make_ppri_lookup(img)
    print()

    # Phase 3 : filtrage
    print("── Phase 3 : Filtrage bâtiments en zone interdiction ──")
    in_interdiction = []
    for feat in buildings:
        lon, lat = get_centroid(feat)
        if lon is None:
            continue
        status = lookup(lon, lat)
        if status == "interdiction":
            btype   = feat["properties"].get("building", "yes")
            surface = feat["properties"].get("surface_m2", 80)
            in_interdiction.append((lon, lat, surface, btype))

    print(f"  Bâtiments en zone interdiction : {len(in_interdiction)} / {len(buildings)}\n")

    if not in_interdiction:
        print("  Aucun bâtiment en zone interdiction dans la DEMO_BBOX.")
        gj = {"type": "FeatureCollection", "features": []}
        with open(OUT, "w", encoding="utf-8") as f:
            json.dump(gj, f)
        return

    # Phase 4 : clustering
    print("── Phase 4 : Clustering (BFS, seuil 100 m) ──")
    clusters = cluster_points(in_interdiction)
    print(f"  {len(in_interdiction)} bâtiments → {len(clusters)} îlots\n")

    # Phase 5 : construire les îlots
    print("── Phase 5 : Résumé des îlots ──")
    ilots = build_ilots(in_interdiction, clusters, buildings)
    ilots.sort(key=lambda f: -f["properties"]["veh_estimes"])

    total_veh = 0
    for ilot in ilots:
        p = ilot["properties"]
        total_veh += p["veh_estimes"]
        print(f"  {p['id']}  {p['nb_batiments']:4d} bâtiments  "
              f"{p['surface_m2']:8d} m²  ~{p['veh_estimes']:4d} véh.  [{p['type_dom']}]")

    print(f"\n  Total véhicules estimés à évacuer : {total_veh}")

    # Écriture
    gj = {"type": "FeatureCollection", "features": ilots}
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(gj, f, ensure_ascii=False, indent=2)
    print(f"\n✓ Écrit : {OUT}  ({len(ilots)} îlots)")
    print("Rechargez l'UI pour voir la couche 'Zones d'origine'.")

if __name__ == "__main__":
    main()
