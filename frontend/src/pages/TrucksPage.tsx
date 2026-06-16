import { useState, useEffect } from 'react'
import { api, Truck, TruckInput } from '../api'
import { Plus, Pencil, Trash2, Truck as TruckIcon } from 'lucide-react'

interface Props { onRefresh: () => void }
const EMPTY: TruckInput = { id_carreta: '', area_base_m2: 0 }

export default function TrucksPage({ onRefresh }: Props) {
  const [trucks, setTrucks] = useState<Truck[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<null | 'create' | Truck>(null)
  const [form, setForm] = useState<TruckInput>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    api.listTrucks().then(setTrucks).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const openCreate = () => { setForm(EMPTY); setError(''); setModal('create') }
  const openEdit = (t: Truck) => { setForm({ id_carreta: t.id_carreta, area_base_m2: t.area_base_m2 }); setError(''); setModal(t) }

  const save = async () => {
    setSaving(true); setError('')
    try {
      if (modal === 'create') await api.createTruck(form)
      else await api.updateTruck((modal as Truck).id, form)
      load(); onRefresh(); setModal(null)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Error') }
    finally { setSaving(false) }
  }

  const del = async (id: number) => {
    if (!confirm('Remover esta carreta?')) return
    await api.deleteTruck(id); load(); onRefresh()
  }

  const totalArea = trucks.reduce((s, t) => s + t.area_base_m2, 0)

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Carretas</div>
          <div className="page-subtitle">{trucks.length} carreta(s) · {totalArea.toFixed(1)} m² total</div>
        </div>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={15} /> Nova Carreta</button>
      </div>

      <div className="card">
        {loading ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Carregando...</div>
          : trucks.length === 0 ? (
            <div className="empty-state">
              <TruckIcon size={40} />
              <p>Nenhuma carreta cadastrada.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>ID da Carreta</th>
                    <th>Área Base (m²)</th>
                    <th>Capacidade Visual</th>
                    <th style={{ width: 80 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {trucks.map((t, i) => (
                    <tr key={t.id}>
                      <td style={{ color: 'var(--muted)' }}>{i + 1}</td>
                      <td><span style={{ fontWeight: 600 }}>{t.id_carreta}</span></td>
                      <td>{t.area_base_m2.toFixed(2)} m²</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 8, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden', maxWidth: 160 }}>
                            <div style={{ height: '100%', background: 'var(--accent)', borderRadius: 4, width: `${Math.min(100, (t.area_base_m2 / Math.max(...trucks.map(x => x.area_base_m2))) * 100)}%` }} />
                          </div>
                          <span style={{ fontSize: 11, color: 'var(--muted)' }}>{t.area_base_m2} m²</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => openEdit(t)}><Pencil size={12} /></button>
                          <button className="btn btn-danger btn-sm" onClick={() => del(t.id)}><Trash2 size={12} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 13 }}>Nota sobre carretas extras</div>
        <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.6 }}>
          Quando a frota cadastrada esgotar o espaço, a calculadora criará automaticamente <strong style={{ color: 'var(--text)' }}>Carretas Extras</strong> com a mesma área base da primeira carreta da lista. Nenhum pedido ficará sem alocação.
        </p>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">{modal === 'create' ? 'Nova Carreta' : 'Editar Carreta'}</div>
            <div className="form-grid">
              <div className="form-group">
                <label>ID da Carreta</label>
                <input value={form.id_carreta} onChange={e => setForm(f => ({ ...f, id_carreta: e.target.value }))} placeholder="Ex: Carreta 01" />
              </div>
              <div className="form-group">
                <label>Área Base (m²)</label>
                <input type="number" step="0.1" value={form.area_base_m2} onChange={e => setForm(f => ({ ...f, area_base_m2: +e.target.value }))} />
              </div>
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
