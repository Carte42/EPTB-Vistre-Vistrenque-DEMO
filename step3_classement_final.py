"""
Étape 3 — Classement final

Fusionne PPRI (step1) + accessibilité (step2) et produit la classification
définitive de chaque parking :

  aire_exposee             → Zone PPRI interdiction (non mobilisable)
  refuge_territorial       → Mobilisable, > 100 veh, échelle multi-communes
  refuge_communal          → Mobilisable, 30–100 veh, échelle commune
  refuge_local             → Mobilisable, < 30 veh, échelle quartier
  mobilisable_sous_conditions → Accès contraint (privé, scolaire, résidentiel fermé…)

Output : public/data/classement_final.geojson

Usage :
  python step3_classement_final.py
"""
import json, sys
sys.stdout.reconfigure(encoding='utf-8')

PPRI_FILE  = "public/data/classement_ppri.geojson"
ACCES_FILE = "public/data/classement_accessibilite.geojson"
OUT        = "public/data/classement_final.geojson"

# ── Correction manuelle capacité ──────────────────────────────────────────────
# PKC_012 Parking Longue Durée : nb_vehicules_approx erroné (1070 → 700)
CAPACITE_OVERRIDES = {
    "PKC_012": 700,
}

# ── Seuils mobilisation ───────────────────────────────────────────────────────
CAP_LOCAL      = 30    # < 30 veh  → local
CAP_COMMUNAL   = 100   # 30–100    → communal
                       # > 100     → territorial

# ── Règles "mobilisable sous conditions" ─────────────────────────────────────
def is_sous_conditions(p):
    nom    = (p.get("nom")   or "").lower()
    notes  = (p.get("notes") or "").lower()
    statut = p.get("statut_foncier", "")
    cat    = p.get("categorie", "")
    tpark  = p.get("type_parking", "")

    # Flag explicite posé lors de la caractérisation
    if "a supprimer" in nom or "a supprimer" in notes:
        return True, "Parking signalé comme privé / non pertinent lors de la caractérisation"

    # Foncier public → toujours mobilisable (court-circuite toutes les autres règles)
    if statut == "public":
        return False, ""

    # Foncier privé
    if statut == "prive":
        return True, "Statut foncier privé — accès non garanti sans accord du propriétaire"

    # Parcelle privée
    if tpark == "parcelle_privee":
        return True, "Parcelle privée — mobilisation sous réserve d'accord foncier"

    # Scolaire (accès restreint hors temps scolaire sans délégation)
    if cat == "scolaire":
        return True, "Usage scolaire — mobilisation soumise à autorisation de la collectivité"

    # Résidentiel mixte (copropriété, accès incertain)
    if statut == "mixte" and cat in ("residentiel", ""):
        return True, "Foncier mixte à usage résidentiel — accès non garanti en situation de crise"

    return False, ""

# ── Niveau de mobilisation ────────────────────────────────────────────────────
def niveau_mobilisation(cap):
    if cap < CAP_LOCAL:
        return "refuge_local", "local", f"{cap} véhicules — mobilisable à l'échelle d'un quartier"
    if cap <= CAP_COMMUNAL:
        return "refuge_communal", "communal", f"{cap} véhicules — mobilisable à l'échelle d'une commune"
    return "refuge_territorial", "territorial", f"{cap} véhicules — mobilisable sur un territoire de plusieurs communes"

# ── Libellés affichage ────────────────────────────────────────────────────────
CLASSE_LABELS = {
    "aire_exposee":               "Aire exposée",
    "refuge_territorial":         "Refuge territorial",
    "refuge_communal":            "Refuge communal",
    "refuge_local":               "Refuge local",
    "mobilisable_sous_conditions":"Mobilisable sous conditions",
}

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    with open(PPRI_FILE, encoding="utf-8") as f:
        ppri_gj = json.load(f)
    with open(ACCES_FILE, encoding="utf-8") as f:
        acces_gj = json.load(f)

    # Index accessibilité par id
    acces_idx = {feat["properties"]["id"]: feat["properties"]
                 for feat in acces_gj["features"]}

    stats = {k: 0 for k in CLASSE_LABELS}
    out_features = []

    for feat in ppri_gj["features"]:
        p    = dict(feat["properties"])
        pid  = p["id"]

        # Correction capacité
        if pid in CAPACITE_OVERRIDES:
            p["nb_vehicules_corrige"] = CAPACITE_OVERRIDES[pid]
            print(f"  Correction capacité {pid} : {CAPACITE_OVERRIDES[pid]} veh")

        cap = p.get("nb_vehicules_corrige") or p.get("nb_vehicules_approx") or 10

        # Fusionner données accessibilité si disponibles
        if pid in acces_idx:
            acces = acces_idx[pid]
            p["rayon_captation_m"] = acces.get("rayon_captation_m")
            p["nb_origines"]       = acces.get("nb_origines")
            p["demande_veh"]       = acces.get("demande_veh")
            p["ratio_capacite"]    = acces.get("ratio_capacite")
            p["saturation"]        = acces.get("saturation")
            p["temps_moyen_min"]   = acces.get("temps_moyen_min")
            p["voie_acces_dom"]    = acces.get("voie_acces_dom")
            p["classe_acces"]      = acces.get("classe_acces")

        # ── Classement ────────────────────────────────────────────────────────
        if p.get("classe_ppri") == "exposé":
            classe        = "aire_exposee"
            justif_finale = (
                f"Situé en zone PPRI d'interdiction ({p.get('ppri_zone_brute', '—')}) — "
                "parking exposé aux crues, non mobilisable comme refuge."
            )
            p["niveau"] = None
        else:
            sous_cond, raison_sc = is_sous_conditions(p)
            if sous_cond:
                classe        = "mobilisable_sous_conditions"
                justif_finale = raison_sc
                p["niveau"]   = None
            else:
                classe, niveau, raison_niv = niveau_mobilisation(cap)
                p["niveau"]   = niveau
                justif_finale = (
                    f"Hors zone PPRI contraignante. {raison_niv}. "
                    + (f"Accès depuis {p.get('nb_origines', '—')} îlot(s) en {p.get('temps_moyen_min', '—')} min en moyenne." if p.get("nb_origines") else "")
                )
                if p.get("justif_manuelle"):
                    justif_finale += f" Note : {p['justif_manuelle']}"

        stats[classe] += 1
        p["classe_finale"]  = classe
        p["classe_label"]   = CLASSE_LABELS[classe]
        p["capacite_retenue"] = cap
        p["justif_finale"]  = justif_finale

        nom = p.get("nom") or pid
        print(f"  {pid:20s} {nom[:35]:35s} {cap:4d} veh  → {classe}")

        out_features.append({"type": "Feature", "geometry": feat["geometry"], "properties": p})

    print(f"\n── Résultat ──")
    for k, label in CLASSE_LABELS.items():
        print(f"  {label:35s}: {stats[k]}")

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "features": out_features}, f,
                  ensure_ascii=False, indent=2)
    print(f"\n✓ Écrit : {OUT}  ({len(out_features)} parkings)")

if __name__ == "__main__":
    main()
