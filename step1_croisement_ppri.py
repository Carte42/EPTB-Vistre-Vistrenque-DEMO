"""
Étape 1 — Croisement PPRI
Pour chaque parking de parkings_caracterises.geojson, interroge le WMS
Géorisques (GetFeatureInfo sur PPRN_ZONE_INOND) et classe le parking :

  "exposé"            → Interdiction / Interdiction stricte
  "a_analyser"        → Prescriptions (à requalifier manuellement dans l'UI)
  "refuge_potentiel"  → Hors zone PPRI

Produit : public/data/classement_ppri.geojson

Usage :
  python step1_croisement_ppri.py
"""
import json, sys, time, requests
from shapely.geometry import shape

sys.stdout.reconfigure(encoding='utf-8')

PARKINGS_IN = "public/data/parkings_caracterises.geojson"
OUT         = "public/data/classement_ppri.geojson"

WMS_URL     = "https://mapsref.brgm.fr/wxs/georisques/risques"
WMS_LAYER   = "PPRN_ZONE_INOND"

# Mapping libelle_reglement_standardise → classe
CLASSE_MAP = [
    ("interdiction stricte", "exposé"),
    ("interdiction",         "exposé"),
    ("prescription",         "a_analyser"),
    ("surveillance",         "refuge_potentiel"),
]
CLASSE_HORS_ZONE = "refuge_potentiel"

JUSTIF = {
    "exposé":           "En zone PPRI d'interdiction — parking exposé, non mobilisable",
    "a_analyser":       "En zone PPRI de prescription — à analyser finement avant classement refuge",
    "refuge_potentiel": "Hors zone PPRI contraignante — candidat refuge potentiel",
}

# ── Helpers ───────────────────────────────────────────────────────────────────

def label_to_classe(label: str) -> str:
    low = label.lower().strip()
    for substr, classe in CLASSE_MAP:
        if substr in low:
            return classe
    return CLASSE_HORS_ZONE

def get_centroid(geometry: dict):
    """Retourne (lon, lat) du centroïde."""
    try:
        geom = shape(geometry)
        c = geom.centroid
        return c.x, c.y
    except Exception:
        t = geometry.get("type", "")
        coords = geometry.get("coordinates", [])
        if t == "Point":
            return coords[0], coords[1]
        if t == "Polygon" and coords:
            ring = coords[0]
            lon = sum(p[0] for p in ring) / len(ring)
            lat = sum(p[1] for p in ring) / len(ring)
            return lon, lat
    return None, None

def query_ppri(lon: float, lat: float, retries=2) -> tuple:
    """
    Interroge le WMS GetFeatureInfo au point (lon, lat).
    Retourne (libelle_brut, classe).
    """
    delta = 0.0005  # ~50 m
    bbox  = f"{lon-delta},{lat-delta},{lon+delta},{lat+delta}"

    params = {
        "SERVICE":      "WMS",
        "VERSION":      "1.1.1",
        "REQUEST":      "GetFeatureInfo",
        "LAYERS":       WMS_LAYER,
        "QUERY_LAYERS": WMS_LAYER,
        "STYLES":       "",
        "BBOX":         bbox,
        "WIDTH":        "101",
        "HEIGHT":       "101",
        "SRS":          "EPSG:4326",
        "X":            "50",
        "Y":            "50",
        "INFO_FORMAT":  "text/plain",
        "FEATURE_COUNT": "5",
    }

    for attempt in range(retries + 1):
        try:
            r = requests.get(WMS_URL, params=params, timeout=15)
            r.raise_for_status()
            text = r.text

            # Parser le texte retourné
            libelle = ""
            for line in text.splitlines():
                if "libelle_reglement_standardise" in line.lower():
                    parts = line.split("=", 1)
                    if len(parts) == 2:
                        libelle = parts[1].strip().strip("'\"")
                        break

            if libelle:
                return libelle, label_to_classe(libelle)

            # Aucun résultat = hors zone
            if "Feature" not in text and "feature" not in text:
                return "hors_zone", CLASSE_HORS_ZONE

            # Résultat sans libelle_reglement_standardise utile
            return "hors_zone", CLASSE_HORS_ZONE

        except Exception as e:
            if attempt < retries:
                time.sleep(2)
            else:
                print(f"    Erreur WMS : {e}")
                return "erreur", CLASSE_HORS_ZONE

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    with open(PARKINGS_IN, encoding="utf-8") as f:
        parkings_gj = json.load(f)
    parkings = parkings_gj.get("features", [])
    print(f"Parkings chargés : {len(parkings)}")
    print(f"Interrogation WMS PPRI en cours ({len(parkings)} requêtes)…\n")

    stats  = {"exposé": 0, "a_analyser": 0, "refuge_potentiel": 0}
    out_features = []

    for i, parking in enumerate(parkings):
        props = dict(parking.get("properties", {}))
        nom   = props.get("nom") or props.get("id") or f"#{i+1}"

        lon, lat = get_centroid(parking["geometry"])
        if lon is None:
            print(f"  [{i+1:2d}] {nom[:40]} — géométrie invalide, ignoré")
            props["ppri_zone_brute"] = "erreur_geom"
            props["classe_ppri"]     = CLASSE_HORS_ZONE
            props["justif_ppri"]     = JUSTIF[CLASSE_HORS_ZONE]
        else:
            libelle, classe = query_ppri(lon, lat)
            props["ppri_zone_brute"] = libelle
            props["classe_ppri"]     = classe
            props["justif_ppri"]     = JUSTIF[classe]
            classe_label = {"exposé": "🔴 EXPOSÉ", "a_analyser": "🟠 PRESCRIPTION", "refuge_potentiel": "🟢 refuge"}.get(classe, classe)
            print(f"  [{i+1:2d}] {nom[:38]:38s}  {libelle:30s}  {classe_label}")

        stats[props["classe_ppri"]] += 1
        out_features.append({
            "type":       "Feature",
            "geometry":   parking["geometry"],
            "properties": props,
        })

        # Pause légère pour ne pas surcharger le serveur
        if i < len(parkings) - 1:
            time.sleep(0.3)

    print(f"\n── Résultat ──────────────────────────────────────")
    print(f"  🔴 Exposés            : {stats['exposé']}")
    print(f"  🟠 À analyser (prescr): {stats['a_analyser']}")
    print(f"  🟢 Refuges potentiels : {stats['refuge_potentiel']}")

    out_gj = {"type": "FeatureCollection", "features": out_features}
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out_gj, f, ensure_ascii=False, indent=2)
    print(f"\n✓ Écrit : {OUT}  ({len(out_features)} features)")
    print("Rechargez l'UI — activez 'Étape 1 — PPRI' dans la toolbar.")

if __name__ == "__main__":
    main()
