import { useState, useRef } from 'react'
import { api } from '../api'
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle, Package, ShoppingCart } from 'lucide-react'

interface Props { onRefresh: () => void }

interface ImportResult {
  ok?: boolean
  upserted?: number
  inserted?: number
  errors?: string[]
  error?: string
}

type ImportType = 'products' | 'orders'

export default function ImportPage({ onRefresh }: Props) {
  const [activeTab, setActiveTab] = useState<ImportType>('products')
  const [dragging, setDragging] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setResult({ error: 'Apenas arquivos .xlsx ou .xls são aceitos.' })
      return
    }
    setLoading(true); setResult(null)
    try {
      const res = activeTab === 'products'
        ? await api.importProductsExcel(file)
        : await api.importOrdersExcel(file)
      setResult(res)
      if (res.ok) onRefresh()
    } catch {
      setResult({ error: 'Erro ao processar arquivo.' })
    } finally {
      setLoading(false)
    }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  const tabStyle = (t: ImportType) => ({
    padding: '10px 20px',
    border: 'none',
    background: activeTab === t ? 'var(--accent)' : 'var(--surface2)',
    color: activeTab === t ? '#fff' : 'var(--muted)',
    borderRadius: 7,
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 7,
  } as React.CSSProperties)

  const specs = activeTab === 'products'
    ? { cols: ['Código', 'Item', 'Area (m²)', 'Peso (kg)', 'Empilhável (s/n)'], notes: ['Código: número inteiro único do produto', 'Item: ex. "001 - Nome do Produto"', 'Empilhável: sim/não, s/n, true/false', 'Produtos com mesmo código serão atualizados (upsert)'] }
    : { cols: ['N° da Venda', 'Cliente', 'Produtos'], notes: ['N° da Venda: identificador único do pedido', 'Produtos: dicionário Python ex. {"46": 10, "52": 5}', 'Cada linha vira um pedido no banco de dados'] }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Importar Planilha</div>
          <div className="page-subtitle">Carregue dados via arquivo Excel</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button style={tabStyle('products')} onClick={() => { setActiveTab('products'); setResult(null) }}>
          <Package size={15} /> Produtos
        </button>
        <button style={tabStyle('orders')} onClick={() => { setActiveTab('orders'); setResult(null) }}>
          <ShoppingCart size={15} /> Pedidos de Venda
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>
        <div>
          <div
            className="card"
            style={{
              border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`,
              textAlign: 'center',
              padding: '48px 24px',
              cursor: 'pointer',
              transition: 'border-color 0.2s',
              background: dragging ? 'rgba(79,142,247,0.05)' : 'var(--surface)'
            }}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
          >
            <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={onFileChange} />
            {loading ? (
              <>
                <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Processando...</div>
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>Aguarde enquanto importamos os dados</div>
              </>
            ) : (
              <>
                <FileSpreadsheet size={48} style={{ color: 'var(--accent)', marginBottom: 14, opacity: 0.7 }} />
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
                  Arraste o arquivo ou clique para selecionar
                </div>
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>Aceita arquivos .xlsx e .xls</div>
                <button className="btn btn-primary" style={{ marginTop: 18 }} onClick={e => { e.stopPropagation(); fileRef.current?.click() }}>
                  <Upload size={15} /> Selecionar Arquivo
                </button>
              </>
            )}
          </div>

          {result && (
            <div style={{ marginTop: 14 }}>
              {result.error ? (
                <div className="alert alert-error">
                  <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 600 }}>Erro na importação</div>
                    <div>{result.error}</div>
                  </div>
                </div>
              ) : (
                <div className="alert alert-success">
                  <CheckCircle size={16} style={{ flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 600 }}>Importação concluída</div>
                    <div>
                      {activeTab === 'products' ? `${result.upserted} produto(s) importado(s)` : `${result.inserted} pedido(s) importado(s)`}
                    </div>
                    {result.errors && result.errors.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontWeight: 600 }}>Avisos ({result.errors.length}):</div>
                        {result.errors.slice(0, 5).map((e, i) => <div key={i} style={{ fontSize: 12 }}>• {e}</div>)}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 14, fontSize: 14 }}>
              Estrutura da Planilha
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Colunas obrigatórias</div>
              {specs.cols.map(c => (
                <div key={c} style={{ background: 'var(--surface2)', borderRadius: 6, padding: '6px 10px', marginBottom: 6, fontSize: 12 }}>
                  <code style={{ color: 'var(--accent)' }}>{c}</code>
                </div>
              ))}
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Notas</div>
              {specs.notes.map(n => (
                <div key={n} style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6, lineHeight: 1.4 }}>• {n}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
