"""
generate_rapports_commune.py — Rapports PDF par commune avec analyse opérationnelle
Carte42 — Consultation 2026-03 — EPTB Vistre-Vistrenque

Usage:
    python scripts/generate_rapports_commune.py
Output: public/fiches/rapport_Manduel.pdf, public/fiches/rapport_Redessan.pdf
"""

import sys
sys.stdout.reconfigure(encoding='utf-8')

import os
import io
import re
import base64
import warnings
import unicodedata
from pathlib import Path
import requests

import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import contextily as cx
import geopandas as gpd
from pyproj import Transformer
from shapely.geometry import box as shapely_box
from shapely.ops import unary_union

from playwright.sync_api import sync_playwright

warnings.filterwarnings('ignore')

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'public' / 'data'
OUT_DIR = ROOT / 'public' / 'fiches'
LOGO_PATH = ROOT / 'public' / 'Logo client.png'
OUT_DIR.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
SCENARIO_LABELS = {'t20': 'T20–40', 't100': 'T100', 't1000': 'T1000'}
SCENARIO_FREQ   = {
    't20':   'Crue fréquente (retour 20–40 ans)',
    't100':  'Crue de référence (retour 100 ans)',
    't1000': 'Crue exceptionnelle (retour 1 000 ans)',
}
ALEA_COLORS = {'t20': '#fb923c', 't100': '#60a5fa', 't1000': '#a78bfa'}
SCENARIO_COLOR = {'t20': '#f97316', 't100': '#3b82f6', 't1000': '#7c3aed'}

TRANSFORMER_TO_3857 = Transformer.from_crs('EPSG:4326', 'EPSG:3857', always_xy=True)

# ---------------------------------------------------------------------------
# INSEE codes pour les communes de la zone démo
# ---------------------------------------------------------------------------
COMMUNE_INSEE = {
    'Manduel':  '30155',
    'Redessan': '30211',
}

# ---------------------------------------------------------------------------
# Commune assignment (reverse geocoding — Manduel + Redessan zone démo)
# ---------------------------------------------------------------------------
COMMUNES = {
    'Manduel': {
        'public': [
            'PKC_001', 'PKC_007', 'PKC_008', 'PKC_020', 'PKC_021',
            'PKC_032', 'PKC_033', 'PKC_036',
            'PKC_M_MANUAL_009', 'PKC_M_MANUAL_010', 'PKC_M_MANUAL_011',
        ],
        'prix2': [
            'PKC_009', 'PKC_017', 'PKC_022', 'PKC_023', 'PKC_025',
            'PKC_026', 'PKC_027', 'PKC_029', 'PKC_031',
            'PKC_M_MANUAL_005', 'PKC_M_MANUAL_006', 'PKC_M_MANUAL_007',
            'PKC_M_MANUAL_008', 'PKC_M_MANUAL_012',
        ],
    },
    'Redessan': {
        'public': [
            'PKC_004', 'PKC_005', 'PKC_006', 'PKC_016', 'PKC_018',
            'PKC_019', 'PKC_030',
            'PKC_M_MANUAL_002', 'PKC_M_MANUAL_003',
        ],
        'prix2': [
            'PKC_002', 'PKC_003', 'PKC_013', 'PKC_014', 'PKC_015',
            'PKC_028',
            'PKC_M_MANUAL_001', 'PKC_M_MANUAL_004',
        ],
    },
}

# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------

def slugify(text, max_len=40):
    nfkd = unicodedata.normalize('NFKD', str(text))
    s = nfkd.encode('ascii', 'ignore').decode('ascii')
    s = re.sub(r'[^a-zA-Z0-9]+', '-', s).strip('-')
    return s[:max_len]


def encode_image_b64(path):
    with open(path, 'rb') as f:
        return base64.b64encode(f.read()).decode('utf-8')


def fig_to_b64(fig):
    buf = io.BytesIO()
    fig.savefig(buf, format='png', dpi=150, bbox_inches='tight', pad_inches=0.05)
    plt.close(fig)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode('utf-8')


def cap(row):
    """Return capacite_retenue as int, 0 if missing."""
    v = row.get('capacite_retenue', None)
    if v is None or (isinstance(v, float) and np.isnan(v)):
        return 0
    return int(v)


