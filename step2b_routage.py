"""
Étape 2b — Routage accessibilité

Pour chaque parking refuge_potentiel :
  - Rayon de captation proportionnel à la capacité (log-interpolation 500 m → 5 km)
  - Routage Dijkstra (OSMnx) vers chaque îlot d'origine dans ce rayon
  - Métriques : distance, temps, type de voie dominant

Outputs :
  public/data/routes_acces.geojson          — LineStrings des trajets
  public/data/classement_accessibilite.geojson — parkings avec scores d'accès

Usage :
  python step2b_routage.py
  python step2b_routage.py --no-cache   (force re-téléchargement du graphe)
"""
import json, sys, os, math, pickle
sys.stdout.reconfigure(encoding='utf-8')

import osmnx as ox
import networkx as nx
from shapely.geometry import shape, mapping, LineString

# ── Paramètres ────────────────────────────────────────────────────────────────

LAT_MIN, LON_MIN, LAT_MAX, LON_MAX = 43.804312, 4.454409, 43.840692, 4.515345
GRAPH_MARGIN = 0.015   # ~1.5 km de marge autour du bbox pour le graphe

ORIGINS_FILE  = "public/data/zones_origine.geojson"
PARKINGS_FILE = "public/data/classement_ppri.geojson"
CACHE_GRAPH   = "public/data/ref/osm_graph_demo.pkl"
OUT_ROUTES    = "public/data/routes_acces.geojson"
OUT_ACCES     = "public/data/classement_accessibilite.geojson"

# Rayon de captation : racine carrée, plafonné à 3 000 m
# Formule : min(3000, 300 * sqrt(cap / 2))
# cap=2 → 300 m | cap=28 → 1 122 m | cap=170 → 2 766 m | cap=1070 → 3 000 m
CAP_REF = 2   # capacité de référence (rayon minimal)

# Vitesses moyennes par type de voie (km/h)
SPEED_KMH = {
    "motorway": 90, "trunk": 70, "primary": 50,
    "secondary": 45, "tertiary": 40, "residential": 30,
    "unclassified": 25, "service": 15, "living_street": 15,
}
SPEED_DEFAULT = 25

# Seuil temps pour qu'une origine soit considérée "desservie"
TEMPS_SEUIL_MIN = 6

NO_CACHE = "--no-cache" in sys.argv

# ── Helpers ───────────────────────────────────────────────────────────────────

def cap_to_radius(cap):
    """Rayon de captation en mètres : min(3000, 300 * sqrt(cap / 2))."""
    return min(3000, 300 * math.sqrt(max(CAP_REF, cap) / CAP_REF))

