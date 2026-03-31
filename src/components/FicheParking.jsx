import React from 'react'
import { cleanNom } from '../utils/geo.js'
import { DEMO_CLIENT } from '../config.js'

function slugifyNom(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
}

const CLASSE_META = {
  aire_exposee: {
    label: 'Aire exposée',
    color: '#ef4444',
    bg: '#450a0a',
    icon: '⚠',
    desc: "Parking en zone PPRI d'interdiction — non mobilisable comme refuge.",
  },
  refuge_territorial: {
    label: 'Aire refuge territoriale',
    color: '#16a34a',
    bg: '#052e16',
    icon: '★★★',
    desc: "Capacité > 100 véhicules — mobilisable à l'échelle de plusieurs communes.",
  },
  refuge_communal: {
    label: 'Aire refuge communale',
    color: '#4ade80',
    bg: '#052e16',
    icon: '★★',
    desc: "Capacité 30–100 véhicules — mobilisable à l'échelle d'une commune.",
  },
  refuge_local: {
    label: 'Aire refuge locale',
    color: '#86efac',
    bg: '#052e16',
    icon: '★',
    desc: "Capacité < 30 véhicules — mobilisable à l'échelle d'un quartier.",
  },
  mobilisable_sous_conditions: {
    label: 'Aire refuge sous conditions',
    color: '#f97316',
    bg: '#431407',
    icon: '⚑',
    desc: 'Mobilisation soumise à accord préalable (foncier, usage, statut).',
  },
}

const ACCES_META = {
  tres_accessible: { label: 'Très accessible', color: '#22c55e' },
  accessible:      { label: 'Accessible',      color: '#86efac' },
  acces_moyen:     { label: 'Accès moyen',      color: '#f97316' },
  acces_difficile: { label: 'Accès difficile',  color: '#ef4444' },
  non_connecte:    { label: 'Non connecté',     color: '#64748b' },
}

const SAT_META = {
  sous_sollicite:   { label: 'Sous-sollicité',   color: '#22c55e' },
  bien_dimensionne: { label: 'Bien dimensionné', color: '#86efac' },
  sur_sollicite:    { label: 'Sur-sollicité',    color: '#ef4444' },
}

const CAT_LABELS = {
  commercial:   'Commercial',
  administratif:'Administratif',
  scolaire:     'Scolaire',
  sportif:      'Sportif',
  residentiel:  'Résidentiel',
  medical:      'Médical',
  mixte:        'Mixte',
  '':           '—',
}

const STATUT_LABELS = {
  public:   'Public',
  prive:    'Privé',
  mixte:    'Mixte',
  inconnu:  'Inconnu',
}

function Badge({ label, color, bg }) {
  return (
    <span style={{
      display: 'inline-block',
      background: bg || color + '22',
      color,
      border: `1px solid ${color}55`,
      borderRadius: 4,
      padding: '2px 8px',
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.03em',
    }}>
      {label}
    </span>
  )
}

function Row({ label, value, accent }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '3px 0', borderBottom: '1px solid #1e293b' }}>
      <span style={{ color: '#94a3b8', fontSize: 11 }}>{label}</span>
      <span style={{ color: accent || '#e2e8f0', fontSize: 12, fontWeight: 600, textAlign: 'right', maxWidth: '60%' }}>{value ?? '—'}</span>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{title}</div>
      {children}
    </div>
  )
}

const SCENARIO_LABELS = {
  t20:   'T20–40 (crue fréquente)',
  t100:  'T100 (crue de référence)',
  t1000: 'T1000 (crue exceptionnelle)',
}