def nom_clean(row):
    n = str(row.get('nom', '')) or str(row.get('id', ''))
    n = re.sub(r'\s*[-–]\s*(a supprimer|fermé|ferm[eé])\s*$', '', n, flags=re.IGNORECASE)
    return n.strip() or row.get('id', '—')


# ---------------------------------------------------------------------------
# Vehicle demand from zones_origine
# ---------------------------------------------------------------------------

def fetch_commune_poly(commune):
    """Fetch commune boundary polygon from geo.api.gouv.fr (EPSG:4326)."""
    from shapely.geometry import shape as shp_shape
    code = COMMUNE_INSEE.get(commune)
    if not code:
        return None
    try:
        url = f'https://geo.api.gouv.fr/communes/{code}?fields=contour'
        r = requests.get(url, timeout=15)
        r.raise_for_status()
        return shp_shape(r.json()['contour'])
    except Exception as e:
        print(f"  WARN: impossible de charger le contour de {commune} ({e})")
        return None


def get_commune_veh_inond(zones_gdf, alea_dict, commune_poly):
    """
    For each scenario, sum veh_estimes from zones_origine that:
      - have their centroid within the commune polygon (or intersect it)
      - AND intersect the aléa polygon for that scenario.

    commune_poly: Shapely geometry in EPSG:4326 (or None → use all zones)
    Returns: dict {sc: int}
    """
    if len(zones_gdf) == 0:
        return {'t20': 0, 't100': 0, 't1000': 0}

    if commune_poly is not None:
        zones_commune = zones_gdf[zones_gdf.geometry.centroid.intersects(commune_poly)].copy()
    else:
        zones_commune = zones_gdf.copy()

    result = {}
    for sc in ['t20', 't100', 't1000']:
        alea = alea_dict.get(sc, gpd.GeoDataFrame())
        if len(alea) == 0 or len(zones_commune) == 0:
            result[sc] = 0
            continue
        alea_union = unary_union(alea.to_crs('EPSG:4326').geometry.values)
        veh = 0
        for _, zone in zones_commune.iterrows():
            if zone.geometry.intersects(alea_union):
                v = zone.get('veh_estimes', 0)
                if v is not None and not (isinstance(v, float) and np.isnan(v)):
                    veh += int(v)
        result[sc] = veh
    return result


# ---------------------------------------------------------------------------
# Stats computation
# ---------------------------------------------------------------------------