def haversine_m(lon1, lat1, lon2, lat2):
    """Distance à vol d'oiseau en mètres."""
    R = 6_371_000
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = math.sin(d_lat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

def edge_speed(data):
    hw = data.get("highway", "")
    if isinstance(hw, list):
        hw = hw[0]
    return SPEED_KMH.get(hw, SPEED_DEFAULT)

def path_to_linestring(G, nodes):
    coords = [(G.nodes[n]["x"], G.nodes[n]["y"]) for n in nodes]
    if len(coords) < 2:
        # Chemin d'un seul nœud — dupliquer pour avoir une LineString valide
        coords = coords * 2
    return LineString(coords)

def dominant_highway(G, nodes):
    types = []
    for u, v in zip(nodes[:-1], nodes[1:]):
        data = G.get_edge_data(u, v, 0) or {}
        hw = data.get("highway", "")
        if isinstance(hw, list): hw = hw[0]
        if hw: types.append(hw)
    if not types:
        return "inconnu"
    # Hiérarchie : retourne le type le plus "élevé" rencontré
    priority = ["motorway","trunk","primary","secondary","tertiary",
                "unclassified","residential","service","living_street"]
    for p in priority:
        if p in types:
            return p
    return types[0]

# ── Phase 1 : Graphe OSM ─────────────────────────────────────────────────────

def load_graph():
    if not NO_CACHE and os.path.exists(CACHE_GRAPH):
        print(f"  Cache graphe : {CACHE_GRAPH}")
        with open(CACHE_GRAPH, "rb") as f:
            return pickle.load(f)

    print("  Téléchargement graphe OSMnx…")
    # bbox = (left, bottom, right, top) = (lon_min, lat_min, lon_max, lat_max)
    bbox = (
        LON_MIN - GRAPH_MARGIN, LAT_MIN - GRAPH_MARGIN,
        LON_MAX + GRAPH_MARGIN, LAT_MAX + GRAPH_MARGIN,
    )
    G = ox.graph_from_bbox(bbox, network_type="drive", simplify=True)
    # Ajouter temps de trajet comme poids
    for u, v, k, data in G.edges(keys=True, data=True):
        length = data.get("length", 50)
        speed  = edge_speed(data)
        data["travel_time"] = length / (speed * 1000 / 3600)

    os.makedirs(os.path.dirname(CACHE_GRAPH), exist_ok=True)
    with open(CACHE_GRAPH, "wb") as f:
        pickle.dump(G, f)
    print(f"  Graphe {len(G.nodes)} nœuds, {len(G.edges)} arêtes — cache : {CACHE_GRAPH}")
    return G

# ── Phase 2 : Chargement données ─────────────────────────────────────────────

def load_origins():
    with open(ORIGINS_FILE, encoding="utf-8") as f:
        gj = json.load(f)
    origins = []
    for feat in gj["features"]:
        p = feat["properties"]
        origins.append({
            "id":          p["id"],
            "lon":         p["lon_c"],
            "lat":         p["lat_c"],
            "veh_estimes": p.get("veh_estimes", 1),
            "feature":     feat,
        })
    return origins

def load_parkings():
    with open(PARKINGS_FILE, encoding="utf-8") as f:
        gj = json.load(f)
    parkings = []
    for feat in gj["features"]:
        p = feat["properties"]
        if p.get("classe_ppri") != "refuge_potentiel":
            continue
        # Centroïde
        try:
            geom = shape(feat["geometry"])
            cx, cy = geom.centroid.x, geom.centroid.y
        except Exception:
            continue
        cap = p.get("nb_vehicules_corrige") or p.get("nb_vehicules_approx") or 10
        parkings.append({
            "id":      p["id"],
            "nom":     p.get("nom", ""),
            "lon":     cx,
            "lat":     cy,
            "cap":     cap,
            "radius":  cap_to_radius(cap),
            "props":   p,
            "feature": feat,
        })
    return parkings

# ── Phase 3 : Routage ─────────────────────────────────────────────────────────

def route_pair(G, node_p, node_o):
    """Retourne (distance_m, temps_min, nodes) ou None si pas de chemin."""
    try:
        nodes = nx.shortest_path(G, node_p, node_o, weight="travel_time")
        dist  = sum(
            (G.get_edge_data(u, v, 0) or {}).get("length", 0)
            for u, v in zip(nodes[:-1], nodes[1:])
        )
        temps = sum(
            (G.get_edge_data(u, v, 0) or {}).get("travel_time", 0)
            for u, v in zip(nodes[:-1], nodes[1:])
        )
        return dist, temps / 60, nodes
    except nx.NetworkXNoPath:
        return None

# ── Phase 4 : Scoring ─────────────────────────────────────────────────────────

HIGHWAY_SCORE = {
    "motorway": 5, "trunk": 5, "primary": 4, "secondary": 3,
    "tertiary": 2, "unclassified": 1, "residential": 1, "service": 0,
}

def classe_acces(nb_orig, temps_moy, voie, ratio_cap):
    score_voie  = HIGHWAY_SCORE.get(voie, 1)
    if nb_orig == 0:
        return "non_connecte"
    if temps_moy <= 3 and score_voie >= 3:
        return "tres_accessible"
    if temps_moy <= 5 and score_voie >= 2:
        return "accessible"
    if temps_moy <= 7:
        return "acces_moyen"
    return "acces_difficile"

def saturation(demande, cap):
    if cap == 0: return 0
    r = demande / cap
    if r < 0.5:  return "sous_sollicite"
    if r <= 1.0: return "bien_dimensionne"
    return "sur_sollicite"

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("═══ Étape 2b — Routage accessibilité ═══\n")

    print("── Phase 1 : Graphe OSM ──")
    G = load_graph()
    print()

    print("── Phase 2 : Données ──")
    origins  = load_origins()
    parkings = load_parkings()
    print(f"  {len(origins)} îlots d'origine  |  {len(parkings)} parkings refuge\n")

    # Précalcul : nœud OSM le plus proche pour chaque point
    print("── Phase 3 : Routage ──")
    all_lons = [o["lon"] for o in origins] + [p["lon"] for p in parkings]
    all_lats = [o["lat"] for o in origins] + [p["lat"] for p in parkings]
    all_nodes = ox.nearest_nodes(G, all_lons, all_lats)

    n_orig = len(origins)
    origin_nodes  = {origins[i]["id"]:  all_nodes[i]           for i in range(n_orig)}
    parking_nodes = {parkings[i]["id"]: all_nodes[n_orig + i]  for i in range(len(parkings))}

    route_features = []
    parking_routes = {p["id"]: [] for p in parkings}

    total_pairs = sum(
        1 for p in parkings for o in origins
        if haversine_m(p["lon"], p["lat"], o["lon"], o["lat"]) <= p["radius"]
    )
    print(f"  Paires dans le rayon de captation : {total_pairs}")

    done = 0
    for park in parkings:
        pid    = park["id"]
        pnode  = parking_nodes[pid]
        radius = park["radius"]

        for orig in origins:
            oid  = orig["id"]
            dist_vol = haversine_m(park["lon"], park["lat"], orig["lon"], orig["lat"])
            if dist_vol > radius:
                continue

            result = route_pair(G, pnode, origin_nodes[oid])
            done  += 1
            if result is None:
                continue

            dist_m, temps_min, nodes = result
            hw = dominant_highway(G, nodes)

            route_features.append({
                "type": "Feature",
                "geometry": mapping(path_to_linestring(G, nodes)),
                "properties": {
                    "parking_id":  pid,
                    "origine_id":  oid,
                    "distance_m":  round(dist_m),
                    "temps_min":   round(temps_min, 1),
                    "voie_dom":    hw,
                    "veh_origine": orig["veh_estimes"],
                },
            })
            parking_routes[pid].append({
                "origine_id":  oid,
                "distance_m":  dist_m,
                "temps_min":   temps_min,
                "voie_dom":    hw,
                "veh_origine": orig["veh_estimes"],
            })

        if done % 20 == 0 or done == total_pairs:
            print(f"  {done}/{total_pairs} paires routées…", end="\r")

    print(f"\n  {len(route_features)} routes calculées\n")

    # ── Phase 4 : Scoring parkings ──────────────────────────────────────────
    print("── Phase 4 : Scoring parkings ──")
    out_features = []

    for park in parkings:
        pid    = park["id"]
        routes = parking_routes[pid]
        cap    = park["cap"]

        desservies = [r for r in routes if r["temps_min"] <= TEMPS_SEUIL_MIN]
        nb_orig    = len(desservies)
        demande    = sum(r["veh_origine"] for r in desservies)
        temps_moy  = (sum(r["temps_min"] for r in desservies) / nb_orig) if nb_orig else 0
        voies      = [r["voie_dom"] for r in desservies]
        voie_dom   = max(voies, key=lambda v: HIGHWAY_SCORE.get(v, 0)) if voies else "inconnu"
        ratio_cap  = round(demande / cap, 2) if cap else 0

        cl_acces = classe_acces(nb_orig, temps_moy, voie_dom, ratio_cap)
        sat      = saturation(demande, cap)

        nom = park["nom"] or pid
        print(f"  {pid:10s}  {nom[:30]:30s}  r={park['radius']:4.0f}m  "
              f"orig={nb_orig:2d}  dem={demande:4d}veh  "
              f"t={temps_moy:.1f}min  voie={voie_dom:12s}  → {cl_acces}")

        props = dict(park["props"])
        props.update({
            "rayon_captation_m":   round(park["radius"]),
            "nb_origines":         nb_orig,
            "demande_veh":         demande,
            "capacite":            cap,
            "ratio_capacite":      ratio_cap,
            "saturation":          sat,
            "temps_moyen_min":     round(temps_moy, 1),
            "voie_acces_dom":      voie_dom,
            "classe_acces":        cl_acces,
        })
        out_features.append({"type": "Feature", "geometry": park["feature"]["geometry"], "properties": props})

    # Écriture
    with open(OUT_ROUTES, "w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "features": route_features}, f, ensure_ascii=False, indent=2)
    print(f"\n✓ Routes : {OUT_ROUTES}  ({len(route_features)} trajets)")

    with open(OUT_ACCES, "w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "features": out_features}, f, ensure_ascii=False, indent=2)
    print(f"✓ Classement : {OUT_ACCES}  ({len(out_features)} parkings)")
    print("\nRelancez l'UI pour voir les nouvelles couches.")

if __name__ == "__main__":
    main()
