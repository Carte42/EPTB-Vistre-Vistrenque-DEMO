"""
Télécharge les contours des 42 communes via Overpass API
et génère public/data/emprise_zone.geojson (union des contours).
"""
import json, time, requests
from shapely.ops import unary_union
from shapely.geometry import shape, mapping

COMMUNES = [
    "Aigues-Mortes", "Aigues-Vives", "Aimargues", "Aubais", "Aubord",
    "Beauvoisin", "Bernis", "Bezouce", "Boissières", "Bouillargues",
    "Cabrières", "Caissargues", "Calvisson", "Caveirac", "Clarensac",
    "Codognan", "Congénies", "Gallargues-le-Montueux", "Garons", "Générac",
    "Langlade", "Le Cailar", "Lédenon", "Manduel", "Marguerittes",
    "Milhaud", "Mus", "Nages-et-Solorgues", "Nîmes", "Poulx",
    "Redessan", "Rodilhan", "Saint-Côme-et-Maruéjols", "Saint-Dionisy",
    "Saint-Gervasy", "Saint-Gilles", "Saint-Laurent-d'Aigouze", "Sernhac",
    "Uchaud", "Vauvert", "Vergèze", "Vestric-et-Candiac",
]

# Requête Overpass : toutes les relations admin_level=8 dans le Gard (dpt 30)
# nommées exactement comme nos communes
OVERPASS_URL = "https://overpass-api.de/api/interpreter"

def build_query():
    names = "\n".join(
        f'  relation["admin_level"="8"]["name"="{c}"]["ref:INSEE"~"^30"](area.gard);'
        for c in COMMUNES
    )
    return f"""
[out:json][timeout:90];
area["name"="Gard"]["admin_level"="6"]->.gard;
(
{names}
);
out geom;
"""

def fetch():
    print("Requête Overpass…")
    q = build_query()
    for attempt in range(3):
        try:
            r = requests.post(OVERPASS_URL, data={"data": q}, timeout=120)
            r.raise_for_status()
            return r.json()
        except Exception as e:
            print(f"  Tentative {attempt+1} échouée : {e}")
            time.sleep(20)
    raise RuntimeError("Overpass inaccessible")

def relation_to_polygon(element):
    """Reconstruit un (Multi)Polygon à partir des members d'une relation."""
    from shapely.geometry import LineString, MultiPolygon
    from shapely.ops import polygonize, unary_union as uu

    outer_lines = []
    for m in element.get("members", []):
        if m.get("role") == "outer" and m.get("type") == "way":
            coords = [(nd["lon"], nd["lat"]) for nd in m.get("geometry", [])]
            if len(coords) >= 2:
                outer_lines.append(LineString(coords))

    if not outer_lines:
        return None

    merged = uu(outer_lines)
    polys = list(polygonize(merged))
    if not polys:
        return None
    return uu(polys)

def main():
    data = fetch()
    elements = data.get("elements", [])
    print(f"  {len(elements)} relations reçues")

    found_names = {e["tags"].get("name") for e in elements}
    missing = [c for c in COMMUNES if c not in found_names]
    if missing:
        print(f"  Communes manquantes ({len(missing)}) : {missing}")

    polygons = []
    for el in elements:
        poly = relation_to_polygon(el)
        if poly and not poly.is_empty:
            polygons.append(poly)
        else:
            print(f"  Géométrie vide pour : {el['tags'].get('name')}")

    if not polygons:
        raise RuntimeError("Aucun polygone valide")

    emprise = unary_union(polygons)
    print(f"  Union : {emprise.geom_type}, bounds = {[round(x,4) for x in emprise.bounds]}")

    geojson = {
        "type": "FeatureCollection",
        "features": [{
            "type": "Feature",
            "properties": {"nom": "Zone AO Nîmes Métropole", "nb_communes": len(polygons)},
            "geometry": mapping(emprise),
        }]
    }

    out = "public/data/emprise_zone.geojson"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False)
    print(f"  Écrit : {out}")

    # Centroïde pour config.js
    c = emprise.centroid
    b = emprise.bounds
    print(f"\n── config.js ─────────────────────────────────────────")
    print(f"export const MAP_CENTER = [{c.y:.4f}, {c.x:.4f}]")
    print(f"// Bounds : S={b[1]:.4f} W={b[0]:.4f} N={b[3]:.4f} E={b[2]:.4f}")

if __name__ == "__main__":
    main()
