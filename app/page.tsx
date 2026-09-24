'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import {
  ArrowDownLeft, ArrowUpRight, BarChart3, Bell, CalendarDays, Check,
  ChevronDown, CircleDollarSign, CreditCard, Home, LayoutDashboard, Menu,
  Plus, Search, Settings, SlidersHorizontal, Sparkles, Tag, Trash2, Users,
  WalletCards, X, Utensils, Car, HeartPulse, GraduationCap, ShoppingCart,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth-client'

type TxType = 'income' | 'expense'
type View = 'inicio' | 'movimientos' | 'analisis' | 'configuracion'
type Transaction = { id: string | number; type: TxType; amount: number; category: string; description: string; user: string; date: string; icon: string; color: string }
type GroupMember = { id: string; name: string; email: string; role: string }
type GroupData = { group: { id: string; name: string; createdBy?: string } | null; members: GroupMember[]; currentUserId: string; currentUser?: { id: string; name: string; email: string } }
const fetcher = (url: string) => fetch(url).then(r => r.ok ? r.json() : [])

const expenseCategories = [
  { name: 'Supermercado', icon: 'shopping', color: '#d7f16a' },
  { name: 'Casa', icon: 'home', color: '#ffb07c' },
  { name: 'Hijos', icon: 'school', color: '#a9d5ff' },
  { name: 'Transporte', icon: 'car', color: '#d9c5ff' },
  { name: 'Personal', icon: 'user', color: '#ffcae5' },
  { name: 'Servicios', icon: 'bolt', color: '#c4edd7' },
  { name: 'Otros', icon: 'tag', color: '#d9d3c7' },
]

const incomeCategories = [
  { name: 'Sueldo', icon: 'wallet', color: '#b9e6c4' },
  { name: 'Ventas', icon: 'shopping', color: '#a9d5ff' },
  { name: 'Otros', icon: 'tag', color: '#d9d3c7' },
]

type Category = { id?: string; name: string; icon: string; color: string; appliesTo: 'income' | 'expense' | 'both' }
const defaultCategories: Category[] = [
  ...expenseCategories.map(category => ({ ...category, appliesTo: 'expense' as const })),
  ...incomeCategories.filter(income => !expenseCategories.some(expense => expense.name === income.name)).map(category => ({ ...category, appliesTo: 'income' as const })),
]
const periodOptions = ['Este mes', 'Mes futuro', 'Últimos 3 meses', 'Últimos 6 meses', 'Todo']

const money = (value: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value).replace('ARS', '$')
const dateLabel = (date: string) => new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short' }).format(new Date(date + 'T12:00:00')).replace('.', '')

function TxIcon({ type, icon, color }: { type: TxType; icon: string; color: string }) {
  const Icon = icon === 'home' ? Home : icon === 'car' ? Car : icon === 'school' ? GraduationCap : icon === 'health' ? HeartPulse : icon === 'food' ? Utensils : icon === 'shopping' ? ShoppingCart : icon === 'wallet' ? WalletCards : Tag
  return <span className="tx-icon" style={{ background: color }}><Icon size={18} strokeWidth={2.2} /></span>
}