def compute_stats(pub_gdf, prix2_gdf, veh_inond_by_sc):
    """
    Per scenario:
      - nb_refuges_pub / nb_inond_pub
      - cap_refuge_pub   (sum capacite_retenue of refuge parkings)
      - veh_inond_pk     (capacite_retenue of inondable public parkings — véh. déjà garés)
      - veh_inond_zones  (veh_estimes from zones_origine × aléa — véh. résidentiels)
      - veh_inond_pub    (total = veh_inond_pk + veh_inond_zones)
      - balance_pub      = cap_refuge_pub - veh_inond_pub
      - balance_total    = (cap_refuge_pub + cap_refuge_p2) - veh_inond_pub
    """
    stats = {}
    for sc in ['t20', 't100', 't1000']:
        key = f'inondable_{sc}'

        pub_inond_mask  = pub_gdf[key].fillna(False).astype(bool)
        pub_refuge      = pub_gdf[~pub_inond_mask]
        pub_inond       = pub_gdf[pub_inond_mask]

        prix2_inond_mask = prix2_gdf[key].fillna(False).astype(bool) if len(prix2_gdf) > 0 else gpd.GeoDataFrame().index.to_series().astype(bool)
        if len(prix2_gdf) > 0:
            prix2_refuge = prix2_gdf[~prix2_inond_mask]
        else:
            prix2_refuge = gpd.GeoDataFrame()

        cap_refuge_pub   = sum(cap(r) for _, r in pub_refuge.iterrows())
        veh_inond_pk     = sum(cap(r) for _, r in pub_inond.iterrows())   # véh. garés sur aires inondables
        veh_inond_zones  = veh_inond_by_sc.get(sc, 0)                     # véh. résidentiels depuis zones_origine
        veh_inond_pub    = veh_inond_pk + veh_inond_zones                 # total conservateur
        cap_refuge_p2    = sum(cap(r) for _, r in prix2_refuge.iterrows())

        balance_pub   = cap_refuge_pub - veh_inond_pub
        balance_total = (cap_refuge_pub + cap_refuge_p2) - veh_inond_pub

        # Top refuges publics par capacité (pour recommandations)
        top_refuges_pub = sorted(
            [(nom_clean(r), cap(r)) for _, r in pub_refuge.iterrows() if cap(r) > 0],
            key=lambda x: -x[1]
        )[:3]
        # Top prix2 refuges (pour complément)
        top_refuges_p2 = sorted(
            [(nom_clean(r), cap(r)) for _, r in prix2_refuge.iterrows() if cap(r) > 0],
            key=lambda x: -x[1]
        )[:3]
        # Inondables publics à évacuer
        inond_list = [(nom_clean(r), cap(r)) for _, r in pub_inond.iterrows()]

        stats[sc] = {
            'nb_refuges_pub':  len(pub_refuge),
            'nb_inond_pub':    len(pub_inond),
            'cap_refuge_pub':  cap_refuge_pub,
            'veh_inond_pk':    veh_inond_pk,
            'veh_inond_zones': veh_inond_zones,
            'veh_inond_pub':   veh_inond_pub,
            'cap_refuge_p2':   cap_refuge_p2,
            'balance_pub':     balance_pub,
            'balance_total':   balance_total,
            'top_refuges_pub': top_refuges_pub,
            'top_refuges_p2':  top_refuges_p2,
            'inond_list':      inond_list,
        }
    return stats


# ---------------------------------------------------------------------------
# Map generation
# ---------------------------------------------------------------------------

def add_north_arrow(ax):
    ax.annotate('N', xy=(0.93, 0.93), xycoords='axes fraction',
                fontsize=9, fontweight='bold', ha='center', va='bottom', color='#1e293b')
    ax.annotate('', xy=(0.93, 0.92), xycoords='axes fraction',
                xytext=(0.93, 0.81), textcoords='axes fraction',
                arrowprops=dict(arrowstyle='->', color='#1e293b', lw=1.5))


def add_scale_bar(ax, bbox_3857):
    xmin, ymin, xmax, ymax = bbox_3857
    width_m = xmax - xmin
    bar_m = 500 if width_m < 4000 else 1000
    label = f'{bar_m} m' if bar_m < 1000 else f'{bar_m // 1000} km'
    bar_frac = bar_m / width_m
    x0, y0 = 0.04, 0.06
    x1 = x0 + bar_frac
    ax.plot([x0, x1], [y0, y0], transform=ax.transAxes, color='#1e293b', lw=3, solid_capstyle='butt')
    ax.plot([x0, x0], [y0-0.01, y0+0.01], transform=ax.transAxes, color='#1e293b', lw=2)
    ax.plot([x1, x1], [y0-0.01, y0+0.01], transform=ax.transAxes, color='#1e293b', lw=2)
    ax.text((x0+x1)/2, y0+0.025, label, transform=ax.transAxes,
            fontsize=7, ha='center', va='bottom', color='#1e293b', fontweight='bold')


