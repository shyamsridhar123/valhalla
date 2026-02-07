import { useEffect, useState, useMemo } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { colors, fonts, radius } from '../theme';

// ---- tiny OpenAPI types (just enough to render) ----
interface OAParam { name: string; in: string; required?: boolean; description?: string; schema?: { type: string } }
interface OABody { required?: boolean; content?: Record<string, { schema?: Record<string, unknown> }> }
interface OAResp { description: string; content?: Record<string, { schema?: Record<string, unknown> }> }
interface OAOp {
  tags?: string[];
  summary?: string;
  description?: string;
  parameters?: OAParam[];
  requestBody?: OABody;
  responses?: Record<string, OAResp>;
}
interface OASpec {
  info: { title: string; description: string; version: string };
  tags?: { name: string; description: string }[];
  paths: Record<string, Record<string, OAOp>>;
  components?: { schemas?: Record<string, unknown> };
}

const METHOD_COLOR: Record<string, string> = {
  get: '#61affe',
  post: '#49cc90',
  put: '#fca130',
  delete: '#f93e3e',
  patch: '#50e3c2',
};

// ---- component ----
export function ApiDocs({ onClose }: { onClose: () => void }) {
  const [spec, setSpec] = useState<OASpec | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [expandedOp, setExpandedOp] = useState<string | null>(null);
  const [filterTag, setFilterTag] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/docs')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setSpec)
      .catch((e) => setErr(e.message));
  }, []);

  // group operations by tag
  const grouped = useMemo(() => {
    if (!spec) return {};
    const map: Record<string, { method: string; path: string; op: OAOp }[]> = {};
    for (const [path, methods] of Object.entries(spec.paths)) {
      for (const [method, op] of Object.entries(methods)) {
        const tag = op.tags?.[0] ?? 'Other';
        if (!map[tag]) map[tag] = [];
        map[tag].push({ method, path, op });
      }
    }
    return map;
  }, [spec]);

  const visibleTags = filterTag ? [filterTag] : Object.keys(grouped);

  return (
    <AnimatePresence>
      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', justifyContent: 'center', alignItems: 'start', paddingTop: 48,
        }}
      >
        <m.div
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 24, opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '90vw', maxWidth: 960, maxHeight: 'calc(100vh - 96px)',
            background: colors.surface1, border: `1px solid ${colors.borderStrong}`,
            borderRadius: radius.lg, display: 'flex', flexDirection: 'column',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          }}
        >
          {/* ---- header ---- */}
          <div style={{
            padding: '16px 24px', borderBottom: `1px solid ${colors.borderDefault}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: colors.textPrimary }}>
                {spec?.info.title ?? 'API Reference'}
              </h2>
              {spec && (
                <span style={{ fontSize: 12, color: colors.textDim }}>
                  v{spec.info.version} — {spec.info.description}
                </span>
              )}
            </div>
            <button onClick={onClose} style={closeBtnStyle}>✕</button>
          </div>

          {/* ---- tag filter pills ---- */}
          {spec && (
            <div style={{ padding: '8px 24px', display: 'flex', gap: 6, flexWrap: 'wrap', borderBottom: `1px solid ${colors.borderSubtle}` }}>
              <Pill active={!filterTag} onClick={() => setFilterTag(null)}>All</Pill>
              {(spec.tags ?? []).map((t) => (
                <Pill key={t.name} active={filterTag === t.name} onClick={() => setFilterTag(filterTag === t.name ? null : t.name)}>
                  {t.name}
                </Pill>
              ))}
            </div>
          )}

          {/* ---- body ---- */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 24px 24px' }}>
            {err && <p style={{ color: colors.accentRed }}>Failed to load spec: {err}</p>}
            {!spec && !err && <p style={{ color: colors.textDim }}>Loading…</p>}

            {visibleTags.map((tag) => (
              <div key={tag} style={{ marginBottom: 20 }}>
                <h3 style={{ margin: '12px 0 8px', fontSize: 13, fontWeight: 700, color: colors.accentBlue, letterSpacing: 1, textTransform: 'uppercase' }}>
                  {tag}
                </h3>
                {grouped[tag]?.map(({ method, path, op }) => {
                  const id = `${method}:${path}`;
                  const open = expandedOp === id;
                  return (
                    <div key={id} style={{ marginBottom: 4 }}>
                      <button
                        onClick={() => setExpandedOp(open ? null : id)}
                        style={{
                          width: '100%', textAlign: 'left', background: open ? 'rgba(56,189,248,0.06)' : colors.surface3,
                          border: `1px solid ${open ? 'rgba(56,189,248,0.25)' : colors.borderSubtle}`,
                          borderRadius: radius.sm, padding: '8px 12px', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: 10, transition: 'background 0.15s',
                        }}
                      >
                        <MethodBadge method={method} />
                        <code style={{ fontFamily: fonts.mono, fontSize: 13, color: colors.textPrimary }}>{path}</code>
                        <span style={{ flex: 1 }} />
                        <span style={{ fontSize: 12, color: colors.textMuted }}>{op.summary}</span>
                        <span style={{ fontSize: 10, color: colors.textFaint, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▼</span>
                      </button>
                      {open && <OpDetail op={op} />}
                    </div>
                  );
                })}
              </div>
            ))}

            {/* ---- schemas ---- */}
            {spec?.components?.schemas && (
              <div style={{ marginTop: 24 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: colors.accentBlue, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
                  Schemas
                </h3>
                {Object.entries(spec.components.schemas).map(([name, schema]) => (
                  <div key={name} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: colors.textPrimary, marginBottom: 4, fontFamily: fonts.mono }}>{name}</div>
                    <pre style={preStyle}>{JSON.stringify(schema, null, 2)}</pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        </m.div>
      </m.div>
    </AnimatePresence>
  );
}

// ---- sub-components ----

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      background: active ? 'rgba(56,189,248,0.15)' : 'transparent',
      border: `1px solid ${active ? colors.accentBlue : colors.borderSubtle}`,
      color: active ? colors.accentBlue : colors.textDim,
      borderRadius: radius.full, padding: '3px 12px', fontSize: 11, cursor: 'pointer',
      fontWeight: active ? 600 : 400, transition: 'all 0.15s',
    }}>
      {children}
    </button>
  );
}

function MethodBadge({ method }: { method: string }) {
  const bg = METHOD_COLOR[method] ?? '#999';
  return (
    <span style={{
      fontFamily: fonts.mono, fontSize: 11, fontWeight: 700,
      color: '#fff', background: bg, borderRadius: radius.sm,
      padding: '2px 8px', textTransform: 'uppercase', minWidth: 52, textAlign: 'center', display: 'inline-block',
    }}>
      {method}
    </span>
  );
}

function OpDetail({ op }: { op: OAOp }) {
  return (
    <div style={{ padding: '10px 14px', borderLeft: `2px solid rgba(56,189,248,0.2)`, marginLeft: 6, marginTop: 2 }}>
      {op.description && <p style={{ margin: '0 0 8px', fontSize: 13, color: colors.textSecondary, lineHeight: 1.5 }}>{op.description}</p>}

      {op.parameters && op.parameters.length > 0 && (
        <>
          <SectionTitle>Parameters</SectionTitle>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 10 }}>
            <thead>
              <tr style={{ color: colors.textDim, textAlign: 'left' }}>
                <th style={thStyle}>Name</th><th style={thStyle}>In</th><th style={thStyle}>Type</th><th style={thStyle}>Required</th><th style={thStyle}>Description</th>
              </tr>
            </thead>
            <tbody>
              {op.parameters.map((p) => (
                <tr key={p.name}>
                  <td style={tdStyle}><code style={{ fontFamily: fonts.mono, color: colors.accentBlue }}>{p.name}</code></td>
                  <td style={tdStyle}>{p.in}</td>
                  <td style={tdStyle}>{p.schema?.type ?? '—'}</td>
                  <td style={tdStyle}>{p.required ? '✓' : ''}</td>
                  <td style={tdStyle}>{p.description ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {op.requestBody?.content && (
        <>
          <SectionTitle>Request Body</SectionTitle>
          {Object.entries(op.requestBody.content).map(([ct, media]) => (
            <pre key={ct} style={preStyle}>{JSON.stringify(media.schema, null, 2)}</pre>
          ))}
        </>
      )}

      {op.responses && (
        <>
          <SectionTitle>Responses</SectionTitle>
          {Object.entries(op.responses).map(([code, resp]) => (
            <div key={code} style={{ marginBottom: 6 }}>
              <span style={{ fontFamily: fonts.mono, fontSize: 12, fontWeight: 600, color: code.startsWith('2') ? colors.accentGreen : colors.accentOrange }}>
                {code}
              </span>
              <span style={{ fontSize: 12, color: colors.textMuted, marginLeft: 8 }}>{resp.description}</span>
              {resp.content && Object.entries(resp.content).map(([ct, media]) => (
                <pre key={ct} style={preStyle}>{JSON.stringify(media.schema, null, 2)}</pre>
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: colors.textDim, textTransform: 'uppercase', letterSpacing: 0.8, margin: '8px 0 4px' }}>{children}</div>;
}

// ---- styles ----
const closeBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: colors.textDim,
  fontSize: 18, cursor: 'pointer', padding: '4px 8px', borderRadius: radius.sm,
};
const thStyle: React.CSSProperties = { padding: '4px 8px', borderBottom: `1px solid ${colors.borderSubtle}`, fontWeight: 600, fontSize: 11 };
const tdStyle: React.CSSProperties = { padding: '4px 8px', borderBottom: `1px solid ${colors.borderSubtle}`, color: colors.textSecondary };
const preStyle: React.CSSProperties = {
  background: colors.surface0, border: `1px solid ${colors.borderSubtle}`,
  borderRadius: radius.sm, padding: '8px 12px', fontSize: 11, lineHeight: 1.5,
  fontFamily: fonts.mono, color: colors.textSecondary, overflowX: 'auto', margin: '4px 0',
};
