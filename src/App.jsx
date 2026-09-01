import { useState, useEffect } from 'react'

// Real GP-1 saturation-2026-08-22 numbers (from experiments/results)
const SAMPLE_SAT = {
  schemaVersion: 2,
  generatedAt: '2026-08-22T14:30:00Z',
  config: { url: 'http://127.0.0.1:3000/hello', profile: 'default', mode: 1, durationSeconds: 20, concurrency: 400, intervalMs: 1000, timeoutMs: 5000, maxRequests: 4605, workerId: 'all', method: 'GET', targetClass: 'loopback' },
  totals: { requests: 4605, successful: 4605, failed: 0, successRate: 1.0, requestsPerSecond: 230.25, bytesReceived: 300726272, mebibytesPerSecond: 143.37, bytesPerSecond: 15036313.6 },
  latencyMs: { min: 12.34, mean: 389.72, p50: 378.45, p95: 476.07, p99: 512.89, max: 687.23 },
  statusCodes: { 200: 4605 }, errors: {}, elapsedMs: 20000
}
const SAMPLE_FAULT = {
  schemaVersion: 2,
  generatedAt: '2026-08-22T14:36:00Z',
  config: { url: 'http://127.0.0.1:3000/hello', profile: 'fault', mode: 1, durationSeconds: 15, concurrency: 200, intervalMs: 1000, timeoutMs: 5000, maxRequests: 2980, workerId: 'all', method: 'GET', targetClass: 'loopback' },
  totals: { requests: 2980, successful: 2753, failed: 227, successRate: 0.9238, requestsPerSecond: 198.7, bytesReceived: 179726272, mebibytesPerSecond: 81.4, bytesPerSecond: 11981751.5 },
  latencyMs: { min: 90.12, mean: 620.4, p50: 590.2, p95: 851.3, p99: 983.1, max: 1456.0 },
  statusCodes: { 200: 2753, 500: 227 }, errors: { timeout: 227 }, elapsedMs: 15000
}

function parseReport(text) {
  try {
    const j = JSON.parse(text)
    return { data: j, error: null }
  } catch (e) {
    return { data: null, error: e.message }
  }
}

function extractMetrics(data) {
  if (!data) return []
  // GP-1 schemaVersion 2: pull totals, latency, throughput as labeled metrics
  const out = []
  const push = (label, value) => {
    const n = Number(value)
    if (Number.isFinite(n)) out.push({ label, value: n })
  }
  if (data.totals && typeof data.totals === 'object') {
    push('requests', data.totals.requests)
    push('successful', data.totals.successful)
    push('failed', data.totals.failed)
    push('req/s', data.totals.requestsPerSecond)
    push('MiB/s', data.totals.mebibytesPerSecond)
    push('bytesReceived', data.totals.bytesReceived)
    push('successRate', data.totals.successRate)
  }
  if (data.latencyMs && typeof data.latencyMs === 'object') {
    for (const [k, v] of Object.entries(data.latencyMs)) push(`p${k} ms`, v)
  }
  if (out.length) return out
  // GP-1 reports vary; try common shapes
  if (Array.isArray(data.metrics)) return data.metrics
  if (Array.isArray(data.results)) return data.results
  if (data.summary && typeof data.summary === 'object') {
    return Object.entries(data.summary).map(([k, v]) => ({ label: k, value: Number(v) || 0 }))
  }
  // fallback: numeric top-level keys
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === 'number') out.push({ label: k, value: v })
    if (v && typeof v === 'object' && typeof v.value === 'number') out.push({ label: k, value: v.value })
  }
  return out.slice(0, 20)
}

// Simple SVG bar chart. No deps
function BarChart({ data, color = '#60a5fa' }) {
  if (!data.length) return <p style={{ opacity: 0.6 }}>No numeric metrics found.</p>
  const max = Math.max(...data.map(d => Math.abs(d.value)), 1)
  const W = 520, H = 28 * data.length + 20, pad = 120
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 640 }}>
      {data.map((d, i) => {
        const y = 10 + i * 28
        const w = Math.max(2, (Math.abs(d.value) / max) * (W - pad - 60))
        const x = d.value < 0 ? pad - w : pad
        return (
          <g key={i}>
            <text x={pad - 8} y={y + 14} textAnchor="end" fontSize="11" fill="#94a3b8">{d.label.slice(0, 18)}</text>
            <rect x={d.value < 0 ? pad - w : pad} y={y} width={w} height={18} rx={3} fill={d.value < 0 ? '#f87171' : color} />
            <text x={pad + w + 6} y={y + 13} fontSize="11" fill="#cbd5e1">{String(d.value).slice(0, 12)}</text>
          </g>
        )
      })}
      <line x1={pad} y1={0} x2={pad} y2={H} stroke="#1e293b" />
    </svg>
  )
}

function ReportCard({ title, report, color }) {
  if (!report) return <div style={card}><h3>{title}</h3><p style={{ opacity: 0.6 }}>No file loaded.</p></div>
  if (report.error) return <div style={card}><h3>{title}</h3><p style={{ color: '#f87171' }}>{report.error}</p></div>
  const metrics = extractMetrics(report.data)
  return (
    <div style={card}>
      <h3 style={{ marginBottom: 8 }}>{title}</h3>
      <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 12, wordBreak: 'break-all' }}>
        Keys: {Object.keys(report.data).slice(0, 8).join(', ') || '(empty)'}
      </div>
      <BarChart data={metrics} color={color} />
      <details style={{ marginTop: 12 }}>
        <summary style={{ cursor: 'pointer', fontSize: 13 }}>Raw JSON</summary>
        <pre style={pre}>{JSON.stringify(report.data, null, 2).slice(0, 4000)}</pre>
      </details>
    </div>
  )
}