def map_scenario_commune(pub_gdf, prix2_gdf, alea_gdf, scenario, bbox_3857):
    alea_color = ALEA_COLORS[scenario]
    key = f'inondable_{scenario}'

    pub_3857    = pub_gdf.to_crs('EPSG:3857').copy()
    pub_refuge  = pub_3857[~pub_3857[key].fillna(False).astype(bool)]
    pub_inond   = pub_3857[pub_3857[key].fillna(False).astype(bool)]

    fig, ax = plt.subplots(1, 1, figsize=(5.5, 5.5))
    fig.subplots_adjust(left=0, right=1, top=1, bottom=0)
    ax.set_xlim(bbox_3857[0], bbox_3857[2])
    ax.set_ylim(bbox_3857[1], bbox_3857[3])

    try:
        cx.add_basemap(ax, crs='EPSG:3857', source=cx.providers.CartoDB.Positron, zoom='auto')
    except Exception:
        pass

    if alea_gdf is not None and len(alea_gdf) > 0:
        alea_gdf.to_crs('EPSG:3857').plot(
            ax=ax, facecolor=alea_color, edgecolor=alea_color, alpha=0.27, linewidth=0.5, zorder=3)

    if len(prix2_gdf) > 0:
        p2 = prix2_gdf.to_crs('EPSG:3857').copy()
        p2_refuge = p2[~p2[key].fillna(False).astype(bool)]
        p2_inond  = p2[p2[key].fillna(False).astype(bool)]
        for gdf_sub, color in [(p2_refuge, '#22c55e'), (p2_inond, '#ef4444')]:
            if len(gdf_sub) > 0:
                gdf_sub.plot(ax=ax, facecolor='none', edgecolor=color,
                             linewidth=2.0, linestyle='--', zorder=4)

    for gdf_sub, color in [(pub_refuge, '#22c55e'), (pub_inond, '#ef4444')]:
        if len(gdf_sub) > 0:
            gdf_sub.plot(ax=ax, facecolor=color, edgecolor='#1e293b',
                         linewidth=1.5, alpha=0.85, zorder=5)

    add_north_arrow(ax)
    add_scale_bar(ax, bbox_3857)
    ax.set_axis_off()
    return fig


# ---------------------------------------------------------------------------
# HTML builder
# ---------------------------------------------------------------------------

def cell_style(is_inond):
    if is_inond:
        return 'background:#fee2e2;color:#b91c1c;font-weight:700;text-align:center;'
    return 'background:#dcfce7;color:#15803d;font-weight:700;text-align:center;'


def parking_rows_html(gdf):
    rows = []
    for _, row in gdf.iterrows():
        nom = nom_clean(row)
        cap_val = cap(row)
        cap_str = str(cap_val) if cap_val > 0 else '—'
        tds = ''
        for sc in ['t20', 't100', 't1000']:
            val = bool(row.get(f'inondable_{sc}', False))
            tds += f'<td style="{cell_style(val)}">{"Inondable" if val else "Refuge"}</td>'
        rows.append(f'<tr><td>{nom}</td><td style="text-align:center;">{cap_str}</td>{tds}</tr>')
    return '\n'.join(rows)


