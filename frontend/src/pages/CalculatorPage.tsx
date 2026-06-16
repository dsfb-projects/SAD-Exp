import { useState, useEffect } from 'react'
import { api, Order, CalcResult, TruckResult } from '../api'
import { Calculator, ChevronDown, ChevronRight, Truck, AlertTriangle, CheckCircle, Package, FileDown } from 'lucide-react'

export default function CalculatorPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [selectedOrders, setSelectedOrders] = useState<Set<number>>(new Set())
  const [useAll, setUseAll] = useState(true)
  const [qtdBancos, setQtdBancos] = useState(0)
  const [result, setResult] = useState<CalcResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => { api.listOrders().then(setOrders) }, [])

  const toggleOrder = (id: number) => {
    setSelectedOrders(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const calculate = async () => {
    setLoading(true); setResult(null)
    try {
      const res = await api.calculate({
        qtd_bancos: qtdBancos,
        use_all_orders: useAll,
        order_ids: useAll ? [] : Array.from(selectedOrders)
      })
      setResult(res)
      if (res.trucks) setExpanded(new Set(res.trucks.map((t: TruckResult) => t.veiculo)))
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Calculation failed')
    } finally {
      setLoading(false) }
  }

  const toggleExpand = (name: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name); else next.add(name)
      return next
    })
  }

  const areaPercentage = (truck: TruckResult, trucks: TruckResult[]) => {
    const baseArea = trucks.reduce((max, t) => {
      const total = t.area_livre + t.historico_cargas.filter(c => !c.empilhavel).reduce((s, c) => s + (c.tipo === 'banco' ? 1.60 * 0.60 * c.quantidade : 0), 0)
      return Math.max(max, total)
    }, 0) || 1
    return Math.min(100, ((baseArea - truck.area_livre) / baseArea) * 100)
  }

  const exportPDF = () => {
    if (!result) return
    const now = new Date().toLocaleString('pt-BR')
    const totalWeight = result.trucks.reduce((s, t) => s + t.peso_acumulado, 0)
    const totalItems = result.trucks.reduce((s, t) => s + t.historico_cargas.length, 0)

    const truckPages = result.trucks.map(truck => {
      const isExtra = truck.veiculo.toLowerCase().includes('extra')
      const rows = truck.historico_cargas.map((item, idx) => `
        <tr style="background:${idx % 2 === 0 ? '#f9fafb' : '#ffffff'}">
          <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;font-size:13px">
            ${item.tipo === 'banco'
              ? `<span style="font-size:14px">🗃️</span> ${item.descricao}`
              : `<strong>${item.nome}</strong>${item.num_venda ? `<br><span style="font-size:11px;color:#6b7280">Venda ${item.num_venda} · ${item.cliente}</span>` : ''}
                 ${item.empilhavel ? '<span style="background:#dcfce7;color:#16a34a;font-size:10px;padding:1px 6px;border-radius:9px;margin-left:4px">Empilhável</span>' : ''}`
            }
          </td>
          <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:center;font-weight:600">${item.quantidade} un</td>
          <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:right">${item.peso.toFixed(1)} kg</td>
        </tr>
      `).join('')

      return `
        <div style="page-break-before: always; page-break-inside: avoid; font-family: Arial, sans-serif; padding: 32px 40px; max-width: 800px; margin: 0 auto;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #1d4ed8">
            <div>
              <div style="font-size:22px;font-weight:800;color:#111827">🚛 ${truck.veiculo}</div>
              ${isExtra ? '<span style="background:#dbeafe;color:#1d4ed8;font-size:11px;padding:2px 8px;border-radius:9px;font-weight:600">CARRETA EXTRA</span>' : ''}
            </div>
            <div style="text-align:right">
              <div style="font-size:11px;color:#6b7280;margin-bottom:2px">SAD-Exp · Manifesto de Carga</div>
              <div style="font-size:11px;color:#6b7280">${now}</div>
            </div>
          </div>

          <div style="display:flex;gap:16px;margin-bottom:20px">
            <div style="flex:1;background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:12px 16px;text-align:center">
              <div style="font-size:20px;font-weight:800;color:#0369a1">${truck.historico_cargas.length}</div>
              <div style="font-size:11px;color:#64748b">Itens</div>
            </div>
            <div style="flex:1;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px;text-align:center">
              <div style="font-size:20px;font-weight:800;color:#15803d">${truck.peso_acumulado.toFixed(0)} kg</div>
              <div style="font-size:11px;color:#64748b">Peso Total</div>
            </div>
            <div style="flex:1;background:#fefce8;border:1px solid #fef08a;border-radius:8px;padding:12px 16px;text-align:center">
              <div style="font-size:20px;font-weight:800;color:#a16207">${truck.area_livre.toFixed(2)} m²</div>
              <div style="font-size:11px;color:#64748b">Área Livre</div>
            </div>
          </div>

          <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
            <thead>
              <tr style="background:#1d4ed8">
                <th style="padding:9px 10px;text-align:left;font-size:12px;color:#fff;font-weight:600;letter-spacing:0.04em">PRODUTO</th>
                <th style="padding:9px 10px;text-align:center;font-size:12px;color:#fff;font-weight:600;letter-spacing:0.04em">QTD</th>
                <th style="padding:9px 10px;text-align:right;font-size:12px;color:#fff;font-weight:600;letter-spacing:0.04em">PESO</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
            <tfoot>
              <tr style="background:#f1f5f9">
                <td style="padding:9px 10px;font-weight:700;font-size:13px;border-top:2px solid #e2e8f0">TOTAL</td>
                <td style="padding:9px 10px;text-align:center;font-weight:700;font-size:13px;border-top:2px solid #e2e8f0">${truck.historico_cargas.reduce((s,c) => s + c.quantidade, 0)} un</td>
                <td style="padding:9px 10px;text-align:right;font-weight:700;font-size:13px;border-top:2px solid #e2e8f0">${truck.peso_acumulado.toFixed(1)} kg</td>
              </tr>
            </tfoot>
          </table>
        </div>
      `
    }).join('')

    const coverPage = `
      <div style="font-family:Arial,sans-serif;padding:60px 40px;max-width:800px;margin:0 auto;min-height:100vh;display:flex;flex-direction:column;justify-content:center">
        <div style="text-align:center;margin-bottom:48px">
          <div style="font-size:48px;margin-bottom:12px">🚛</div>
          <h1 style="font-size:32px;font-weight:800;color:#111827;margin-bottom:6px">Manifesto de Carregamento</h1>
          <p style="color:#6b7280;font-size:14px">Gerado em ${now}</p>
        </div>
        <div style="display:flex;gap:16px;margin-bottom:40px">
          <div style="flex:1;background:#eff6ff;border:2px solid #bfdbfe;border-radius:12px;padding:20px;text-align:center">
            <div style="font-size:40px;font-weight:900;color:#1d4ed8">${result.trucks_used}</div>
            <div style="color:#64748b;font-size:13px;margin-top:4px">Carretas Utilizadas</div>
          </div>
          <div style="flex:1;background:#f0fdf4;border:2px solid #bbf7d0;border-radius:12px;padding:20px;text-align:center">
            <div style="font-size:40px;font-weight:900;color:#16a34a">${totalItems}</div>
            <div style="color:#64748b;font-size:13px;margin-top:4px">Itens Alocados</div>
          </div>
          <div style="flex:1;background:#fefce8;border:2px solid #fef08a;border-radius:12px;padding:20px;text-align:center">
            <div style="font-size:40px;font-weight:900;color:#a16207">${(totalWeight / 1000).toFixed(1)}t</div>
            <div style="color:#64748b;font-size:13px;margin-top:4px">Peso Total</div>
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
          <thead>
            <tr style="background:#1d4ed8">
              <th style="padding:10px 14px;text-align:left;color:#fff;font-size:12px;letter-spacing:0.04em">CARRETA</th>
              <th style="padding:10px 14px;text-align:center;color:#fff;font-size:12px;letter-spacing:0.04em">ITENS</th>
              <th style="padding:10px 14px;text-align:right;color:#fff;font-size:12px;letter-spacing:0.04em">PESO (kg)</th>
              <th style="padding:10px 14px;text-align:right;color:#fff;font-size:12px;letter-spacing:0.04em">ÁREA LIVRE (m²)</th>
            </tr>
          </thead>
          <tbody>
            ${result.trucks.map((t, i) => `
              <tr style="background:${i % 2 === 0 ? '#f9fafb' : '#ffffff'}">
                <td style="padding:9px 14px;font-size:13px;font-weight:600;border-bottom:1px solid #e5e7eb">${t.veiculo}</td>
                <td style="padding:9px 14px;font-size:13px;text-align:center;border-bottom:1px solid #e5e7eb">${t.historico_cargas.length}</td>
                <td style="padding:9px 14px;font-size:13px;text-align:right;border-bottom:1px solid #e5e7eb">${t.peso_acumulado.toFixed(1)}</td>
                <td style="padding:9px 14px;font-size:13px;text-align:right;border-bottom:1px solid #e5e7eb">${t.area_livre.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ${result.warnings.length > 0 ? `
          <div style="margin-top:24px;padding:14px 16px;background:#fffbeb;border:1px solid #fcd34d;border-radius:8px">
            <div style="font-weight:700;color:#92400e;margin-bottom:6px;font-size:13px">⚠️ Avisos (${result.warnings.length})</div>
            ${result.warnings.map(w => `<div style="font-size:12px;color:#92400e">• ${w}</div>`).join('')}
          </div>
        ` : ''}
      </div>
    `

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Manifesto de Carregamento</title>
  <style>
    @page { size: A4; margin: 0; }
    body { margin: 0; padding: 0; }
    div[style*="page-break-before"]:first-child { page-break-before: avoid !important; }
    @media print {
      button { display: none !important; }
    }
  </style>
</head>
<body>
  <div style="position:fixed;top:16px;right:16px;z-index:999;display:flex;gap:8px">
    <button onclick="window.print()" style="background:#1d4ed8;color:#fff;border:none;padding:10px 20px;border-radius:7px;font-size:13px;font-weight:600;cursor:pointer">🖨️ Imprimir / Salvar PDF</button>
    <button onclick="window.close()" style="background:#f1f5f9;color:#374151;border:1px solid #e2e8f0;padding:10px 16px;border-radius:7px;font-size:13px;cursor:pointer">✕ Fechar</button>
  </div>
  ${coverPage}
  ${truckPages}
</body>
</html>`

    const win = window.open('', '_blank')
    if (win) {
      win.document.write(html)
      win.document.close()
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Calculadora de Carga</div>
          <div className="page-subtitle">Distribuição automática de produtos por carreta</div>
        </div>
        {result && (
          <button className="btn btn-success" onClick={exportPDF}>
            <FileDown size={16} /> Exportar PDF
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 16, alignItems: 'start' }}>
        {/* Config Panel */}
        <div>
          <div className="card" style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 700, marginBottom: 16, fontSize: 15 }}>Configuração</div>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label>Quantidade de Bancos</label>
              <input type="number" min={0} value={qtdBancos}
                onChange={e => setQtdBancos(+e.target.value)}
                style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 7, padding: '9px 12px', color: 'var(--text)', width: '100%' }}
              />
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>Caixa de miscelânea 1.6×0.6m · 500 kg cada</span>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label className="toggle">
                <input type="checkbox" checked={useAll} onChange={e => setUseAll(e.target.checked)} />
                <div className="toggle-track"><div className="toggle-thumb" /></div>
                <span style={{ fontWeight: 600, fontSize: 13 }}>Usar todos os pedidos</span>
              </label>
            </div>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={calculate} disabled={loading}>
              <Calculator size={16} />
              {loading ? 'Calculando...' : 'Calcular Distribuição'}
            </button>
          </div>

          {!useAll && (
            <div className="card">
              <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 13 }}>Selecionar Pedidos</div>
              {orders.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '20px 0', fontSize: 13 }}>Nenhum pedido cadastrado</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {orders.map(o => (
                    <label key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: selectedOrders.has(o.id) ? 'rgba(79,142,247,0.1)' : 'var(--surface2)', borderRadius: 7, cursor: 'pointer', border: `1px solid ${selectedOrders.has(o.id) ? 'var(--accent)' : 'transparent'}` }}>
                      <input type="checkbox" checked={selectedOrders.has(o.id)} onChange={() => toggleOrder(o.id)} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{o.num_venda}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{o.cliente} · {Object.keys(o.produtos).length} item(ns)</div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Results */}
        <div>
          {!result && !loading && (
            <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
              <Truck size={48} style={{ color: 'var(--muted)', marginBottom: 16, opacity: 0.3 }} />
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Pronto para calcular</div>
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>Configure os parâmetros e clique em "Calcular Distribuição"</div>
            </div>
          )}

          {loading && (
            <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>⚙️</div>
              <div style={{ fontWeight: 600 }}>Calculando distribuição...</div>
            </div>
          )}

          {result && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
                <div className="card" style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--accent)' }}>{result.trucks_used}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>Carretas Usadas</div>
                </div>
                <div className="card" style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--green)' }}>
                    {result.trucks.reduce((s, t) => s + t.historico_cargas.length, 0)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>Itens Alocados</div>
                </div>
                <div className="card" style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 32, fontWeight: 800, color: '#f59e0b' }}>
                    {(result.trucks.reduce((s, t) => s + t.peso_acumulado, 0) / 1000).toFixed(1)}t
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>Peso Total</div>
                </div>
              </div>

              {result.warnings.length > 0 && (
                <div className="alert alert-warning" style={{ marginBottom: 14 }}>
                  <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 600 }}>Avisos ({result.warnings.length})</div>
                    {result.warnings.map((w, i) => <div key={i} style={{ fontSize: 12 }}>• {w}</div>)}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {result.trucks.map(truck => {
                  const isOpen = expanded.has(truck.veiculo)
                  const isExtra = truck.veiculo.toLowerCase().includes('extra')
                  return (
                    <div key={truck.veiculo} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                      <div
                        style={{ padding: '14px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
                        onClick={() => toggleExpand(truck.veiculo)}
                      >
                        {isOpen ? <ChevronDown size={16} color="var(--muted)" /> : <ChevronRight size={16} color="var(--muted)" />}
                        <Truck size={18} color={isExtra ? 'var(--yellow)' : 'var(--accent)'} />
                        <div style={{ flex: 1 }}>
                          <span style={{ fontWeight: 700, fontSize: 14 }}>{truck.veiculo}</span>
                          {isExtra && <span className="badge badge-blue" style={{ marginLeft: 8, fontSize: 10 }}>Extra</span>}
                        </div>
                        <div style={{ display: 'flex', gap: 20, fontSize: 13 }}>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ color: 'var(--muted)', fontSize: 11 }}>Área livre</div>
                            <div style={{ fontWeight: 600 }}>{truck.area_livre.toFixed(2)} m²</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ color: 'var(--muted)', fontSize: 11 }}>Peso total</div>
                            <div style={{ fontWeight: 600 }}>{truck.peso_acumulado.toFixed(0)} kg</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ color: 'var(--muted)', fontSize: 11 }}>Itens</div>
                            <div style={{ fontWeight: 600 }}>{truck.historico_cargas.length}</div>
                          </div>
                        </div>
                      </div>

                      <div style={{ height: 4, background: 'var(--surface2)' }}>
                        <div style={{ height: '100%', background: isExtra ? 'var(--yellow)' : 'var(--accent)', width: `${areaPercentage(truck, result.trucks)}%`, transition: 'width 0.5s' }} />
                      </div>

                      {isOpen && (
                        <div style={{ borderTop: '1px solid var(--border)', padding: '12px 18px' }}>
                          {truck.historico_cargas.map((item, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: idx < truck.historico_cargas.length - 1 ? '1px solid rgba(46,50,71,0.5)' : 'none' }}>
                              {item.tipo === 'banco'
                                ? <span style={{ fontSize: 16 }}>🗃️</span>
                                : <Package size={15} color={item.empilhavel ? 'var(--green)' : 'var(--accent)'} />
                              }
                              <div style={{ flex: 1, fontSize: 13 }}>
                                {item.tipo === 'banco' ? (
                                  <span style={{ fontWeight: 600 }}>{item.descricao}</span>
                                ) : (
                                  <>
                                    <span style={{ fontWeight: 600 }}>{item.nome}</span>
                                    {item.num_venda && <span style={{ color: 'var(--muted)', fontSize: 11 }}> · Venda {item.num_venda} ({item.cliente})</span>}
                                    {item.empilhavel && <span className="badge badge-green" style={{ marginLeft: 6, fontSize: 10 }}>Empilhável</span>}
                                  </>
                                )}
                              </div>
                              <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--muted)' }}>
                                <div><strong style={{ color: 'var(--text)' }}>{item.quantidade} un</strong></div>
                                <div>{item.peso.toFixed(1)} kg</div>
                              </div>
                            </div>
                          ))}
                          <div style={{ display: 'flex', gap: 14, marginTop: 12, padding: '10px 12px', background: 'var(--surface2)', borderRadius: 8 }}>
                            <CheckCircle size={14} color="var(--green)" />
                            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                              Área de piso restante: <strong style={{ color: 'var(--text)' }}>{truck.area_livre.toFixed(2)} m²</strong>
                              &nbsp;·&nbsp; Peso total: <strong style={{ color: 'var(--text)' }}>{truck.peso_acumulado.toFixed(2)} kg</strong>
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
