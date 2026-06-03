import { useState, useEffect } from 'react'
import { api, Product, ProductInput } from '../api'
import { Plus, Pencil, Trash2, Package, Search } from 'lucide-react'

interface Props { onRefresh: () => void }

const EMPTY: ProductInput = { codigo: 0, item: '', nome: '', area_m2: 0, peso_kg: 0, empilhavel: false }

export default function ProductsPage({ onRefresh }: Props) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<null | 'create' | Product>(null)
  const [form, setForm] = useState<ProductInput>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const load = () => {
    setLoading(true)
    api.listProducts().then(setProducts).finally(() => setLoading(false))
  }

  useEffect(load, [])

  const openCreate = () => { setForm(EMPTY); setError(''); setModal('create') }
  const openEdit = (p: Product) => { setForm({ codigo: p.codigo, item: p.item, nome: p.nome, area_m2: p.area_m2, peso_kg: p.peso_kg, empilhavel: p.empilhavel }); setError(''); setModal(p) }
  const closeModal = () => setModal(null)

  const save = async () => {
    setSaving(true); setError('')
    try {
      if (modal === 'create') {
        await api.createProduct(form)
      } else {
        await api.updateProduct((modal as Product).id, form)
      }
      load(); onRefresh(); closeModal()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  const del = async (id: number) => {
    if (!confirm('Remove this product?')) return
    await api.deleteProduct(id); load(); onRefresh()
  }

  const filtered = products.filter(p =>
    p.nome.toLowerCase().includes(search.toLowerCase()) ||
    p.item.toLowerCase().includes(search.toLowerCase()) ||
    String(p.codigo).includes(search)
  )

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Produtos</div>
          <div className="page-subtitle">{products.length} produto(s) cadastrado(s)</div>
        </div>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={15} /> Novo Produto</button>
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
            <input
              style={{ width: '100%', paddingLeft: 34, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 12px 8px 34px', color: 'var(--text)' }}
              placeholder="Buscar por nome, código..."
              value={search} onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Carregando...</div>
          : filtered.length === 0 ? (
            <div className="empty-state">
              <Package size={40} />
              <p>Nenhum produto encontrado.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Item</th>
                    <th>Área (m²)</th>
                    <th>Peso (kg)</th>
                    <th>Empilhável</th>
                    <th style={{ width: 80 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => (
                    <tr key={p.id}>
                      <td><span className="badge badge-blue">{p.codigo}</span></td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{p.nome}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{p.item}</div>
                      </td>
                      <td>{p.area_m2.toFixed(3)}</td>
                      <td>{p.peso_kg.toFixed(1)}</td>
                      <td>
                        <span className={`badge ${p.empilhavel ? 'badge-green' : 'badge-red'}`}>
                          {p.empilhavel ? 'Sim' : 'Não'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => openEdit(p)}><Pencil size={12} /></button>
                          <button className="btn btn-danger btn-sm" onClick={() => del(p.id)}><Trash2 size={12} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {modal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">{modal === 'create' ? 'Novo Produto' : 'Editar Produto'}</div>
            <div className="form-grid form-grid-2">
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Item Completo</label>
                <input value={form.item} onChange={e => {
                  const item = e.target.value
                  const nome = item.includes('-') ? item.split('-', 1)[1]?.trim() || item : item
                  setForm(f => ({ ...f, item, nome }))
                }} placeholder="Ex: 001 - Nome do Produto" />
              </div>
              <div className="form-group">
                <label>Código</label>
                <input type="number" value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: +e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Nome do Produto</label>
                <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome limpo" />
              </div>
              <div className="form-group">
                <label>Área (m²)</label>
                <input type="number" step="0.001" value={form.area_m2} onChange={e => setForm(f => ({ ...f, area_m2: +e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Peso (kg)</label>
                <input type="number" step="0.1" value={form.peso_kg} onChange={e => setForm(f => ({ ...f, peso_kg: +e.target.value }))} />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Empilhável</label>
                <label className="toggle">
                  <input type="checkbox" checked={form.empilhavel} onChange={e => setForm(f => ({ ...f, empilhavel: e.target.checked }))} />
                  <div className="toggle-track"><div className="toggle-thumb" /></div>
                  <span>{form.empilhavel ? 'Sim — não ocupa área de piso' : 'Não — ocupa área de piso'}</span>
                </label>
              </div>
            </div>
            {error && <div className="alert alert-error" style={{ marginTop: 14 }}>{error}</div>}
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={closeModal}>Cancelar</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