def reco_html(sc, s):
    color = SCENARIO_COLOR[sc]
    label = SCENARIO_LABELS[sc]
    freq  = SCENARIO_FREQ[sc]

    # Situation
    if s['nb_inond_pub'] == 0 and s['veh_inond_zones'] == 0:
        situation = (
            f"Aucune aire publique inondable dans ce scénario. "
            f"Les {s['nb_refuges_pub']} aires publiques ({s['cap_refuge_pub']} places) "
            f"restent mobilisables comme refuges."
        )
        niveau = 'vert'
    else:
        # Décomposition : véh. garés sur aires inondables + véh. résidentiels
        detail_parts = []
        if s['veh_inond_pk'] > 0:
            detail_parts.append(
                f"{s['veh_inond_pk']} véh. garés sur {s['nb_inond_pub']} aire{'s' if s['nb_inond_pub']>1 else ''} inondable{'s' if s['nb_inond_pub']>1 else ''}"
            )
        if s['veh_inond_zones'] > 0:
            detail_parts.append(f"{s['veh_inond_zones']} véh. en zone résidentielle inondée")
        detail_str = ' + '.join(detail_parts) if detail_parts else f"{s['veh_inond_pub']} véhicules"
        situation = (
            f"<strong>{s['veh_inond_pub']} véhicules à évacuer</strong> "
            f"({detail_str}). "
            f"{s['nb_refuges_pub']} aire{'s' if s['nb_refuges_pub']>1 else ''} refuge "
            f"avec <strong>{s['cap_refuge_pub']} places disponibles</strong>."
        )
        niveau = 'orange' if s['balance_pub'] >= 0 else 'rouge'

    # Bilan capacité
    if s['nb_inond_pub'] == 0:
        bilan = f"Capacité de refuge largement suffisante — aucune évacuation nécessaire."
        bilan_color = '#15803d'
        bilan_bg = '#dcfce7'
    elif s['balance_pub'] >= 0:
        bilan = (
            f"Capacité publique suffisante : {s['cap_refuge_pub']} places refuge "
            f"pour {s['veh_inond_pub']} véhicules à évacuer "
            f"(excédent : {s['balance_pub']} places)."
        )
        bilan_color = '#15803d'
        bilan_bg = '#dcfce7'
    else:
        deficit = abs(s['balance_pub'])
        with_p2 = s['balance_total']
        if with_p2 >= 0:
            bilan = (
                f"Déficit de {deficit} places en aires publiques seules. "
                f"Avec les aires mobilisables Prix 2 ({s['cap_refuge_p2']} places refuge supplémentaires) : "
                f"bilan équilibré (excédent {with_p2} places)."
            )
            bilan_color = '#92400e'
            bilan_bg = '#fff7ed'
        else:
            bilan = (
                f"Déficit de {deficit} places (publiques seules). "
                f"Même avec les aires Prix 2, déficit résiduel de {abs(with_p2)} places. "
                f"Prévoir reports sur communes voisines."
            )
            bilan_color = '#b91c1c'
            bilan_bg = '#fee2e2'

    # Recommandations opérationnelles
    recos = []
    if s['inond_list']:
        aires_inond = ', '.join(f"{n} ({c} veh.)" for n, c in s['inond_list']) if s['inond_list'] else '—'
        recos.append(f"<li><strong>Évacuer en priorité :</strong> {aires_inond}.</li>")
    if s['top_refuges_pub']:
        aires_refuge = ', '.join(f"{n} ({c} places)" for n, c in s['top_refuges_pub'])
        recos.append(f"<li><strong>Rediriger vers :</strong> {aires_refuge}.</li>")
    if s['balance_pub'] < 0 and s['top_refuges_p2']:
        p2_str = ', '.join(f"{n} ({c} places)" for n, c in s['top_refuges_p2'])
        recos.append(f"<li><strong>Activer aires Prix 2 :</strong> {p2_str} (sous convention préalable).</li>")
    if not recos:
        recos.append("<li>Maintenir la surveillance. Aucune action d'évacuation requise pour ce scénario.</li>")

    recos_html = '\n'.join(recos)

    return f"""
<div style="border:1px solid {color}44;border-radius:6px;margin-bottom:12px;overflow:hidden;">
  <div style="background:{color}18;padding:7px 12px;border-bottom:1px solid {color}33;
              display:flex;align-items:baseline;gap:10px;">
    <span style="font-size:13px;font-weight:700;color:{color};">{label}</span>
    <span style="font-size:11px;color:#64748b;">{freq}</span>
  </div>
  <div style="padding:10px 12px;">
    <p style="font-size:11px;margin-bottom:8px;line-height:1.5;">{situation}</p>
    <div style="background:{bilan_bg};border-left:3px solid {bilan_color};
                padding:6px 10px;margin-bottom:8px;font-size:11px;color:{bilan_color};
                border-radius:0 4px 4px 0;">
      {bilan}
    </div>
    <div style="font-size:11px;font-weight:600;color:#1e3a5f;margin-bottom:4px;">
      Recommandations opérationnelles
    </div>
    <ul style="font-size:11px;line-height:1.6;padding-left:16px;color:#1e293b;">
      {recos_html}
    </ul>
  </div>
</div>"""