export default function FicheParking({ feature, onClose, onDelete, scenario, hasCheminement, onToggleCheminement }) {
  const p = feature?.properties || {}
  const meta  = CLASSE_META[p.classe_finale] || CLASSE_META['mobilisable_sous_conditions']
  const acces = ACCES_META[p.classe_acces]
  const sat   = SAT_META[p.saturation]
  const estMobilisable = ['refuge_territorial', 'refuge_communal', 'refuge_local'].includes(p.classe_finale)

  const scenKey = scenario ? `inondable_${scenario}` : null
  const inondableDansScenario = scenKey ? !!p[scenKey] : null

  // En mode démo, si inondable dans le scénario actif → afficher "Aire exposée" plutôt que la classe structurelle
  const metaDemo = (inondableDansScenario && DEMO_CLIENT)
    ? CLASSE_META['aire_exposee']
    : meta

  const pdfSlug = `${p.id}_${slugifyNom(p.nom || '')}`
  const pdfHref = `./fiches/${pdfSlug}.pdf`

  // Nettoyage du justif_finale pour le mode démo :
  // - supprime les références PPRI structurelles (déjà contextualisé par le scénario)
  // - supprime "Pas de contre-indications"
  function cleanJustifDemo(text) {
    if (!text) return ''
    return text
      .replace(/Hors zone PPRI contraignante\.\s*/g, '')
      .replace(/Situ[eé] en zone PPRI[^.]*\.\s*/g, '')
      .replace(/[.,]?\s*[Nn]ote\s*:\s*Pas de contre-indications\.?/g, '')
      .trim()
  }

  // ── Mode démo : popup allégé ────────────────────────────────────────────
  if (DEMO_CLIENT) {
    return (
      <div className="carac-popup" style={{ minWidth: 260, maxWidth: 300 }}>
        <div className="carac-popup-header" style={{ alignItems: 'flex-start' }}>
          <div>
            <div className="carac-popup-title" style={{ lineHeight: 1.3 }}>
              {cleanNom(p.nom, p.id)}
            </div>
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{p.commune || '—'}</div>
          </div>
          <button className="carac-popup-close" onClick={onClose} style={{ flexShrink: 0, marginLeft: 8 }}>✕</button>
        </div>

        <div style={{ padding: '10px 14px 12px' }}>

          {/* Statut dans le scénario actif */}
          {inondableDansScenario !== null && (
            <div style={{
              background: inondableDansScenario ? '#450a0a' : '#052e16',
              border: `1px solid ${inondableDansScenario ? '#ef444466' : '#22c55e44'}`,
              borderRadius: 6, padding: '8px 12px', marginBottom: 8,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontSize: 18, lineHeight: 1 }}>{inondableDansScenario ? '⚠' : '✓'}</span>
              <div>
                <div style={{ color: inondableDansScenario ? '#ef4444' : '#22c55e', fontWeight: 700, fontSize: 13 }}>
                  {inondableDansScenario ? 'Aire inondable' : 'Aire de refuge'}
                </div>
                <div style={{ color: '#94a3b8', fontSize: 10, marginTop: 2 }}>
                  {SCENARIO_LABELS[scenario] || scenario}
                </div>
              </div>
            </div>
          )}

          {/* Classe finale — contextualisée au scénario */}
          <div style={{
            background: metaDemo.bg, border: `1px solid ${metaDemo.color}44`,
            borderRadius: 6, padding: '6px 10px', marginBottom: 10,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ fontSize: 16, lineHeight: 1 }}>{metaDemo.icon}</span>
            <div style={{ color: metaDemo.color, fontWeight: 700, fontSize: 12 }}>{metaDemo.label}</div>
          </div>

          {/* Capacité + accessibilité compactes */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, background: '#0f172a', borderRadius: 5, padding: '5px 8px', textAlign: 'center' }}>
              <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 15 }}>{p.capacite_retenue ?? '—'}</div>
              <div style={{ color: '#64748b', fontSize: 10 }}>places</div>
            </div>
            {p.surface_m2 && (
              <div style={{ flex: 1, background: '#0f172a', borderRadius: 5, padding: '5px 8px', textAlign: 'center' }}>
                <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 15 }}>{p.surface_m2.toLocaleString('fr-FR')}</div>
                <div style={{ color: '#64748b', fontSize: 10 }}>m²</div>
              </div>
            )}
            {inondableDansScenario ? (
              <div style={{ flex: 1, background: '#0f172a', borderRadius: 5, padding: '5px 8px', textAlign: 'center' }}>
                <div style={{ color: '#ef4444', fontWeight: 700, fontSize: 11 }}>Inaccessible</div>
                <div style={{ color: '#64748b', fontSize: 10 }}>accès</div>
              </div>
            ) : acces ? (
              <div style={{ flex: 1, background: '#0f172a', borderRadius: 5, padding: '5px 8px', textAlign: 'center' }}>
                <div style={{ color: acces.color, fontWeight: 700, fontSize: 11 }}>{acces.label}</div>
                <div style={{ color: '#64748b', fontSize: 10 }}>accès</div>
              </div>
            ) : null}
          </div>

          {/* Justification — nettoyée des références PPRI */}
          {(() => { const t = cleanJustifDemo(p.justif_finale); return t ? (
            <div style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.5, marginBottom: 10, borderTop: '1px solid #1e293b', paddingTop: 8 }}>
              {t}
            </div>
          ) : null })}

          {/* Boutons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <a
              href={pdfHref}
              download
              style={{
                display: 'block', width: '100%', padding: '6px 0', fontSize: 11,
                textAlign: 'center', cursor: 'pointer', textDecoration: 'none',
                background: 'rgba(99,102,241,0.12)', border: '1px solid #6366f166',
                borderRadius: 4, color: '#818cf8', fontWeight: 600,
                boxSizing: 'border-box',
              }}
            >
              ⬇ Télécharger la fiche
            </a>
          </div>
        </div>
      </div>
    )
  }

  // ── Mode travail : popup complet ────────────────────────────────────────
  return (
    <div className="carac-popup" style={{ minWidth: 280, maxWidth: 340 }}>
      <div className="carac-popup-header" style={{ alignItems: 'flex-start' }}>
        <div>
          <div className="carac-popup-title" style={{ lineHeight: 1.3 }}>
            {cleanNom(p.nom, p.id)}
          </div>
          <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{p.id} · {p.commune || '—'}</div>
        </div>
        <button className="carac-popup-close" onClick={onClose} style={{ flexShrink: 0, marginLeft: 8 }}>✕</button>
      </div>

      <div style={{ padding: '10px 14px 12px' }}>

      {/* Classe finale */}
      <div style={{
        background: meta.bg, border: `1px solid ${meta.color}44`,
        borderRadius: 6, padding: '8px 12px', marginBottom: 10,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 18, lineHeight: 1 }}>{meta.icon}</span>
        <div>
          <div style={{ color: meta.color, fontWeight: 700, fontSize: 13 }}>{meta.label}</div>
          <div style={{ color: '#94a3b8', fontSize: 10, marginTop: 2 }}>{meta.desc}</div>
        </div>
      </div>

      <Section title="Capacité">
        <Row label="Véhicules retenus" value={`${p.capacite_retenue ?? '—'} véhicules`} accent="#f1f5f9" />
        {p.nb_vehicules_corrige && (
          <Row label="Valeur corrigée" value={`${p.nb_vehicules_corrige} véhicules (corrigé)`} accent="#f59e0b" />
        )}
        <Row label="Surface" value={p.surface_m2 ? `${p.surface_m2.toLocaleString('fr-FR')} m²` : null} />
      </Section>

      <Section title="Foncier &amp; Usage">
        <Row label="Statut foncier"  value={STATUT_LABELS[p.statut_foncier] || p.statut_foncier || '—'} />
        <Row label="Catégorie"       value={CAT_LABELS[p.categorie] || p.categorie || '—'} />
        <Row label="Type"            value={p.type_parking || '—'} />
      </Section>

      <Section title="Exposition PPRI">
        <Row
          label="Zone brute"
          value={p.ppri_zone_brute || p.ppri_zone || '—'}
          accent={p.classe_ppri === 'exposé' ? '#ef4444' : '#86efac'}
        />
        <Row label="Classe PPRI" value={p.classe_ppri || '—'} />
        {p.justif_ppri && (
          <div style={{ fontSize: 10, color: '#64748b', marginTop: 4, fontStyle: 'italic' }}>{p.justif_ppri}</div>
        )}
      </Section>

      {estMobilisable && p.classe_acces && (
        <Section title="Accessibilité">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            {acces && <Badge label={acces.label} color={acces.color} />}
            {sat   && <Badge label={sat.label}   color={sat.color} />}
          </div>
          <Row label="Rayon captation"  value={p.rayon_captation_m ? `${p.rayon_captation_m} m` : null} />
          <Row label="Îlots desservis"  value={p.nb_origines != null ? `${p.nb_origines} îlot(s)` : null} />
          <Row label="Demande estimée"  value={p.demande_veh != null ? `${p.demande_veh} véhicules (×${p.ratio_capacite} la capacité)` : null}
               accent={p.saturation === 'sur_sollicite' ? '#ef4444' : undefined} />
          <Row label="Temps moyen"      value={p.temps_moyen_min != null ? `${p.temps_moyen_min} min` : null} />
          <Row label="Voie dominante"   value={p.voie_acces_dom || null} />
        </Section>
      )}

      {p.justif_finale && (
        <Section title="Justification">
          <div style={{ fontSize: 11, color: '#cbd5e1', lineHeight: 1.5, padding: '4px 0' }}>
            {p.justif_finale}
          </div>
        </Section>
      )}

      {p.notes && (
        <div style={{ marginTop: 8, fontSize: 10, color: '#64748b', borderTop: '1px solid #1e293b', paddingTop: 6, fontStyle: 'italic' }}>
          Note : {p.notes}
        </div>
      )}

      {hasCheminement && (
        <div style={{ marginTop: 10, borderTop: '1px solid #1e293b', paddingTop: 8 }}>
          <button
            onClick={onToggleCheminement}
            style={{
              width: '100%', padding: '6px 0', fontSize: 11, cursor: 'pointer',
              background: 'transparent', border: '1px solid #22c55e66',
              borderRadius: 4, color: '#22c55e', fontWeight: 600,
            }}
          >
            ↗ Afficher / masquer le cheminement
          </button>
        </div>
      )}

      {onDelete && (
        <div style={{ marginTop: 10, borderTop: '1px solid #1e293b', paddingTop: 8 }}>
          <button
            onClick={() => { onDelete(p.id); onClose() }}
            style={{
              width: '100%', padding: '5px 0', fontSize: 11, cursor: 'pointer',
              background: 'transparent', border: '1px solid #ef444466',
              borderRadius: 4, color: '#ef4444', fontWeight: 600,
            }}
          >
            Supprimer du classement
          </button>
        </div>
      )}

      </div>
    </div>
  )
}
