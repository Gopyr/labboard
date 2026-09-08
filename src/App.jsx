import { useState, useEffect } from 'react'

const SAMPLE_SAT = {
  schemaVersion: 2,
  generatedAt: '2026-08-22T14:30:00Z',
  config: { url: 'http://127.0.0.1:3000/hello', concurrency: 400, method: 'GET' },
  totals: { requests: 4605, successful: 4605, failed: 0, successRate: 1.0, requestsPerSecond: 230.25, bytesReceived: 300726272, mebibytesPerSecond: 143.37 },
  latencyMs: { min: 12.34, mean: 389.72, p50: 378.45, p95: 476.07, p99: 512.89, max: 687.23 },
  statusCodes: { 200: 4605 }, errors: {}, elapsedMs: 20000
}
const SAMPLE_FAULT = {
  schemaVersion: 2,
  generatedAt: '2026-08-22T14:36:00Z',
  config: { url: 'http://127.0.0.1:3000/hello', concurrency: 200, method: 'GET' },
  totals: { requests: 2980, successful: 2753, failed: 227, successRate: 0.9238, requestsPerSecond: 198.7, bytesReceived: 179726272, mebibytesPerSecond: 81.4 },
  latencyMs: { min: 90.12, mean: 620.4, p50: 590.2, p95: 851.3, p99: 983.1, max: 1456.0 },
  statusCodes: { 200: 2753, 500: 227 }, errors: { timeout: 227 }, elapsedMs: 15000
}

function parseReport(text) {
  try {
    return { data: JSON.parse(text), error: null }
  } catch (e) {
    return { data: null, error: e.message }
  }
}

function extractMetrics(data) {
  if (!data) return []
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
    push('successRate', data.totals.successRate)
  }
  if (data.latencyMs && typeof data.latencyMs === 'object') {
    for (const [k, v] of Object.entries(data.latencyMs)) push(`p${k} ms`, v)
  }
  if (out.length) return out
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === 'number') out.push({ label: k, value: v })
  }
  return out.slice(0, 20)
}

function BarChart({ data, color = '#60a5fa' }) {
  if (!data.length) return <p style={{ opacity: 0.6 }}>No metrics found.</p>
  const max = Math.max(...data.map(d => Math.abs(d.value)), 1)
  const W = 520, H = 28 * data.length + 20, pad = 120
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 640 }}>
      {data.map((d, i) => {
        const y = 10 + i * 28
        const w = Math.max(2, (Math.abs(d.value) / max) * (W - pad - 60))
        const x = pad
        return (
          <g key={i}>
            <text x={pad - 8} y={y + 14} textAnchor="end" fontSize="11" fill="#94a3b8">{d.label.slice(0, 18)}</text>
            <rect x={x} y={y} width={w} height={18} rx={3} fill={color} />
            <text x={pad + w + 6} y={y + 13} fontSize="11" fill="#cbd5e1">{String(d.value).slice(0, 12)}</text>
          </g>
        )
      })}
      <line x1={pad} y1={0} x2={pad} y2={H} stroke="#1e293b" />
    </svg>
  )
}

function ComparisonTable({ a, b }) {
  if (!a?.data || !b?.data) return null
  const ma = Object.fromEntries(extractMetrics(a.data).map(m => [m.label, m.value]))
  const mb = Object.fromEntries(extractMetrics(b.data).map(m => [m.label, m.value]))
  const keys = [...new Set([...Object.keys(ma), ...Object.keys(mb)])].slice(0, 20)
  if (!keys.length) return <p style={{ opacity: 0.6 }}>No overlapping metrics.</p>

  function exportCSV() {
    let csv = "Metric,Report A,Report B,Delta\n"
    for (const k of keys) {
      csv += `"${k}","${ma[k] ?? ''}","${mb[k] ?? ''}","${(ma[k] !== undefined && mb[k] !== undefined) ? (mb[k] - ma[k]) : 'n/a'}"\n`
    }
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const aEl = document.createElement('a')
    aEl.href = url
    aEl.download = 'comparison-report.csv'
    aEl.click()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button onClick={exportCSV} style={btn}>Export CSV</button>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead><tr style={{ textAlign: 'left', borderBottom: '1px solid #334155' }}><th style={th}>Metric</th><th style={th}>Report A</th><th style={th}>Report B</th><th style={th}>Delta (B-A)</th></tr></thead>
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
    </div>
  )
}

const card = { background: '#1a1d27', border: '1px solid #252a3a', borderRadius: 12, padding: 16 }
const th = { padding: '8px 6px', color: '#94a3b8', fontWeight: 600 }
const td = { padding: '6px' }
const btn = { padding: '6px 12px', borderRadius: 8, border: '1px solid #334155', background: '#1e293b', color: '#e2e8f0', cursor: 'pointer', fontSize: 12 }

export default function App() {
  const [a, setA] = useState(null)
  const [b, setB] = useState(null)

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

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px', color: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>GP-1 Lab Board</h1>
        <p style={{ opacity: 0.7, marginTop: 4 }}>Visual dashboard and automated delta analyzer for GP-1 benchmark reports.</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={card}>
          <h3>Report A</h3>
          <input type="file" accept=".json" onChange={e => onFile(e, setA)} style={{ marginTop: 8 }} />
          <button onClick={() => setA({ data: SAMPLE_SAT, error: null })} style={{ ...btn, marginLeft: 8 }}>Load Sample</button>
        </div>
        <div style={card}>
          <h3>Report B</h3>
          <input type="file" accept=".json" onChange={e => onFile(e, setB)} style={{ marginTop: 8 }} />
          <button onClick={() => setB({ data: SAMPLE_FAULT, error: null })} style={{ ...btn, marginLeft: 8 }}>Load Sample</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={card}>
          <h3>Report A Metrics</h3>
          <BarChart data={extractMetrics(a?.data)} color="#60a5fa" />
        </div>
        <div style={card}>
          <h3>Report B Metrics</h3>
          <BarChart data={extractMetrics(b?.data)} color="#a78bfa" />
        </div>
      </div>

      {a?.data && b?.data && (
        <div style={{ ...card, marginTop: 16 }}>
          <h3 style={{ marginBottom: 12 }}>Regression & Delta Analysis</h3>
          <ComparisonTable a={a} b={b} />
        </div>
      )}
    </div>
  )
}