def build_html(commune, pub_gdf, prix2_gdf, stats, maps_b64, logo_b64):
    logo_tag = (
        f'<img src="data:image/png;base64,{logo_b64}" alt="Logo" style="height:52px;margin-right:16px;">'
        if logo_b64 else ''
    )

    # ── Page 1 : synthèse + cartes ──────────────────────────────────────────
    total_cap_pub   = sum(cap(r) for _, r in pub_gdf.iterrows())
    total_cap_prix2 = sum(cap(r) for _, r in prix2_gdf.iterrows())

    stats_rows = ''
    for sc in ['t20', 't100', 't1000']:
        s = stats[sc]
        color = SCENARIO_COLOR[sc]
        bal = s['balance_pub']
        bal_str = f'+{bal}' if bal >= 0 else str(bal)
        bal_style = 'color:#15803d;font-weight:700;' if bal >= 0 else 'color:#b91c1c;font-weight:700;'
        stats_rows += f"""
        <tr>
          <td style="padding:6px 12px;font-weight:700;color:{color};">{SCENARIO_LABELS[sc]}</td>
          <td style="padding:6px 8px;text-align:center;">{s['nb_refuges_pub']} aires</td>
          <td style="padding:6px 8px;text-align:center;font-weight:700;color:#15803d;">{s['cap_refuge_pub']}</td>
          <td style="padding:6px 8px;text-align:center;">{s['nb_inond_pub']} aires</td>
          <td style="padding:6px 8px;text-align:center;font-weight:700;color:#b91c1c;">{s['veh_inond_pub']}</td>
          <td style="padding:6px 8px;text-align:center;{bal_style}">{bal_str}</td>
        </tr>"""

    maps_html = ''
    for sc in ['t20', 't100', 't1000']:
        color = SCENARIO_COLOR[sc]
        maps_html += f"""
        <div style="display:flex;flex-direction:column;align-items:center;flex:1;min-width:0;">
          <div style="font-size:11px;font-weight:700;color:{color};margin-bottom:4px;">
            {SCENARIO_LABELS[sc]} — {SCENARIO_FREQ[sc].split('(')[0].strip()}
          </div>
          <img src="data:image/png;base64,{maps_b64[sc]}"
               style="width:100%;border-radius:6px;border:1px solid #e2e8f0;" alt="Carte {SCENARIO_LABELS[sc]}">
        </div>"""

    # ── Page 2 : analyse par scénario ───────────────────────────────────────
    recos_html = ''.join(reco_html(sc, stats[sc]) for sc in ['t20', 't100', 't1000'])

    # ── Page 3 : tableaux détaillés ─────────────────────────────────────────
    pub_rows   = parking_rows_html(pub_gdf)
    prix2_rows = parking_rows_html(prix2_gdf)

    header = f"""
  <div style="display:flex;align-items:center;border-bottom:2px solid #1e3a5f;padding-bottom:10px;margin-bottom:12px;">
    {logo_tag}
    <div>
      <div style="font-size:16px;font-weight:700;color:#1e3a5f;">
        Rapport par commune — {commune} — Consultation 2026-03
      </div>
      <div style="font-size:11px;color:#64748b;margin-top:2px;">
        Analyse des aires de stationnement au regard du risque inondation · EPTB Vistre-Vistrenque
      </div>
    </div>
  </div>
  <div style="background:#fff7ed;border:1px solid #fdba74;border-radius:5px;
              padding:7px 10px;font-size:10px;color:#92400e;font-style:italic;margin-bottom:14px;">
    ⚠ Résultats établis à des fins de démonstration — ne constituent pas des résultats finaux
    ni des recommandations opérationnelles validées à ce stade de la consultation.
  </div>"""

    section = lambda t: f'<div style="font-size:13px;font-weight:700;color:#1e3a5f;margin:14px 0 6px;border-left:3px solid #1e3a5f;padding-left:8px;">{t}</div>'

    legende = """
  <div style="display:flex;gap:16px;margin-top:8px;font-size:10px;align-items:center;flex-wrap:wrap;">
    <span style="display:flex;align-items:center;gap:5px;">
      <span style="display:inline-block;width:14px;height:14px;background:#22c55e;border:1px solid #1e293b;border-radius:2px;"></span> Refuge (public)
    </span>
    <span style="display:flex;align-items:center;gap:5px;">
      <span style="display:inline-block;width:14px;height:14px;background:#ef4444;border:1px solid #1e293b;border-radius:2px;"></span> Inondable (public)
    </span>
    <span style="display:flex;align-items:center;gap:5px;">
      <span style="display:inline-block;width:14px;height:14px;background:none;border:2px dashed #22c55e;border-radius:2px;"></span> Refuge (Prix 2)
    </span>
    <span style="display:flex;align-items:center;gap:5px;">
      <span style="display:inline-block;width:14px;height:14px;background:none;border:2px dashed #ef4444;border-radius:2px;"></span> Inondable (Prix 2)
    </span>
  </div>"""

    table_style = """
    table.parkings { width:100%; border-collapse:collapse; font-size:11px; margin-bottom:14px; }
    table.parkings th { background:#1e3a5f; color:white; padding:5px 8px; text-align:left; }
    table.parkings td { padding:4px 8px; border-bottom:1px solid #f1f5f9; }
    table.parkings tr:nth-child(even) td { background:#f8fafc; }
    table.stats { border-collapse:collapse; margin-bottom:14px; font-size:11px; width:100%; }
    table.stats th { background:#1e3a5f; color:white; padding:6px 10px; text-align:center; }
    table.stats td { border:1px solid #e2e8f0; }"""

    html = f"""<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <style>
    @media print {{ @page {{ size: A4; margin: 15mm 12mm; }} .page-break {{ page-break-after: always; }} }}
    * {{ box-sizing:border-box; margin:0; padding:0; }}
    body {{ font-family:'Segoe UI',Arial,sans-serif; font-size:12px; color:#1e293b; background:white; }}
    {table_style}
  </style>
</head>
<body>

<!-- PAGE 1 : Synthèse + cartes -->
<div>
  {header}

  {section(f'Synthèse capacités — {len(pub_gdf)} aires publiques ({total_cap_pub} places) · {len(prix2_gdf)} aires mobilisables Prix 2 ({total_cap_prix2} places)')}
  <table class="stats">
    <thead>
      <tr>
        <th>Scénario</th>
        <th>Aires refuge</th>
        <th>Places refuge</th>
        <th>Aires inondables</th>
        <th>Véhicules à évacuer</th>
        <th>Bilan capacité</th>
      </tr>
    </thead>
    <tbody>{stats_rows}</tbody>
  </table>

  {section('Cartes de scénario')}
  <div style="display:flex;gap:10px;margin-top:8px;">{maps_html}</div>
  {legende}
</div>

<div class="page-break"></div>

<!-- PAGE 2 : Analyse par scénario & recommandations -->
<div>
  {header}
  {section('Analyse par scénario et recommandations opérationnelles')}
  {recos_html}
  <div style="text-align:center;font-size:10px;color:#94a3b8;margin-top:16px;
              border-top:1px solid #e2e8f0;padding-top:6px;">
    Carte42 — Consultation 2026-03 — EPTB Vistre-Vistrenque · page 2/3
  </div>
</div>

<div class="page-break"></div>

<!-- PAGE 3 : Tableaux détaillés -->
<div>
  {header}

  {section(f'Aires publiques ({len(pub_gdf)} — {total_cap_pub} places au total)')}
  <table class="parkings">
    <thead>
      <tr>
        <th>Nom</th>
        <th style="text-align:center;">Capacité</th>
        <th style="text-align:center;">T20–40</th>
        <th style="text-align:center;">T100</th>
        <th style="text-align:center;">T1000</th>
      </tr>
    </thead>
    <tbody>{pub_rows}</tbody>
  </table>

  {section(f'Aires mobilisables Prix 2 ({len(prix2_gdf)} — {total_cap_prix2} places au total)')}
  <table class="parkings">
    <thead>
      <tr>
        <th>Nom</th>
        <th style="text-align:center;">Capacité</th>
        <th style="text-align:center;">T20–40</th>
        <th style="text-align:center;">T100</th>
        <th style="text-align:center;">T1000</th>
      </tr>
    </thead>
    <tbody>{prix2_rows}</tbody>
  </table>

  <div style="text-align:center;font-size:10px;color:#94a3b8;margin-top:16px;
              border-top:1px solid #e2e8f0;padding-top:6px;">
    Carte42 — Consultation 2026-03 — EPTB Vistre-Vistrenque · page 3/3
  </div>
</div>

</body>
</html>"""
    return html


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------

