"""
Télécharge les parkings de référence pour la zone des 42 communes (dpt 30).
  - OSM via Overpass API   → public/data/ref/parkings_osm.geojson
  - BD Topo V3 via WFS IGN → public/data/ref/parkings_bdtopo.geojson

Bbox zone : W=4.0761 S=43.4958 E=4.5835 N=43.9432
"""
import json, time, os, sys, requests
sys.stdout.reconfigure(encoding='utf-8')
from shapely.geometry import LineString, mapping
from shapely.ops import polygonize, unary_union

BBOX = dict(S=43.4958, W=4.0761, N=43.9432, E=4.5835)
OUT_DIR = "public/data/ref"
os.makedirs(OUT_DIR, exist_ok=True)

# ─── OSM via Overpass ──────────────────────────────────────────────────────

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

def overpass_query():
    s, w, n, e = BBOX['S'], BBOX['W'], BBOX['N'], BBOX['E']
    return f"""
[out:json][timeout:180];
(
  way["amenity"="parking"]({s},{w},{n},{e});
  way["landuse"="parking"]({s},{w},{n},{e});
  way["parking"="surface"]({s},{w},{n},{e});
  relation["amenity"="parking"]({s},{w},{n},{e});
  node["amenity"="parking"]({s},{w},{n},{e});
);
out body geom;
"""

def relation_to_geom(el):
    outer_lines, inner_lines = [], []
    for m in el.get("members", []):
        if m.get("type") != "way":
            continue
        coords = [[nd["lon"], nd["lat"]] for nd in m.get("geometry", [])]
        if len(coords) < 2:
            continue
        ls = LineString(coords)
        if m.get("role") == "outer":
            outer_lines.append(ls)
        elif m.get("role") == "inner":
            inner_lines.append(ls)
    if not outer_lines:
        return None
    outer_polys = list(polygonize(unary_union(outer_lines)))
    if not outer_polys:
        return None
    result = unary_union(outer_polys)
    if inner_lines:
        inner_polys = list(polygonize(unary_union(inner_lines)))
        if inner_polys:
            result = result.difference(unary_union(inner_polys))
    return mapping(result)

def element_to_feature(el):
    tags = el.get("tags", {})
    etype = el.get("type")

    if etype == "node":
        geom = {"type": "Point", "coordinates": [el["lon"], el["lat"]]}
    elif etype == "way":
        coords = [[nd["lon"], nd["lat"]] for nd in el.get("geometry", [])]
        if len(coords) < 3:
            return None
        if coords[0] != coords[-1]:
            coords.append(coords[0])
        geom = {"type": "Polygon", "coordinates": [coords]}
    elif etype == "relation":
        geom = relation_to_geom(el)
        if not geom:
            return None
    else:
        return None

    props = {"osm_id": el.get("id"), "osm_type": etype, "source": "osm", **tags}
    return {"type": "Feature", "geometry": geom, "properties": props}

def fetch_osm():
    print("-- OSM via Overpass --")
    q = overpass_query()
    for attempt in range(3):
        try:
            r = requests.post(OVERPASS_URL, data={"data": q}, timeout=200)
            r.raise_for_status()
            elements = r.json().get("elements", [])
            print(f"  {len(elements)} éléments reçus")

            features = [f for el in elements if (f := element_to_feature(el))]
            print(f"  → {len(features)} features GeoJSON")

            out = f"{OUT_DIR}/parkings_osm.geojson"
            with open(out, "w", encoding="utf-8") as fp:
                json.dump({"type": "FeatureCollection", "features": features}, fp, ensure_ascii=False)
            print(f"  Écrit : {out}")
            return
        except Exception as e:
            print(f"  Tentative {attempt+1} échouée : {e}")
            if attempt < 2:
                time.sleep(30)
    raise RuntimeError("Overpass inaccessible après 3 tentatives")

# --- BD Topo V3 via WFS IGN ---

WFS_URL       = "https://data.geopf.fr/wfs/ows"
BDTOPO_LAYER  = "BDTOPO_V3:equipement_de_transport"
BDTOPO_FILTER = "nature LIKE 'Parking%'"

def fetch_bdtopo():
    print("-- BD Topo V3 via WFS IGN --")
    s, w, n, e = BBOX['S'], BBOX['W'], BBOX['N'], BBOX['E']
    all_features = []
    start_index  = 0
    page_size    = 1000

    while True:
        params = {
            "SERVICE":      "WFS",
            "VERSION":      "2.0.0",
            "REQUEST":      "GetFeature",
            "TYPENAMES":    BDTOPO_LAYER,
            "BBOX":         f"{w},{s},{e},{n},EPSG:4326",
            "SRSNAME":      "EPSG:4326",
            "OUTPUTFORMAT": "application/json",
            "COUNT":        page_size,
            "STARTINDEX":   start_index,
        }
        try:
            r = requests.get(WFS_URL, params=params, timeout=60)
            r.raise_for_status()
            raw = r.json().get("features", [])
            if not raw:
                break
            # Filtre côté client : garder uniquement les parkings
            features = [f for f in raw if str(f.get("properties", {}).get("nature", "")).startswith("Parking")]
            for f in features:
                f.setdefault("properties", {})["source"] = "bdtopo"
            all_features.extend(features)
            print(f"  page {start_index//page_size+1} : {len(features)}/{len(raw)} parkings")
            if len(features) < page_size:
                break
            start_index += page_size
        except Exception as e:
            print(f"  Erreur WFS : {e}")
            break

    print(f"  Total BD Topo : {len(all_features)} features")
    out = f"{OUT_DIR}/parkings_bdtopo.geojson"
    with open(out, "w", encoding="utf-8") as fp:
        json.dump({"type": "FeatureCollection", "features": all_features}, fp, ensure_ascii=False)
    print(f"  Ecrit : {out}")

# ──────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    fetch_osm()
    fetch_bdtopo()
    print("\nTerminé.")
