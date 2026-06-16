import { useState, useEffect } from 'react'
import { api, Order, OrderInput, Product } from '../api'
import { Plus, Pencil, Trash2, ShoppingCart, X } from 'lucide-react'

interface Props { onRefresh: () => void }
const EMPTY: OrderInput = { num_venda: '', cliente: '', produtos: {} }

export default function OrdersPage({ onRefresh }: Props) {
  const [orders, setOrders] = useState<Order[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<null | 'create' | Order>(null)
  const [form, setForm] = useState<OrderInput>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [newCode, setNewCode] = useState('')
  const [newQty, setNewQty] = useState(1)

  const load = () => {
    setLoading(true)
    Promise.all([api.listOrders(), api.listProducts()])
      .then(([o, p]) => { setOrders(o); setProducts(p) })
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const openCreate = () => { setForm(EMPTY); setError(''); setModal('create') }
  const openEdit = (o: Order) => { setForm({ num_venda: o.num_venda, cliente: o.cliente, produtos: { ...o.produtos } }); setError(''); setModal(o) }

  const addItem = () => {
    if (!newCode) return
    setForm(f => ({ ...f, produtos: { ...f.produtos, [newCode]: (f.produtos[newCode] || 0) + newQty } }))
    setNewCode(''); setNewQty(1)
  }

  const removeItem = (code: string) => {
    setForm(f => {
      const p = { ...f.produtos }; delete p[code]; return { ...f, produtos: p }
    })
  }

  const save = async () => {
    setSaving(true); setError('')
    try {
      if (modal === 'create') await api.createOrder(form)
      else await api.updateOrder((modal as Order).id, form)
      load(); onRefresh(); setModal(null)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Error') }
    finally { setSaving(false) }
  }

  const del = async (id: number) => {
    if (!confirm('Remover este pedido?')) return
    await api.deleteOrder(id); load(); onRefresh()
  }

  const getProductName = (code: string) => {
    const p = products.find(x => String(x.codigo) === String(code))
    return p ? p.nome : `Código ${code}`
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Materiais de Pedidos</div>
          <div className="page-subtitle">{orders.length} pedido(s) cadastrado(s)</div>
        </div>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={15} /> Novo Pedido</button>
      </div>

      <div className="card">
        {loading ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Carregando...</div>
          : orders.length === 0 ? (
            <div className="empty-state">
              <ShoppingCart size={40} />
              <p>Nenhum pedido cadastrado.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>N° Venda</th>
                    <th>Cliente</th>
                    <th>Itens</th>
                    <th>Data</th>
                    <th style={{ width: 80 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o => (
                    <tr key={o.id}>
                      <td><span className="badge badge-blue">{o.num_venda}</span></td>
                      <td style={{ fontWeight: 600 }}>{o.cliente}</td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {Object.entries(o.produtos).slice(0, 3).map(([code, qty]) => (
                            <span key={code} style={{ background: 'var(--surface2)', borderRadius: 5, padding: '2px 7px', fontSize: 11 }}>
                              {getProductName(code)}: {qty}
                            </span>
                          ))}
                          {Object.keys(o.produtos).length > 3 && (
                            <span style={{ fontSize: 11, color: 'var(--muted)' }}>+{Object.keys(o.produtos).length - 3} mais</span>
                          )}
                        </div>
                      </td>
                      <td style={{ color: 'var(--muted)', fontSize: 12 }}>{new Date(o.created_at).toLocaleDateString('pt-BR')}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => openEdit(o)}><Pencil size={12} /></button>
                          <button className="btn btn-danger btn-sm" onClick={() => del(o.id)}><Trash2 size={12} /></button>
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
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" style={{ width: 580 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">{modal === 'create' ? 'Novo Pedido' : 'Editar Pedido'}</div>
            <div className="form-grid form-grid-2">
              <div className="form-group">
                <label>N° da Venda</label>
                <input value={form.num_venda} onChange={e => setForm(f => ({ ...f, num_venda: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Cliente</label>
                <input value={form.cliente} onChange={e => setForm(f => ({ ...f, cliente: e.target.value }))} />
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Produtos do Pedido</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <select
                  value={newCode}
                  onChange={e => setNewCode(e.target.value)}
                  style={{ flex: 1, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 10px', color: 'var(--text)' }}
                >
                  <option value="">Selecione um produto...</option>
                  {products.map(p => (
                    <option key={p.codigo} value={String(p.codigo)}>{p.codigo} — {p.nome}</option>
                  ))}
                </select>
                <input type="number" min={1} value={newQty} onChange={e => setNewQty(+e.target.value)}
                  style={{ width: 70, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 10px', color: 'var(--text)' }} />
                <button className="btn btn-primary" onClick={addItem}><Plus size={14} /></button>
              </div>

              {Object.keys(form.produtos).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--muted)', fontSize: 13 }}>Nenhum produto adicionado</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {Object.entries(form.produtos).map(([code, qty]) => (
                    <div key={code} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface2)', borderRadius: 7, padding: '8px 12px' }}>
                      <span className="badge badge-blue">{code}</span>
                      <span style={{ flex: 1, fontSize: 13 }}>{getProductName(code)}</span>
                      <span style={{ fontWeight: 700 }}>×{qty}</span>
                      <button onClick={() => removeItem(code)} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer' }}><X size={14} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error && <div className="alert alert-error" style={{ marginTop: 14 }}>{error}</div>}
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
