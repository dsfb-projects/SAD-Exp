import { Stats } from '../api'
import { Package, Truck, ShoppingCart, Calculator, ArrowRight, TrendingUp } from 'lucide-react'

type Page = 'dashboard' | 'products' | 'trucks' | 'orders' | 'import' | 'calculator'

interface Props { stats: Stats | null; onNavigate: (p: Page) => void }

export default function Dashboard({ stats, onNavigate }: Props) {
  const cards = [
    { label: 'Produtos Cadastrados', value: stats?.products ?? '—', icon: Package, color: '#4f8ef7', page: 'products' as Page },
    { label: 'Carretas na Frota', value: stats?.trucks ?? '—', icon: Truck, color: '#7c5dfa', page: 'trucks' as Page },
    { label: 'Materiais de projetos', value: stats?.orders ?? '—', icon: ShoppingCart, color: '#22c55e', page: 'orders' as Page },
    { label: 'Área Total da Frota', value: stats ? `${stats.total_fleet_area.toFixed(1)} m²` : '—', icon: TrendingUp, color: '#f59e0b', page: 'trucks' as Page },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-subtitle">Visão geral do sistema de distribuição</div>
        </div>
        <button className="btn btn-primary" onClick={() => onNavigate('calculator')}>
          <Calculator size={16} /> Calcular Carga
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
        {cards.map(({ label, value, icon: Icon, color, page }) => (
          <div key={label} className="card" style={{ cursor: 'pointer', transition: 'border 0.15s' }}
            onClick={() => onNavigate(page)}
            onMouseEnter={e => (e.currentTarget.style.borderColor = color)}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>{label}</div>
              </div>
              <div style={{ background: `${color}20`, borderRadius: 10, padding: 10 }}>
                <Icon size={20} color={color} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 16, fontSize: 15 }}>Fluxo de Trabalho</div>
          {[
            { step: '1', label: 'Cadastre os produtos', desc: 'Dimensões, peso e se é empilhável', page: 'products' as Page },
            { step: '2', label: 'Configure a frota', desc: 'Adicione suas carretas com área base', page: 'trucks' as Page },
            { step: '3', label: 'Registre os pedidos', desc: 'Ou importe via planilha Excel', page: 'orders' as Page },
            { step: '4', label: 'Calcule o carregamento', desc: 'Distribuição automática por carreta', page: 'calculator' as Page },
          ].map(({ step, label, desc, page }) => (
            <div key={step} style={{ display: 'flex', gap: 12, marginBottom: 14, alignItems: 'flex-start' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(79,142,247,0.15)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{step}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{label}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{desc}</div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => onNavigate(page)}>
                <ArrowRight size={12} />
              </button>
            </div>
          ))}
        </div>

        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 16, fontSize: 15 }}>Importação Excel</div>
          <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
            Importe planilhas Excel com produtos e pedidos de venda diretamente para o banco de dados.
            O sistema detecta automaticamente as colunas e salva os dados.
          </p>
          <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '12px 14px', marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>COLUNAS ESPERADAS — PRODUTOS</div>
            <code style={{ fontSize: 12, color: 'var(--accent)' }}>Código, Item, Area (m²), Peso (kg), Empilhável (s/n)</code>
          </div>
          <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>COLUNAS ESPERADAS — PEDIDOS</div>
            <code style={{ fontSize: 12, color: 'var(--accent)' }}>N° da Venda, Cliente, Produtos</code>
          </div>
          <button className="btn btn-primary" onClick={() => onNavigate('import')}>
            Ir para Importação <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
