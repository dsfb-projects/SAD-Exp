import { useState, useRef } from 'react'
import { api, TotvsPreview } from '../api'
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle, Package, ShoppingCart, FileText, ChevronDown, ChevronUp, Plus, X } from 'lucide-react'

interface Props { onRefresh: () => void }

interface ImportResult {
  ok?: boolean
  upserted?: number
  inserted?: number
  errors?: string[]
  error?: string
}

type Tab = 'products' | 'totvs' | 'orders'

export default function ImportPage({ onRefresh }: Props) {
  const [tab, setTab] = useState<Tab>('totvs')

  // Excel import state
  const [dragging, setDragging] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // TOTVS state
  const [totvsFile, setTotvsFile] = useState<File | null>(null)
  const [totvsDragging, setTotvsDragging] = useState(false)
  const [numProjeto, setNumProjeto] = useState('')
  const [cliente, setCliente] = useState('')
  const [totvsLoading, setTotvsLoading] = useState(false)
  const [totvsPreview, setTotvsPreview] = useState<TotvsPreview | null>(null)
  const [totvsError, setTotvsError] = useState('')
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [confirmSuccess, setConfirmSuccess] = useState(false)
  const [showSuppressed, setShowSuppressed] = useState(false)
  const totvsRef = useRef<HTMLInputElement>(null)

  // Quick-add product state
  const [quickAdd, setQuickAdd] = useState<{ descricao: string; qtd: number } | null>(null)
  const [qaForm, setQaForm] = useState({ codigo: 0, area_m2: 0, peso_kg: 0, empilhavel: false, miscelanea: false })
  const [qaSaving, setQaSaving] = useState(false)
  const [qaError, setQaError] = useState('')

  // ── Excel handlers ──────────────────────────────────────────────────────────
  const handleExcelFile = async (file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setResult({ error: 'Apenas arquivos .xlsx ou .xls são aceitos.' }); return
    }
    setLoading(true); setResult(null)
    try {
      const res = tab === 'products'
        ? await api.importProductsExcel(file)
        : await api.importOrdersExcel(file)
      setResult(res)
      if (res.ok) onRefresh()
    } catch { setResult({ error: 'Erro ao processar arquivo.' }) }
    finally { setLoading(false) }
  }

  const onExcelDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]; if (f) handleExcelFile(f)
  }

  // ── TOTVS handlers ──────────────────────────────────────────────────────────
  const handleTotvsFile = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setTotvsError('Apenas arquivos .csv são aceitos.'); return
    }
    setTotvsFile(file); setTotvsPreview(null); setTotvsError(''); setConfirmSuccess(false)
  }

  const onTotvsDrop = (e: React.DragEvent) => {
    e.preventDefault(); setTotvsDragging(false)
    const f = e.dataTransfer.files[0]; if (f) handleTotvsFile(f)
  }

  const runTotvsPreview = async () => {
    if (!totvsFile) return
    setTotvsLoading(true); setTotvsError(''); setTotvsPreview(null); setConfirmSuccess(false)
    try {
      const res: TotvsPreview = await api.importTotvs(totvsFile, numProjeto, cliente)
      if (!res.ok) { setTotvsError((res as unknown as {error:string}).error || 'Erro'); return }
      setTotvsPreview(res)
      if (res.num_projeto && !numProjeto) setNumProjeto(res.num_projeto)
    } catch (e: unknown) {
      setTotvsError(e instanceof Error ? e.message : 'Erro ao processar CSV')
    } finally { setTotvsLoading(false) }
  }

  const openQuickAdd = (item: { descricao: string; qtd: number }) => {
    setQuickAdd(item)
    setQaForm({ codigo: Math.floor(Date.now() % 100000), area_m2: 0, peso_kg: 0, empilhavel: false, miscelanea: false })
    setQaError('')
  }

  const saveQuickAdd = async () => {
    if (!quickAdd) return
    setQaSaving(true); setQaError('')
    try {
      await api.createProduct({
        codigo: qaForm.codigo,
        item: quickAdd.descricao,
        nome: quickAdd.descricao,
        area_m2: qaForm.area_m2,
        peso_kg: qaForm.peso_kg,
        empilhavel: qaForm.empilhavel,
        miscelanea: qaForm.miscelanea,
      })
      setQuickAdd(null)
      onRefresh()
      // Re-run preview with the same file
      if (totvsFile) {
        setTotvsLoading(true); setTotvsError(''); setConfirmSuccess(false)
        try {
          const res: TotvsPreview = await api.importTotvs(totvsFile, numProjeto, cliente)
          if (res.ok) setTotvsPreview(res)
        } catch { /* keep existing preview */ }
        finally { setTotvsLoading(false) }
      }
    } catch (e: unknown) {
      setQaError(e instanceof Error ? e.message : 'Erro ao cadastrar produto')
    } finally { setQaSaving(false) }
  }

  const confirmTotvs = async () => {
    if (!totvsPreview || totvsPreview.matched.length === 0) return
    setConfirmLoading(true)
    try {
      const produtos: Record<string, number> = {}
      totvsPreview.matched.forEach(m => { produtos[String(m.codigo)] = m.qtd })
      await api.createOrder({
        num_venda: numProjeto || totvsPreview.num_projeto,
        cliente: cliente || totvsPreview.cliente,
        produtos,
      })
      setConfirmSuccess(true); onRefresh()
    } catch (e: unknown) {
      setTotvsError(e instanceof Error ? e.message : 'Erro ao criar projeto')
    } finally { setConfirmLoading(false) }
  }

  // ── Style helpers ──────────────────────────────────────────────────────────
  const tabStyle = (t: Tab) => ({
    padding: '10px 20px', border: 'none',
    background: tab === t ? 'var(--accent)' : 'var(--surface2)',
    color: tab === t ? '#fff' : 'var(--muted)',
    borderRadius: 7, fontWeight: 600, fontSize: 13, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 7,
  } as React.CSSProperties)

  const excelSpecs = tab === 'products'
    ? { cols: ['Código', 'Item', 'Area (m²)', 'Peso (kg)', 'Empilhável (s/n)'], notes: ['Código: número inteiro único', 'Item: ex. "001 - Nome do Produto"', 'Empilhável: sim/s/true', 'Mesmo código = atualiza (upsert)'] }
    : { cols: ['N° do Projeto', 'Cliente', 'Produtos'], notes: ['Produtos: dicionário ex. {"46": 10, "52": 5}', 'Cada linha vira um projeto no banco'] }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Importar</div>
          <div className="page-subtitle">Carregue dados de planilhas e extrações do TOTVS</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button style={tabStyle('totvs')} onClick={() => { setTab('totvs'); setResult(null) }}>
          <FileText size={15} /> TOTVS (CSV)
        </button>
        <button style={tabStyle('products')} onClick={() => { setTab('products'); setResult(null) }}>
          <Package size={15} /> Produtos (Excel)
        </button>
        <button style={tabStyle('orders')} onClick={() => { setTab('orders'); setResult(null) }}>
          <ShoppingCart size={15} /> Projetos (Excel)
        </button>
      </div>

      {/* ── TOTVS TAB ────────────────────────────────────────────────────── */}
      {tab === 'totvs' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
          <div>
            {/* File drop zone */}
            <div
              className="card"
              style={{ border: `2px dashed ${totvsDragging ? 'var(--accent)' : 'var(--border)'}`, textAlign: 'center', padding: '36px 24px', cursor: 'pointer', background: totvsDragging ? 'rgba(79,142,247,0.05)' : 'var(--surface)', marginBottom: 16 }}
              onDragOver={e => { e.preventDefault(); setTotvsDragging(true) }}
              onDragLeave={() => setTotvsDragging(false)}
              onDrop={onTotvsDrop}
              onClick={() => totvsRef.current?.click()}
            >
              <input ref={totvsRef} type="file" accept=".csv" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleTotvsFile(f); e.target.value = '' }} />
              <FileText size={40} style={{ color: 'var(--accent)', marginBottom: 10, opacity: 0.7 }} />
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                {totvsFile ? totvsFile.name : 'Arraste o CSV do TOTVS ou clique para selecionar'}
              </div>
              <div style={{ color: 'var(--muted)', fontSize: 12 }}>Exportação de lista de materiais — formato .csv</div>
              {!totvsFile && (
                <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={e => { e.stopPropagation(); totvsRef.current?.click() }}>
                  <Upload size={14} /> Selecionar CSV
                </button>
              )}
            </div>

            {/* Fields + action */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>N° do Projeto <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(auto-detectado)</span></label>
                  <input value={numProjeto} onChange={e => setNumProjeto(e.target.value)} placeholder="ex: 55572" />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Cliente</label>
                  <input value={cliente} onChange={e => setCliente(e.target.value)} placeholder="ex: TRANSENER" />
                </div>
              </div>
              <button className="btn btn-primary" onClick={runTotvsPreview} disabled={!totvsFile || totvsLoading}>
                {totvsLoading ? 'Processando...' : <><FileSpreadsheet size={14} /> Analisar CSV</>}
              </button>
            </div>

            {totvsError && (
              <div className="alert alert-error" style={{ marginBottom: 14 }}>
                <AlertTriangle size={16} /><div>{totvsError}</div>
              </div>
            )}

            {confirmSuccess && (
              <div className="alert alert-success" style={{ marginBottom: 14 }}>
                <CheckCircle size={16} /><div><strong>Projeto criado com sucesso!</strong></div>
              </div>
            )}

            {/* Preview */}
            {totvsPreview && !confirmSuccess && (
              <div>
                {/* Matched */}
                <div className="card" style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <CheckCircle size={16} color="#22c55e" />
                    <span style={{ fontWeight: 700 }}>Encontrados no catálogo ({totvsPreview.matched.length})</span>
                  </div>
                  {totvsPreview.matched.length === 0
                    ? <div style={{ color: 'var(--muted)', fontSize: 13 }}>Nenhum item encontrado no catálogo.</div>
                    : (
                      <div className="table-wrap">
                        <table>
                          <thead><tr><th>Produto</th><th>Área m²</th><th>Peso kg</th><th>Qtd</th></tr></thead>
                          <tbody>
                            {totvsPreview.matched.map(m => (
                              <tr key={m.codigo}>
                                <td>{m.nome}</td>
                                <td>{m.area_m2.toFixed(2)}</td>
                                <td>{m.peso_kg.toFixed(1)}</td>
                                <td><span className="badge badge-blue">{m.qtd}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  }
                </div>

                {/* Unmatched */}
                {totvsPreview.unmatched.length > 0 && (
                  <div className="card" style={{ marginBottom: 12, borderColor: '#f59e0b' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <AlertTriangle size={16} color="#f59e0b" />
                      <span style={{ fontWeight: 700 }}>Não encontrados no catálogo ({totvsPreview.unmatched.length})</span>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>— clique em Cadastrar para adicionar</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {totvsPreview.unmatched.map((u, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface2)', borderRadius: 6, padding: '7px 12px', fontSize: 13, gap: 8 }}>
                          <span style={{ flex: 1 }}>{u.descricao}</span>
                          <span style={{ fontWeight: 600, color: 'var(--muted)', marginRight: 8 }}>×{u.qtd}</span>
                          <button className="btn btn-primary btn-sm" onClick={() => openQuickAdd(u)} style={{ fontSize: 11, padding: '4px 10px' }}>
                            <Plus size={11} /> Cadastrar
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suppressed (collapsible) */}
                {totvsPreview.suppressed.length > 0 && (
                  <div className="card" style={{ marginBottom: 16 }}>
                    <button
                      onClick={() => setShowSuppressed(s => !s)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)', fontSize: 13, padding: 0, width: '100%' }}
                    >
                      {showSuppressed ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      <span>Micro-itens suprimidos ({totvsPreview.suppressed.length} tipos — parafusos, arruelas, conectores)</span>
                    </button>
                    {showSuppressed && (
                      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {totvsPreview.suppressed.map((s, i) => (
                          <div key={i} style={{ fontSize: 12, color: 'var(--muted)', background: 'var(--surface2)', borderRadius: 5, padding: '5px 10px' }}>
                            {s.descricao} <span style={{ fontWeight: 600 }}>×{s.qtd}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Confirm */}
                <button
                  className="btn btn-primary"
                  onClick={confirmTotvs}
                  disabled={confirmLoading || totvsPreview.matched.length === 0}
                  style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
                >
                  {confirmLoading ? 'Criando...' : `Criar Projeto com ${totvsPreview.matched.length} material(is)`}
                </button>
                {totvsPreview.matched.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12, marginTop: 8 }}>
                    Cadastre os produtos não encontrados e reimporte o CSV.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Side info */}
          <div className="card" style={{ height: 'fit-content' }}>
            <div style={{ fontWeight: 700, marginBottom: 14, fontSize: 14 }}>Como funciona</div>
            {[
              { n: '1', t: 'Exporte do TOTVS', d: 'Lista de Materiais de Empenho em formato CSV (sep. ponto-e-vírgula)' },
              { n: '2', t: 'Envie o arquivo', d: 'O sistema lê as colunas Desc.Produto e Qtd. Empenho automaticamente' },
              { n: '3', t: 'Revise o preview', d: 'Itens encontrados no catálogo, itens ausentes e micro-itens suprimidos' },
              { n: '4', t: 'Confirme', d: 'O projeto é criado com os materiais encontrados, pronto para calcular carga' },
            ].map(({ n, t, d }) => (
              <div key={n} style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(79,142,247,0.15)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{n}</div>
                <div><div style={{ fontWeight: 600, fontSize: 13 }}>{t}</div><div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.4 }}>{d}</div></div>
              </div>
            ))}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 8 }}>COLUNAS LIDAS DO CSV</div>
              {['Desc.Produto', 'Qtd. Empenho', 'Produto Pai (N° Projeto)'].map(c => (
                <div key={c} style={{ background: 'var(--surface2)', borderRadius: 5, padding: '5px 9px', marginBottom: 5, fontSize: 12 }}>
                  <code style={{ color: 'var(--accent)' }}>{c}</code>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── QUICK-ADD PRODUCT MODAL ──────────────────────────────────────── */}
      {quickAdd && (
        <div className="modal-overlay" onClick={() => setQuickAdd(null)}>
          <div className="modal" style={{ width: 500 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div className="modal-title" style={{ margin: 0 }}>Cadastrar Produto</div>
              <button onClick={() => setQuickAdd(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label>Nome (do TOTVS)</label>
              <input value={quickAdd.descricao} readOnly style={{ opacity: 0.7 }} />
            </div>
            <div className="form-grid form-grid-2">
              <div className="form-group">
                <label>Código</label>
                <input type="number" value={qaForm.codigo} onChange={e => setQaForm(f => ({ ...f, codigo: +e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Área de piso (m²)</label>
                <input type="number" step="0.001" value={qaForm.area_m2} onChange={e => setQaForm(f => ({ ...f, area_m2: +e.target.value }))} placeholder="ex: 0.533" />
              </div>
              <div className="form-group">
                <label>Peso (kg)</label>
                <input type="number" step="0.1" value={qaForm.peso_kg} onChange={e => setQaForm(f => ({ ...f, peso_kg: +e.target.value }))} />
              </div>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'flex-end' }}>
                <label className="toggle" style={{ marginBottom: 4 }}>
                  <input type="checkbox" checked={qaForm.miscelanea} onChange={e => setQaForm(f => ({ ...f, miscelanea: e.target.checked }))} />
                  <div className="toggle-track"><div className="toggle-thumb" /></div>
                  <span style={{ fontSize: 12 }}>É miscelânea (vai para caixa, não ocupa área)</span>
                </label>
                <label className="toggle">
                  <input type="checkbox" checked={qaForm.empilhavel} onChange={e => setQaForm(f => ({ ...f, empilhavel: e.target.checked }))} />
                  <div className="toggle-track"><div className="toggle-thumb" /></div>
                  <span style={{ fontSize: 12 }}>Empilhável</span>
                </label>
              </div>
            </div>
            {qaError && <div className="alert alert-error" style={{ marginTop: 10 }}>{qaError}</div>}
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 14 }}>
              Após salvar, o preview será atualizado automaticamente.
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setQuickAdd(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveQuickAdd} disabled={qaSaving}>
                {qaSaving ? 'Salvando...' : 'Salvar e atualizar preview'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PRODUCTS / ORDERS EXCEL TAB ───────────────────────────────────── */}
      {(tab === 'products' || tab === 'orders') && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>
          <div>
            <div
              className="card"
              style={{ border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`, textAlign: 'center', padding: '48px 24px', cursor: 'pointer', background: dragging ? 'rgba(79,142,247,0.05)' : 'var(--surface)' }}
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onExcelDrop}
              onClick={() => fileRef.current?.click()}
            >
              <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleExcelFile(f); e.target.value = '' }} />
              {loading ? (
                <><div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div><div style={{ fontWeight: 600 }}>Processando...</div></>
              ) : (
                <>
                  <FileSpreadsheet size={48} style={{ color: 'var(--accent)', marginBottom: 14, opacity: 0.7 }} />
                  <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Arraste o arquivo ou clique para selecionar</div>
                  <div style={{ color: 'var(--muted)', fontSize: 13 }}>Aceita arquivos .xlsx e .xls</div>
                  <button className="btn btn-primary" style={{ marginTop: 18 }} onClick={e => { e.stopPropagation(); fileRef.current?.click() }}>
                    <Upload size={15} /> Selecionar Arquivo
                  </button>
                </>
              )}
            </div>
            {result && (
              <div style={{ marginTop: 14 }}>
                {result.error
                  ? <div className="alert alert-error"><AlertTriangle size={16} /><div><strong>Erro</strong><div>{result.error}</div></div></div>
                  : <div className="alert alert-success"><CheckCircle size={16} /><div>
                    <strong>Importação concluída</strong>
                    <div>{tab === 'products' ? `${result.upserted} produto(s)` : `${result.inserted} projeto(s)`} importado(s)</div>
                    {result.errors && result.errors.length > 0 && (
                      <div style={{ marginTop: 8 }}>{result.errors.slice(0, 5).map((e, i) => <div key={i} style={{ fontSize: 12 }}>• {e}</div>)}</div>
                    )}
                  </div></div>
                }
              </div>
            )}
          </div>
          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 14, fontSize: 14 }}>Estrutura da Planilha</div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase' }}>Colunas obrigatórias</div>
              {excelSpecs.cols.map(c => (
                <div key={c} style={{ background: 'var(--surface2)', borderRadius: 6, padding: '6px 10px', marginBottom: 6, fontSize: 12 }}>
                  <code style={{ color: 'var(--accent)' }}>{c}</code>
                </div>
              ))}
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase' }}>Notas</div>
              {excelSpecs.notes.map(n => <div key={n} style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6, lineHeight: 1.4 }}>• {n}</div>)}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
