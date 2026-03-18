import { useState } from 'react'
import { useStocks } from '../../hooks/useStocks'
import { addStock, updateStockDirect, toggleStockActive, deleteStock } from '../../services/adminService'
import PriceTag from '../common/PriceTag'
import LoadingSpinner from '../common/LoadingSpinner'
import toast from 'react-hot-toast'

const SEED_STOCKS = [
  { symbol: 'ITC',        name: 'ITC Limited' },
  { symbol: 'HDFCBANK',   name: 'HDFC Bank' },
  { symbol: 'INFY',       name: 'Infosys' },
  { symbol: 'MAZDOCK',    name: 'Mazagon Dock' },
  { symbol: 'BHARTIARTL', name: 'Bharti Airtel' },
  { symbol: 'ZOMATO',     name: 'Zomato' },
  { symbol: 'WAAREEENER', name: 'Waaree Energies' },
  { symbol: 'SHYAMMETL',  name: 'Shyam Metallics' },
  { symbol: 'OLAELEC',    name: 'Ola Electric' },
  { symbol: 'MANKIND',    name: 'Mankind Pharma' },
  { symbol: 'EIDPARRY',   name: 'EID Parry' },
  { symbol: 'DLF',        name: 'DLF Limited' },
  { symbol: 'LEMONTREE',  name: 'Lemontree Hotels' },
  { symbol: 'AMARAJABAT', name: 'Amara Raja' },
  { symbol: 'INDEGENE',   name: 'Indegene' },
  { symbol: 'GOLDBEES',   name: 'Nippon Gold ETF' },
  { symbol: 'BIRET',      name: 'BIRET' },
  { symbol: 'CRUDEOIL',   name: 'Crude Oil' },
]

function EditRow({ stock }) {
  const [price, setPrice] = useState(String(stock.current_price))
  const [inv, setInv]     = useState(String(stock.broker_inventory))
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      await updateStockDirect({ symbol: stock.symbol, currentPrice: parseFloat(price), brokerInventory: parseInt(inv, 10) })
      toast.success(`${stock.symbol} updated`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="table-row" style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1.5fr 1.5fr auto', alignItems: 'center', gap: 10 }}>
      <div>
        <div style={{ fontWeight: 600, color: '#e2e8f4', fontSize: 13.5 }}>{stock.symbol}</div>
        <div style={{ fontSize: 11, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{stock.name}</div>
      </div>
      <div><PriceTag price={stock.current_price} changePercent={stock.price_change_percent} size="sm" /></div>
      <div>
        <input type="number" value={price} onChange={(e) => setPrice(e.target.value)}
          className="input-field" style={{ fontSize: 12.5, padding: '7px 10px' }} placeholder="Price" />
      </div>
      <div>
        <input type="number" value={inv} onChange={(e) => setInv(e.target.value)}
          className="input-field" style={{ fontSize: 12.5, padding: '7px 10px' }} placeholder="Inventory" />
      </div>
      <div style={{ display: 'flex', gap: 5 }}>
        <button onClick={save} disabled={saving} className="btn-primary" style={{ padding: '7px 14px', fontSize: 12 }}>
          {saving ? '…' : 'Save'}
        </button>
        <button
          onClick={async () => {
            try { await toggleStockActive(stock.symbol, !stock.is_active); toast.success(`${stock.symbol} ${stock.is_active ? 'hidden' : 'shown'}`) }
            catch (err) { toast.error(err.message) }
          }}
          className="btn-ghost" style={{ padding: '7px 10px', fontSize: 12 }}
        >{stock.is_active ? 'Hide' : 'Show'}</button>
        <button
          onClick={async () => {
            if (window.confirm(`Delete ${stock.symbol}?`)) {
              try { await deleteStock(stock.symbol); toast.success(`${stock.symbol} deleted`) }
              catch (err) { toast.error(err.message) }
            }
          }}
          className="btn-danger" style={{ padding: '7px 10px', fontSize: 12 }}
        >✕</button>
      </div>
    </div>
  )
}

export default function StockManager() {
  const { stocks, loading } = useStocks()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ symbol: '', name: '', price: '', inventory: '' })
  const [adding, setAdding] = useState(false)
  const [seeding, setSeeding] = useState(false)

  async function handleAdd(e) {
    e.preventDefault()
    setAdding(true)
    try {
      await addStock({ symbol: form.symbol, name: form.name, currentPrice: parseFloat(form.price), brokerInventory: parseInt(form.inventory, 10) })
      toast.success(`${form.symbol.toUpperCase()} added`)
      setForm({ symbol: '', name: '', price: '', inventory: '' })
      setShowAdd(false)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setAdding(false)
    }
  }

  async function seedAllStocks() {
    setSeeding(true)
    try {
      for (const s of SEED_STOCKS) {
        await addStock({ symbol: s.symbol, name: s.name, currentPrice: 100, brokerInventory: 500 })
      }
      toast.success('18 stocks seeded — set real prices in the table below')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSeeding(false)
    }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }} className="fade-up">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Instruments</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f4' }}>Stock Manager</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {stocks.length === 0 && (
            <button onClick={seedAllStocks} disabled={seeding} className="btn-secondary">
              {seeding ? 'Seeding…' : 'Seed 18 Stocks'}
            </button>
          )}
          <button onClick={() => setShowAdd(!showAdd)} className="btn-primary">+ Add Stock</button>
        </div>
      </div>

      {showAdd && (
        <div className="card" style={{ padding: '20px 22px', marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>Add New Stock</div>
          <form onSubmit={handleAdd} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr', gap: 10 }}>
            <input required className="input-field" placeholder="Symbol" value={form.symbol}
              onChange={(e) => setForm({ ...form, symbol: e.target.value.toUpperCase() })} />
            <input required className="input-field" placeholder="Full Name" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input required type="number" min="0.01" step="0.01" className="input-field" placeholder="Initial Price"
              value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            <input required type="number" min="0" className="input-field" placeholder="Inventory"
              value={form.inventory} onChange={(e) => setForm({ ...form, inventory: e.target.value })} />
            <div style={{ gridColumn: '1/-1', display: 'flex', gap: 8 }}>
              <button type="submit" disabled={adding} className="btn-primary">{adding ? 'Adding…' : 'Add Stock'}</button>
              <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="table-header" style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1.5fr 1.5fr auto', gap: 10 }}>
          <span>Stock</span>
          <span>Current Price</span>
          <span>New Price</span>
          <span>Inventory</span>
          <span>Actions</span>
        </div>
        {stocks.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#2a3a55', fontSize: 13 }}>
            No stocks yet — use "Seed 18 Stocks" or add manually
          </div>
        ) : (
          stocks.map((stock) => <EditRow key={stock.symbol} stock={stock} />)
        )}
      </div>
    </div>
  )
}
