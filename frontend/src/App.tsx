import { useState, useEffect } from 'react'
import { api, Stats } from './api'
import Dashboard from './pages/Dashboard'
import ProductsPage from './pages/ProductsPage'
import TrucksPage from './pages/TrucksPage'
import OrdersPage from './pages/OrdersPage'
import ImportPage from './pages/ImportPage'
import CalculatorPage from './pages/CalculatorPage'
import { Truck, Package, ShoppingCart, Upload, Calculator, LayoutDashboard } from 'lucide-react'
import './App.css'

type Page = 'dashboard' | 'products' | 'trucks' | 'orders' | 'import' | 'calculator'

const NAV: { id: Page; label: string; Icon: React.FC<{size?: string | number}> }[] = [
  { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { id: 'products', label: 'Produtos', Icon: Package },
  { id: 'trucks', label: 'Frotas', Icon: Truck },
  { id: 'orders', label: 'Pedidos', Icon: ShoppingCart },
  { id: 'import', label: 'Importar', Icon: Upload },
  { id: 'calculator', label: 'Calculadora', Icon: Calculator },
]

export default function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [stats, setStats] = useState<Stats | null>(null)

  const refreshStats = () => api.stats().then(setStats).catch(() => {})

  useEffect(() => { refreshStats() }, [page])

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Truck size={22} color="#4f8ef7" />
          <span>SAD-Exp</span>
        </div>
        <nav className="sidebar-nav">
          {NAV.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={`nav-item ${page === id ? 'active' : ''}`}
              onClick={() => setPage(id)}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        {stats && (
          <div className="sidebar-stats">
            <div className="stat-mini"><span>{stats.products}</span><label>Produtos</label></div>
            <div className="stat-mini"><span>{stats.trucks}</span><label>Carretas</label></div>
            <div className="stat-mini"><span>{stats.orders}</span><label>Pedidos</label></div>
          </div>
        )}
      </aside>
      <main className="main-content">
        {page === 'dashboard' && <Dashboard stats={stats} onNavigate={setPage} />}
        {page === 'products' && <ProductsPage onRefresh={refreshStats} />}
        {page === 'trucks' && <TrucksPage onRefresh={refreshStats} />}
        {page === 'orders' && <OrdersPage onRefresh={refreshStats} />}
        {page === 'import' && <ImportPage onRefresh={refreshStats} />}
        {page === 'calculator' && <CalculatorPage />}
      </main>
    </div>
  )
}