export default function Page() {
  const [view, setView] = useState<View>('inicio')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { data: groupData, mutate: mutateGroup } = useSWR<GroupData>('/api/groups', async (url: string) => {
    const response = await fetch(url)
    if (response.status === 401) { window.location.assign('/sign-in'); return { group: null, members: [], currentUserId: '' } }
    if (!response.ok) throw new Error('No se pudo cargar el grupo')
    return response.json()
  })
  const { data: persistedCategories, mutate: mutateCategories } = useSWR<Category[]>('/api/categories', async (url: string) => {
    const response = await fetch(url)
    if (response.status === 401) { window.location.assign('/sign-in'); return [] }
    if (!response.ok) throw new Error('No se pudieron cargar las categorías')
    return response.json()
  })
  const { data: persistedTransactions, mutate } = useSWR<Transaction[]>('/api/transactions', async (url: string) => {
    const response = await fetch(url)
    if (response.status === 401) {
      window.location.assign('/sign-in')
      return []
    }
    if (!response.ok) throw new Error('No se pudieron cargar los movimientos')
    return response.json()
  })
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const customCategories = persistedCategories?.length ? persistedCategories.map(category => ({ name: category.name, icon: category.icon, color: category.color, appliesTo: category.appliesTo as Category['appliesTo'], id: category.id })) : defaultCategories
  const currentUser = groupData?.currentUser ?? { id: '', name: 'Tu cuenta', email: '' }
  const currentMember = groupData?.members.find(member => member.id === groupData.currentUserId)
  const currentUserName = currentMember?.name || currentUser.name
  const currentUserInitial = currentUserName.trim().charAt(0).toUpperCase() || 'T'
  const visibleTransactions = (persistedTransactions ?? []).map(t => ({ ...t, user: t.user || 'Grupo', icon: t.icon || 'tag', color: t.color || '#d7f16a' }))
  const [showForm, setShowForm] = useState(false)
  const [type, setType] = useState<TxType>('expense')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('Supermercado')
  const categoryOptions = customCategories.filter(category => category.appliesTo === type || category.appliesTo === 'both')
  const [description, setDescription] = useState('')
  const [search, setSearch] = useState('')
  const [period, setPeriod] = useState('Este mes')
  const [formMessage, setFormMessage] = useState('')
  const [formError, setFormError] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [movementDate, setMovementDate] = useState('2026-09-21')
  const periodMonths = period === 'Este mes' ? 1 : period === 'Últimos 3 meses' ? 3 : period === 'Últimos 6 meses' ? 6 : Infinity
  const periodStart = useMemo(() => {
    if (!Number.isFinite(periodMonths)) return null
    const start = new Date(2026, 8, 1)
    start.setMonth(start.getMonth() - periodMonths + 1)
    return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`
  }, [periodMonths])
  const futureMonth = '2026-10'
  const inSelectedPeriod = (date: string) => period === 'Mes futuro' ? date.slice(0, 7) >= futureMonth : !periodStart || date.slice(0, 7) >= periodStart
  const current = useMemo(() => visibleTransactions.filter(t => inSelectedPeriod(t.date)), [visibleTransactions, periodStart])
  const income = current.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expenses = current.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const balance = income - expenses
  const expenseGroups = useMemo(() => {
    const map = new Map<string, number>()
    current.filter(t => t.type === 'expense').forEach(t => map.set(t.category, (map.get(t.category) || 0) + t.amount))
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [current])
  const filtered = current.filter(t => `${t.description} ${t.category} ${t.user}`.toLowerCase().includes(search.toLowerCase()))
  const categoryColor = (name: string) => customCategories.find(category => category.name === name)?.color || '#d9d3c7'
  const expenseDonut = useMemo(() => {
    if (!expenses) return 'conic-gradient(#e7e2da 0 100%)'
    let cursor = 0
    const stops = expenseGroups.map(([name, value]) => {
      const next = cursor + (value / expenses) * 100
      const stop = `${categoryColor(name)} ${cursor}% ${next}%`
      cursor = next
      return stop
    })
    return `conic-gradient(${stops.join(', ')})`
  }, [expenseGroups, expenses])
  const monthlyTotals = useMemo(() => {
    const months = new Map<string, { income: number; expense: number }>()
    current.forEach(transaction => {
      const month = transaction.date.slice(0, 7)
      const totals = months.get(month) || { income: 0, expense: 0 }
      totals[transaction.type] += transaction.amount
      months.set(month, totals)
    })
    return [...months.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-6)
  }, [visibleTransactions])
  const maxMonthlyTotal = Math.max(...monthlyTotals.flatMap(([, totals]) => [totals.income, totals.expense]), 1)

  const submit = async () => {
    const numeric = Number(amount)
    if (!Number.isInteger(numeric) || numeric <= 0) { setFormError(true); setFormMessage('Ingresá un monto entero mayor a cero.'); return }
    if (!groupData?.group) { setFormError(true); setFormMessage('No podés guardar movimientos sin un grupo. Creá o unite a uno desde Configuración.'); return }
    setFormMessage(''); setFormError(false); setIsSaving(true)
    const cat = customCategories.find(c => c.name === category)
    const movement = { type, amount: numeric, category, description: description || category, date: movementDate }
    try {
      const response = await fetch('/api/transactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(movement) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) { setFormError(true); setFormMessage(data.error || `No se pudo guardar el movimiento (error ${response.status}).`); return }
      await mutate()
      setTransactions([{ id: data.id || Date.now(), ...movement, user: currentUserName, icon: cat?.icon || 'tag', color: cat?.color || '#ddd' }, ...transactions])
      setAmount(''); setDescription(''); setFormMessage('Movimiento guardado correctamente.'); setFormError(false)
      setTimeout(() => { setShowForm(false); setFormMessage('') }, 900)
    } catch (error) {
      console.error('[v0] Error enviando movimiento:', error)
      setFormError(true); setFormMessage('No pudimos conectar con el servidor. Revisá tu conexión e intentá nuevamente.')
    } finally { setIsSaving(false) }
  }

  return <div className="app-shell">
    <aside className={`sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
      <div className="brand"><span className="brand-mark"><CircleDollarSign size={19} /></span><span>{groupData?.group?.name || 'No tenés grupo activo'}</span></div>
      <div className="group-card"><div className="eyebrow">GRUPO ACTIVO</div><div className="group-name">{groupData?.group?.name || 'Sin grupo'} <ChevronDown size={15} /></div><div className="members">{(groupData?.members || []).slice(0, 3).map((member, index) => <span key={member.id} className={`avatar ${index % 2 ? 'avatar-pink' : 'avatar-dark'}`}>{member.name[0]}</span>)}<span className="member-count">{groupData?.members.length || 0} integrantes</span></div></div>
      <nav className="side-nav">{([['inicio', LayoutDashboard, 'Inicio'], ['movimientos', ArrowDownLeft, 'Movimientos'], ['analisis', BarChart3, 'Análisis'], ['configuracion', Settings, 'Configuración']] as const).map(([id, Icon, label]) => <button key={id} className={view === id ? 'nav-item active' : 'nav-item'} onClick={() => { setView(id); setMobileMenuOpen(false) }}><Icon size={19} />{label}</button>)}</nav>
      <div className="sidebar-bottom"><div className="budget-mini"><div className="eyebrow">PRESUPUESTO DEL MES</div><strong>{money(expenses)}</strong><div className="progress"><span style={{ width: expenses ? '72%' : '0%' }} /></div><small>{expenses ? '72% utilizado' : 'Sin movimientos todavía'}</small></div><div className="profile"><span className="avatar avatar-dark">{currentUserInitial}</span><div><strong>{currentUserName}</strong><small>{groupData?.group ? 'Integrante del grupo' : 'Sin grupo'}</small></div><ChevronDown size={15} /></div></div>
    </aside>
    <main className="main-content">
      <header className="topbar"><button className="mobile-menu" aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'} onClick={() => setMobileMenuOpen(open => !open)}>{mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}</button>{mobileMenuOpen && <button className="mobile-menu-backdrop" aria-label="Cerrar menú" onClick={() => setMobileMenuOpen(false)} />}<div className="mobile-brand"><span className="brand-mark"><CircleDollarSign size={18} /></span>{groupData?.group?.name || 'No tenés grupo activo'}</div><div className="top-actions"><button className="icon-btn" aria-label="Notificaciones"><Bell size={19} /></button><span className="avatar avatar-dark">{currentUserInitial}</span><button className="logout-btn" onClick={async () => { await authClient.signOut(); window.location.assign('/sign-in') }}>Salir</button></div></header>
      <div className="content-wrap">
        <div className="page-heading"><div><div className="breadcrumb">{groupData?.group?.name || 'Sin grupo'} <span>›</span> {view === 'inicio' ? 'Resumen' : view[0].toUpperCase() + view.slice(1)}</div><h1>{view === 'inicio' ? `Buen día, ${currentUserName}` : view === 'movimientos' ? 'Movimientos' : view === 'analisis' ? 'Análisis' : 'Configuración'}</h1><p className="subtitle">{view === 'inicio' ? 'Este es el resumen de tu grupo.' : view === 'movimientos' ? 'Revisá todos los ingresos y gastos del grupo.' : view === 'analisis' ? 'Entendé cómo se mueve el dinero en tu grupo.' : 'Administrá tu grupo y tus preferencias.'}</p></div><div className="heading-actions"><label className="period-control"><span className="sr-only">Período</span><select className="period-select" value={period} onChange={e => setPeriod(e.target.value)}>{periodOptions.map(option => <option key={option}>{option}</option>)}</select><ChevronDown size={15} /></label><Button className="primary-btn" onClick={() => setShowForm(true)}><Plus size={17} /> Movimiento</Button></div></div>

        {view === 'inicio' && <>
          <section className="summary-grid"><div className="summary-card income-card"><div className="card-label"><span className="status-dot green" /> INGRESOS <span className="trend">+12,4%</span></div><strong>{money(income)}</strong><small>vs. mes anterior</small><ArrowUpRight className="card-arrow" size={20} /></div><div className="summary-card expense-card"><div className="card-label"><span className="status-dot orange" /> GASTOS <span className="trend neutral">+8,2%</span></div><strong>{money(expenses)}</strong><small>vs. mes anterior</small><ArrowDownLeft className="card-arrow" size={20} /></div><div className="summary-card balance-card"><div className="card-label"><span className="status-dot purple" /> BALANCE</div><strong>{money(balance)}</strong><small>Disponible este mes</small><Sparkles className="card-arrow" size={20} /></div></section>
          <section className="dashboard-grid"><div className="panel expense-panel"><div className="panel-head"><div><h2>Distribución de gastos</h2><p>{period}</p></div><button className="more-btn" onClick={() => setView('analisis')}>Ver análisis <ArrowUpRight size={15} /></button></div><div className="donut-row"><div className="donut" style={{ background: expenseDonut }}><div><strong>{money(expenses)}</strong><small>Total gastos</small></div></div><div className="legend">{expenseGroups.slice(0, 5).map(([name, value]) => <div className="legend-item" key={name}><span className="legend-dot" style={{ background: categoryColor(name) }} /><span>{name}</span><strong>{Math.round(value / expenses * 100)}%</strong></div>)}</div></div></div><div className="panel budget-panel"><div className="panel-head"><div><h2>Presupuesto</h2><p>Septiembre 2026</p></div><button className="round-icon" aria-label="Editar presupuesto"><SlidersHorizontal size={16} /></button></div>{expenseGroups.length ? expenseGroups.slice(0, 3).map(([name, value]) => <div className="budget-line" key={name}><div><span>{name}</span><strong>{money(value)}</strong></div><div className="progress"><span style={{ width: '100%', background: categoryColor(name) }} /></div><small className="budget-warning">Gasto registrado este mes</small></div>) : <div className="empty-state">Todavía no hay gastos para mostrar.</div>}<button className="text-btn" onClick={() => setView('configuracion')}>Administrar presupuestos <ArrowUpRight size={14} /></button></div></section>
          <section className="panel recent-panel"><div className="panel-head"><div><h2>Movimientos recientes</h2><p>Últimos movimientos de {groupData?.group?.name || 'tu grupo'}</p></div><button className="more-btn" onClick={() => setView('movimientos')}>Ver todos <ArrowUpRight size={15} /></button></div><div className="tx-list">{current.slice(0, 5).map(t => <TransactionRow key={t.id} t={t} />)}</div></section>
        </>}

        {view === 'movimientos' && <section className="panel full-panel"><div className="filters"><div className="search-box"><Search size={17} /><input placeholder="Buscar movimiento..." value={search} onChange={e => setSearch(e.target.value)} /></div><button className="filter-btn"><CalendarDays size={16} /> Fecha <ChevronDown size={14} /></button><button className="filter-btn"><SlidersHorizontal size={16} /> Filtros</button></div><div className="tx-list">{filtered.map(t => <TransactionRow key={t.id} t={t} onDelete={() => { fetch(`/api/transactions?id=${t.id}`, { method: 'DELETE' }).then(() => mutate()); setTransactions(transactions.filter(x => x.id !== t.id)) }} />)}</div></section>}
        {view === 'analisis' && <Analysis expenseGroups={expenseGroups} income={income} expenses={expenses} monthlyTotals={monthlyTotals} maxMonthlyTotal={maxMonthlyTotal} categoryColor={categoryColor} />}
        {view === 'configuracion' && <SettingsView groupData={groupData} mutateGroup={mutateGroup} categories={customCategories} mutateCategories={mutateCategories} />}
      </div>
    </main>
    <nav className="bottom-nav">{([['inicio', LayoutDashboard, 'Inicio'], ['movimientos', ArrowDownLeft, 'Movimientos'], ['analisis', BarChart3, 'Análisis'], ['configuracion', Settings, 'Config.']] as const).map(([id, Icon, label]) => <button className={view === id ? 'active' : ''} key={id} onClick={() => setView(id)}><Icon size={20} /><span>{label}</span></button>)}</nav>
    {showForm && <div className="modal-backdrop" onClick={() => setShowForm(false)}><div className="modal" onClick={e => e.stopPropagation()}><div className="modal-head"><div><h2>Nuevo movimiento</h2><p>Se agregará a {groupData?.group?.name || 'tu grupo'}</p></div><button className="close-btn" onClick={() => setShowForm(false)}><X size={19} /></button></div><div className="type-toggle"><button className={type === 'expense' ? 'selected expense' : ''} onClick={() => { setType('expense'); setCategory('Supermercado') }}>Gasto</button><button className={type === 'income' ? 'selected income' : ''} onClick={() => { setType('income'); setCategory('Sueldo') }}>Ingreso</button></div><label>Monto<input className="amount-input" type="number" inputMode="decimal" placeholder="$ 0" value={amount} onChange={e => setAmount(e.target.value)} autoFocus /></label><label>Categoría<select value={category} onChange={e => setCategory(e.target.value)}>{categoryOptions.map(c => <option key={c.name}>{c.name}</option>)}</select></label><label>Descripción <span className="optional">Opcional</span><input placeholder="Ej. Compra semanal" value={description} onChange={e => setDescription(e.target.value)} /></label><label>Fecha<input type="date" value={movementDate} onChange={e => setMovementDate(e.target.value)} /></label>{formMessage && <div className={formError ? 'form-feedback error' : 'form-feedback success'} role="alert">{formError ? <X size={16} /> : <Check size={16} />}{formMessage}</div>}<button className="save-btn" onClick={submit} disabled={isSaving}>{isSaving ? 'Guardando...' : <><Check size={17} /> Guardar movimiento</>}</button></div></div>}
  </div>
}

function TransactionRow({ t, onDelete }: { t: Transaction; onDelete?: () => void }) { return <div className="tx-row"><TxIcon type={t.type} icon={t.icon} color={t.color} /><div className="tx-info"><strong>{t.category}</strong><span>{t.description}</span></div><div className="tx-user"><span className={`avatar ${t.user === 'Eli' ? 'avatar-pink' : 'avatar-dark'}`}>{t.user[0]}</span><span>{t.user} · {dateLabel(t.date)}</span></div><strong className={t.type === 'income' ? 'tx-amount positive' : 'tx-amount'}>{t.type === 'income' ? '+' : '-'}{money(t.amount)}</strong>{onDelete && <button className="delete-btn" onClick={onDelete} aria-label="Eliminar movimiento"><Trash2 size={16} /></button>}</div> }

function Analysis({ expenseGroups, income, expenses, monthlyTotals, maxMonthlyTotal, categoryColor }: { expenseGroups: [string, number][], income: number, expenses: number, monthlyTotals: [string, { income: number; expense: number }][], maxMonthlyTotal: number, categoryColor: (name: string) => string }) {
  const monthLabel = (month: string) => new Intl.DateTimeFormat('es-AR', { month: 'short' }).format(new Date(`${month}-01T12:00:00`)).replace('.', '')
  return <div className="analysis-grid"><section className="panel analysis-main"><div className="panel-head"><div><h2>Evolución mensual</h2><p>{monthlyTotals.length ? 'Movimientos registrados' : 'Todavía no hay movimientos para analizar'}</p></div><span className="period-select">{monthlyTotals.length ? 'Últimos meses' : 'Sin datos'}</span></div><div className="bar-chart">{monthlyTotals.length ? monthlyTotals.map(([month, totals]) => <div className="bar-group" key={month}><div className="bars"><span className="bar income" style={{ height: `${totals.income / maxMonthlyTotal * 100}%` }} /><span className="bar expense" style={{ height: `${totals.expense / maxMonthlyTotal * 100}%` }} /></div><small>{monthLabel(month)}</small></div>) : <div className="empty-chart">Los gráficos aparecerán cuando registres ingresos o gastos.</div>}</div><div className="chart-legend"><span><i className="green-dot" /> Ingresos</span><span><i className="orange-dot" /> Gastos</span></div></section><section className="panel"><div className="panel-head"><div><h2>Por categoría</h2><p>Gastos de este mes</p></div></div><div className="analysis-list">{expenseGroups.length ? expenseGroups.map(([name, value]) => <div className="analysis-item" key={name}><span className="legend-dot" style={{ background: categoryColor(name) }} /><div><strong>{name}</strong><small>{Math.round(value / expenses * 100)}% del total</small></div><b>{money(value)}</b></div>) : <div className="empty-state">No hay gastos registrados este mes.</div>}</div></section><section className="panel kpi-panel"><div><small>INGRESOS DEL MES</small><strong>{money(income)}</strong></div><div><small>GASTOS DEL MES</small><strong>{money(expenses)}</strong></div><div><small>BALANCE</small><strong>{money(income - expenses)}</strong></div></section></div>
}
function SettingsView({ groupData, mutateGroup, categories, mutateCategories }: { groupData?: GroupData; mutateGroup: () => void; categories: Category[]; mutateCategories: () => void }) {
  const [groupName, setGroupName] = useState('')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryType, setNewCategoryType] = useState<'income' | 'expense' | 'both'>('expense')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [messageError, setMessageError] = useState(false)
  const [settingsTab, setSettingsTab] = useState<'grupo' | 'categorias' | 'presupuesto' | 'preferencias'>('grupo')
  const [budget, setBudget] = useState('')
  const [savedBudget, setSavedBudget] = useState('')
  const [compactMode, setCompactMode] = useState(false)
  const [savedSettings, setSavedSettings] = useState('')
  const saveBudget = () => { setSavedBudget(budget); setSavedSettings('Presupuesto actualizado.') }
  const savePreferences = () => setSavedSettings('Preferencias guardadas.')
  const addCategory = async () => {
    const name = newCategoryName.trim()
    if (!name) return
    const response = await fetch('/api/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, appliesTo: newCategoryType }) })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) { setMessageError(true); setSavedSettings(data.error || 'No se pudo agregar la categoría.'); return }
    await mutateCategories()
    setNewCategoryName('')
    setMessageError(false)
    setSavedSettings('Categoría agregada.')
  }
  const removeCategory = async (category: Category) => {
    if (!category.id || !window.confirm(`¿Eliminar la categoría ${category.name}? Los movimientos pasarán a Otros.`)) return
    const response = await fetch(`/api/categories?id=${encodeURIComponent(category.id)}`, { method: 'DELETE' })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) { setMessageError(true); setSavedSettings(data.error || 'No se pudo eliminar la categoría.'); return }
    await mutateCategories()
    setMessageError(false)
    setSavedSettings('Categoría eliminada. Los movimientos asociados ahora están en Otros.')
  }
  const createGroup = async () => {
    const response = await fetch('/api/groups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: groupName }) })
    const data = await response.json()
    setMessageError(!response.ok); setMessage(response.ok ? 'Grupo creado.' : data.error || 'No se pudo crear el grupo')
    if (response.ok) { setGroupName(''); mutateGroup() }
  }
  const addMember = async () => {
    const response = await fetch('/api/groups', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
    const data = await response.json()
    setMessageError(!response.ok); setMessage(response.ok ? 'Integrante agregado.' : data.error || 'No se pudo agregar')
    if (response.ok) { setEmail(''); mutateGroup() }
  }
  const deleteGroup = async () => {
    if (!window.confirm('¿Eliminar este grupo y sus movimientos?')) return
    const response = await fetch('/api/groups?group=true', { method: 'DELETE' })
    const data = await response.json().catch(() => ({}))
    setMessageError(!response.ok); setMessage(response.ok ? 'Grupo eliminado.' : data.error || 'No se pudo eliminar el grupo')
    if (response.ok) mutateGroup()
  }
  if (!groupData?.group) return <section className="panel settings-content empty-group"><div className="settings-hero"><span className="settings-icon"><Users size={22} /></span><div><span className="eyebrow">ESPACIO COMPARTIDO</span><h2>Creá tu grupo</h2><p>Invitá a las personas de tu grupo y lleven las finanzas juntos, con el mismo nivel de acceso.</p></div></div><div className="settings-form"><label>Nombre del grupo<input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Ej. Casa" /></label><button className="save-btn" onClick={createGroup}><Plus size={17} /> Crear grupo</button></div>{message && <div className={`form-feedback ${messageError ? 'error' : 'success'}`} role="alert">{messageError ? <X size={16} /> : <Check size={16} />}{message}</div>}</section>
  return <div className="settings-grid"><section className="panel settings-nav"><button className={`settings-link ${settingsTab === 'grupo' ? 'active' : ''}`} onClick={() => setSettingsTab('grupo')}><Users size={18} /> Grupo e integrantes</button><button className={`settings-link ${settingsTab === 'categorias' ? 'active' : ''}`} onClick={() => setSettingsTab('categorias')}><Tag size={18} /> Categorías</button><button className={`settings-link ${settingsTab === 'presupuesto' ? 'active' : ''}`} onClick={() => setSettingsTab('presupuesto')}><WalletCards size={18} /> Presupuesto</button><button className={`settings-link ${settingsTab === 'preferencias' ? 'active' : ''}`} onClick={() => setSettingsTab('preferencias')}><Settings size={18} /> Preferencias</button></section><section className="panel settings-content">{settingsTab === 'categorias' && <><div className="panel-head"><div><span className="eyebrow">PERSONALIZÁ TU ESPACIO</span><h2>Categorías</h2><p>Creá categorías y elegí si aplican a ingresos, egresos o ambos.</p></div><Tag size={22} /></div><div className="category-create"><label>Nombre de la categoría<input value={newCategoryName} onChange={event => setNewCategoryName(event.target.value)} placeholder="Ej. Mascotas" /></label><label>Se usa en<select value={newCategoryType} onChange={event => setNewCategoryType(event.target.value as 'income' | 'expense' | 'both')}><option value="expense">Egresos</option><option value="income">Ingresos</option><option value="both">Ingresos y egresos</option></select></label><button className="save-btn" onClick={addCategory}><Plus size={17} /> Agregar categoría</button></div><div className="category-list">{categories.map(category => <div className="category-row" key={category.name}><span className="legend-dot" style={{ background: category.color }} /><div><strong>{category.name}</strong><small>{category.appliesTo === 'both' ? 'Ingresos y egresos' : category.appliesTo === 'income' ? 'Ingresos' : 'Egresos'}</small></div>{!defaultCategories.some(defaultCategory => defaultCategory.name === category.name) && <button className="member-remove" onClick={() => removeCategory(category)} aria-label={`Eliminar categoría ${category.name}`}><Trash2 size={16} /></button>}</div>)}</div>{savedSettings && <div className="form-feedback success" role="status"><Check size={16} />{savedSettings}</div>}</>} {settingsTab === 'grupo' && <><div className="panel-head"><div><span className="eyebrow">ESPACIO COMPARTIDO</span><h2>{groupData.group.name}</h2><p>Todos pueden registrar, eliminar movimientos e invitar integrantes.</p></div>{groupData.group.createdBy === groupData.currentUserId && <button className="danger-btn" onClick={deleteGroup}><Trash2 size={15} /> Eliminar grupo</button>}</div><div className="invite-card"><div><strong>Invitar integrante</strong><small>La persona debe tener una cuenta creada.</small></div><div className="invite-row"><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@ejemplo.com" /><button className="outline-btn" onClick={addMember}><Plus size={16} /> Agregar</button></div></div>{message && <div className={`form-feedback ${messageError ? 'error' : 'success'}`} role="alert">{messageError ? <X size={16} /> : <Check size={16} />}{message}</div>}<div className="members-list">{groupData.members.map((member, index) => <Member key={member.id} name={member.name} email={member.email} role="Integrante" avatar={member.name[0]} dark={index === 0} canRemove={member.id !== groupData.currentUserId} onRemove={async () => { const response = await fetch(`/api/groups?userId=${encodeURIComponent(member.id)}`, { method: 'DELETE' }); const data = await response.json().catch(() => ({})); setMessage(response.ok ? `${member.name} fue quitado del grupo.` : data.error || 'No se pudo quitar al integrante.'); if (response.ok) mutateGroup() }} />)}</div></>}{settingsTab === 'categorias' && <div className="settings-section"><span className="eyebrow">ORGANIZACIÓN</span><h2>Categorías</h2><p>Estas son las categorías disponibles para tus movimientos.</p><div className="category-settings-list">{expenseCategories.map(category => <div className="category-setting" key={category.name}><span className="legend-dot" style={{ background: category.color }} /><strong>{category.name}</strong><small>Egreso</small></div>)}{incomeCategories.map(category => <div className="category-setting" key={`income-${category.name}`}><span className="legend-dot" style={{ background: category.color }} /><strong>{category.name}</strong><small>Ingreso</small></div>)}</div></div>}{settingsTab === 'presupuesto' && <div className="settings-section"><span className="eyebrow">CONTROL MENSUAL</span><h2>Presupuesto</h2><p>Definí un límite de gastos para {groupData.group.name}.</p><label className="settings-field">Límite mensual<input type="number" inputMode="numeric" placeholder="Ej. 500000" value={budget} onChange={e => setBudget(e.target.value)} /></label>{savedBudget && <small className="saved-note">Límite guardado: {money(Number(savedBudget))}</small>}<button className="save-btn" onClick={saveBudget}><Check size={17} /> Guardar presupuesto</button>{savedSettings && <div className="form-feedback success" role="status"><Check size={16} />{savedSettings}</div>}</div>}{settingsTab === 'preferencias' && <div className="settings-section"><span className="eyebrow">PERSONALIZACIÓN</span><h2>Preferencias</h2><p>Elegí cómo querés ver y usar tu espacio.</p><label className="preference-row"><span><strong>Vista compacta</strong><small>Reducir el espacio entre movimientos.</small></span><input type="checkbox" checked={compactMode} onChange={e => setCompactMode(e.target.checked)} /></label><button className="save-btn" onClick={savePreferences}><Check size={17} /> Guardar preferencias</button>{savedSettings && <div className="form-feedback success" role="status"><Check size={16} />{savedSettings}</div>}</div>}</section></div>
}
function Member({ name, email, role, avatar, dark, canRemove, onRemove }: { name: string; email: string; role: string; avatar: string; dark?: boolean; canRemove?: boolean; onRemove?: () => void }) { return <div className="member-row"><span className={`avatar ${dark ? 'avatar-dark' : 'avatar-pink'}`}>{avatar}</span><div><strong>{name}</strong><small>{email}</small></div><span className="role">{role}</span>{canRemove && <button className="member-remove" onClick={() => { if (window.confirm(`¿Quitar a ${name} del grupo?`)) onRemove?.() }} aria-label={`Quitar a ${name}`} title="Quitar integrante"><X size={16} /></button>}</div> }

export const dynamic = 'force-dynamic'

// app page intentionally keeps the first MVP in one client boundary while domain logic remains derived from the shared transaction model.

export {} 