def load_data():
    print("Chargement des données...")
    all_parkings = gpd.read_file(DATA / 'classement_final.geojson')
    alea = {}
    for sc in ['t20', 't100', 't1000']:
        try:
            alea[sc] = gpd.read_file(DATA / 'alea' / f'alea_{sc}.geojson')
        except Exception:
            alea[sc] = gpd.GeoDataFrame()
    zones_origine_path = DATA / 'zones_origine.geojson'
    if zones_origine_path.exists():
        zones_origine = gpd.read_file(zones_origine_path)
        if zones_origine.crs is None:
            zones_origine = zones_origine.set_crs('EPSG:4326')
        else:
            zones_origine = zones_origine.to_crs('EPSG:4326')
        print(f"  zones_origine : {len(zones_origine)} zones")
    else:
        print("  WARN: zones_origine.geojson introuvable")
        zones_origine = gpd.GeoDataFrame(columns=['geometry', 'veh_estimes'], geometry='geometry', crs='EPSG:4326')
    logo_b64 = encode_image_b64(LOGO_PATH) if LOGO_PATH.exists() else ''
    return all_parkings, alea, zones_origine, logo_b64


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    all_parkings, alea, zones_origine, logo_b64 = load_data()
    html_jobs = []

    for commune, ids in COMMUNES.items():
        print(f"\nTraitement commune : {commune}")

        pub_gdf   = all_parkings[all_parkings['id'].isin(ids['public'])].copy()
        prix2_gdf = all_parkings[all_parkings['id'].isin(ids['prix2'])].copy()

        if len(pub_gdf) == 0:
            print(f"  Aucun parking public — ignoré.")
            continue

        print(f"  {len(pub_gdf)} publics ({sum(cap(r) for _,r in pub_gdf.iterrows())} places), "
              f"{len(prix2_gdf)} prix2 ({sum(cap(r) for _,r in prix2_gdf.iterrows())} places)")

        # Polygone commune depuis geo.api.gouv.fr
        commune_poly = fetch_commune_poly(commune)

        # Bbox commune en EPSG:4326 pour cartes
        combined_4326 = gpd.GeoDataFrame(
            gpd.pd.concat([pub_gdf, prix2_gdf] if len(prix2_gdf) > 0 else [pub_gdf],
                          ignore_index=True), crs='EPSG:4326'
        )

        # Demande véhiculaire réelle depuis zones_origine × aléa × commune
        veh_inond_by_sc = get_commune_veh_inond(zones_origine, alea, commune_poly)
        for sc in ['t20', 't100', 't1000']:
            print(f"  veh_inond_{sc} = {veh_inond_by_sc[sc]} véh. (zones_origine × aléa)")

        # Bbox commune en EPSG:3857 pour cartes
        combined_3857 = combined_4326.to_crs('EPSG:3857')
        b = combined_3857.total_bounds
        buf = 500
        bbox_3857 = (b[0]-buf, b[1]-buf, b[2]+buf, b[3]+buf)

        # Cartes
        maps_b64 = {}
        for sc in ['t20', 't100', 't1000']:
            print(f"    carte {sc}...")
            fig = map_scenario_commune(
                pub_gdf,
                prix2_gdf if len(prix2_gdf) > 0 else gpd.GeoDataFrame(crs='EPSG:4326'),
                alea.get(sc, gpd.GeoDataFrame()),
                sc, bbox_3857,
            )
            maps_b64[sc] = fig_to_b64(fig)

        stats = compute_stats(pub_gdf, prix2_gdf, veh_inond_by_sc)
        html  = build_html(commune, pub_gdf, prix2_gdf, stats, maps_b64, logo_b64)
        html_jobs.append((commune, html))

    print(f"\nConversion PDF via Playwright Chromium ({len(html_jobs)} rapports)...")
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        page    = browser.new_page()
        for commune, html_str in html_jobs:
            out_path = OUT_DIR / f'rapport_{commune}.pdf'
            tmp_html = OUT_DIR / f'_tmp_rapport_{slugify(commune)}.html'
            tmp_html.write_text(html_str, encoding='utf-8')
            page.goto(tmp_html.as_uri())
            page.wait_for_load_state('networkidle')
            page.pdf(path=str(out_path), format='A4', print_background=True,
                     margin={'top':'15mm','bottom':'15mm','left':'12mm','right':'12mm'})
            tmp_html.unlink()
            print(f"  OK  {out_path.name}")
        browser.close()

    print(f"\nGénération terminée. {len(html_jobs)} rapports dans public/fiches/")


if __name__ == '__main__':
    main()