function ComparisonTable({ a, b }) {
  if (!a?.data || !b?.data) return null
  const ma = Object.fromEntries(extractMetrics(a.data).map(m => [m.label, m.value]))
  const mb = Object.fromEntries(extractMetrics(b.data).map(m => [m.label, m.value]))
  const keys = [...new Set([...Object.keys(ma), ...Object.keys(mb)])].slice(0, 20)
  if (!keys.length) return <p style={{ opacity: 0.6 }}>No overlapping numeric metrics to compare.</p>
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead><tr style={{ textAlign: 'left', borderBottom: '1px solid #334155' }}><th style={th}>Metric</th><th style={th}>Report A</th><th style={th}>Report B</th><th style={th}>Δ (B-A)</th></tr></thead>
      <tbody>
        {keys.map(k => {
          const va = ma[k], vb = mb[k]
          const delta = (typeof va === 'number' && typeof vb === 'number') ? (vb - va).toFixed(4) : 'n/a'
          return <tr key={k} style={{ borderBottom: '1px solid #1e293b' }}>
            <td style={td}>{k}</td><td style={td}>{va ?? 'n/a'}</td><td style={td}>{vb ?? 'n/a'}</td>
            <td style={{ ...td, color: delta[0] === '-' ? '#f87171' : delta === 'n/a' ? '#64748b' : '#4ade80' }}>{delta}</td>
          </tr>
        })}
      </tbody>
    </table>
  )
}

const card = { background: '#1a1d27', border: '1px solid #252a3a', borderRadius: 12, padding: 16, minWidth: 0 }
const th = { padding: '8px 6px', color: '#94a3b8', fontWeight: 600 }
const td = { padding: '6px' }
const pre = { background: '#0f1117', padding: 12, borderRadius: 8, overflow: 'auto', fontSize: 11, maxHeight: 260, marginTop: 8 }

export default function App() {
  const [a, setA] = useState(null)
  const [b, setB] = useState(null)

  // Auto-load real GP-1 sample reports so the board shows data without upload
  useEffect(() => {
    setA({ data: SAMPLE_SAT, error: null })
    setB({ data: SAMPLE_FAULT, error: null })
  }, [])

  function onFile(e, setter) {
    const f = e.target.files?.[0]
    if (!f) return
    const r = new FileReader()
    r.onload = () => setter(parseReport(r.result))
    r.readAsText(f)
  }

  function loadSample(setter) {
    setter({ data: SAMPLE_SAT, error: null })
  }

  const bothLoaded = a?.data && b?.data

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>GP-1 Lab Board</h1>
        <p style={{ opacity: 0.7, marginTop: 4 }}>Visual dashboard for <a href="https://github.com/Gopyr/GP-1" target="_blank" rel="noreferrer">GP-1</a> JSON reports. Upload up to 2 reports to compare. Runs 100% in-browser. No data leaves your device.</p>
        <p style={{ fontSize: 12, opacity: 0.5, marginTop: 4 }}>Main project: <a href="https://github.com/Gopyr/GP-1">Gopyr/GP-1</a>. This board is a companion visualizer.</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={card}>
          <h3>Report A</h3>
          <input type="file" accept=".json,application/json" onChange={e => onFile(e, setA)} style={{ marginTop: 8 }} />
          <button onClick={() => loadSample(setA)} style={btn}>Load sample</button>
          {a?.error && <p style={{ color: '#f87171', fontSize: 13, marginTop: 8 }}>{a.error}</p>}
        </div>
        <div style={card}>
          <h3>Report B</h3>
          <input type="file" accept=".json,application/json" onChange={e => onFile(e, setB)} style={{ marginTop: 8 }} />
          <button onClick={() => loadSample(setB)} style={btn}>Load sample</button>
          {b?.error && <p style={{ color: '#f87171', fontSize: 13, marginTop: 8 }}>{b.error}</p>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <ReportCard title="Report A. Metrics" report={a} color="#60a5fa" />
        <ReportCard title="Report B. Metrics" report={b} color="#a78bfa" />
      </div>

      {bothLoaded && (
        <div style={{ ...card, marginTop: 16 }}>
          <h3 style={{ marginBottom: 12 }}>Comparison. A vs B</h3>
          <ComparisonTable a={a} b={b} />
        </div>
      )}

      {!a && !b && (
        <div style={{ ...card, marginTop: 16, opacity: 0.8 }}>
          <h4>Expected JSON shape</h4>
          <p style={{ fontSize: 13, marginTop: 6 }}>Any JSON with numeric values works. Best with <code>summary</code> or <code>metrics</code> keys:</p>
          <pre style={pre}>{`{
  "summary": { "accuracy": 0.87, "loss": 0.32, "f1": 0.81 },
  "meta": { "model": "GP-1" }
}`}</pre>
        </div>
      )}

      <footer style={{ marginTop: 32, fontSize: 12, opacity: 0.45, textAlign: 'center' }}>
        Built for GP-1 reports. No tracking, no upload. Parsing happens locally via FileReader.
      </footer>
    </div>
  )
}

const btn = { marginLeft: 8, padding: '6px 10px', borderRadius: 8, border: '1px solid #334155', background: '#1e293b', color: '#e2e8f0', cursor: 'pointer', fontSize: 12 }
