import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import path from 'path'
import { fileURLToPath } from 'url'
import { PrismaClient } from '@prisma/client'
import { stringify } from 'csv-stringify'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const prisma = new PrismaClient()
const ADMIN_KEY = process.env.ADMIN_KEY || ''

app.use(cors({ origin: true }))
app.use(express.json({ limit: '2mb' }))
app.use(morgan('dev'))

function requireKey(req, res, next) {
  if (!ADMIN_KEY) return res.status(500).json({ error: 'ADMIN_KEY not set on server' })
  const key = req.header('x-key') || req.query.key
  if (key === ADMIN_KEY) return next()
  return res.status(401).json({ error: 'Unauthorised' })
}

app.get('/health', (req, res) => res.json({ ok: true }))

// Seed default Suppliers/Categories if empty
async function ensureSeed() {
  const suppliers = ['Bidfood', 'Booker', 'Adams']
  const categories = ['Meats', 'Drinks', 'Frozen', 'Ambient', 'Veg', 'Sauces', 'Other']
  const sCount = await prisma.supplier.count()
  if (sCount === 0) await prisma.supplier.createMany({ data: suppliers.map(name => ({ name })) })
  const cCount = await prisma.category.count()
  if (cCount === 0) await prisma.category.createMany({ data: categories.map(name => ({ name })) })
}
ensureSeed().catch(console.error)

const includeRelations = { supplier: true, category: true }
const mapItem = (i) => ({
  id: i.id,
  sku: i.sku || '',
  item: i.item,
  quantity: i.quantity,
  price: Number(i.price),
  supplier: i.supplier?.name || i.supplier,
  category: i.category?.name || i.category,
  deletedAt: i.deletedAt,
  createdAt: i.createdAt,
  updatedAt: i.updatedAt,
})
async function findOrCreateByName(model, name) {
  const existing = await prisma[model].findUnique({ where: { name } })
  if (existing) return existing
  return prisma[model].create({ data: { name } })
}

// Suppliers & Categories
app.get('/api/suppliers', async (req, res) => res.json(await prisma.supplier.findMany({ orderBy: { name: 'asc' } })))
app.post('/api/suppliers', requireKey, async (req, res) => {
  const { name } = req.body; if (!name) return res.status(400).json({ error: 'name required' })
  res.status(201).json(await findOrCreateByName('supplier', name))
})
app.get('/api/categories', async (req, res) => res.json(await prisma.category.findMany({ orderBy: { name: 'asc' } })))
app.post('/api/categories', requireKey, async (req, res) => {
  const { name } = req.body; if (!name) return res.status(400).json({ error: 'name required' })
  res.status(201).json(await findOrCreateByName('category', name))
})

// Items CRUD
app.get('/api/items', async (req, res) => {
  try {
    const { supplier, category, q, includeDeleted, sku } = req.query
    const where = {}
    if (supplier) where.supplier = { name: supplier }
    if (category) where.category = { name: category }
    if (q) where.item = { contains: q, mode: 'insensitive' }
    if (sku) where.sku = sku
    if (!includeDeleted || includeDeleted === 'false') where.deletedAt = null
    const items = await prisma.item.findMany({ where, include: includeRelations, orderBy: { createdAt: 'desc' } })
    res.json(items.map(mapItem))
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to fetch items' }) }
})

app.post('/api/items', requireKey, async (req, res) => {
  try {
    let { sku, item, supplier, category, quantity, price } = req.body
    if (!item || !supplier || !category) return res.status(400).json({ error: 'item, supplier, category required' })
    const s = await findOrCreateByName('supplier', supplier)
    const c = await findOrCreateByName('category', category)
    const created = await prisma.item.create({ data: { sku: sku || null, item, quantity: Number(quantity||0), price: Number(price||0), supplierId: s.id, categoryId: c.id } })
    const out = await prisma.item.findUnique({ where: { id: created.id }, include: includeRelations })
    res.status(201).json(mapItem(out))
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to create item' }) }
})

app.patch('/api/items/:id', requireKey, async (req, res) => {
  try {
    const { id } = req.params
    const { sku, item, supplier, category, quantity, price, undelete } = req.body
    const data = {}
    if (sku !== undefined) data.sku = sku || null
    if (item !== undefined) data.item = item
    if (quantity !== undefined) data.quantity = Number(quantity)
    if (price !== undefined) data.price = Number(price)
    if (supplier) { const s = await findOrCreateByName('supplier', supplier); data.supplierId = s.id }
    if (category) { const c = await findOrCreateByName('category', category); data.categoryId = c.id }
    if (undelete) data.deletedAt = null
    const updated = await prisma.item.update({ where: { id }, data, include: includeRelations })
    res.json(mapItem(updated))
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to update item' }) }
})

app.delete('/api/items/:id', requireKey, async (req, res) => {
  try { const { id } = req.params; await prisma.item.update({ where: { id }, data: { deletedAt: new Date() } }); res.json({ ok: true }) }
  catch(e){ console.error(e); res.status(500).json({ error: 'Failed to delete item' }) }
})

app.post('/api/items/:id/undelete', requireKey, async (req, res) => {
  try { const { id } = req.params; const it = await prisma.item.update({ where: { id }, data: { deletedAt: null }, include: includeRelations }); res.json(mapItem(it)) }
  catch(e){ console.error(e); res.status(500).json({ error: 'Failed to undelete item' }) }
})

// Bulk import (JSON rows from client-parsed CSV)
app.post('/api/bulk/items', requireKey, async (req, res) => {
  try {
    const rows = Array.isArray(req.body) ? req.body : []
    const created = []
    for (const r of rows) {
      const s = await findOrCreateByName('supplier', r.supplier)
      const c = await findOrCreateByName('category', r.category || 'Other')
      const itm = await prisma.item.create({ data: { sku: r.sku || null, item: r.item, quantity: Number(r.quantity||0), price: Number(r.price||0), supplierId: s.id, categoryId: c.id }, include: includeRelations })
      created.push(mapItem(itm))
    }
    res.status(201).json({ count: created.length, items: created })
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed bulk import' }) }
})

// Export CSV
app.get('/api/export', async (req, res) => {
  try {
    const { supplier, includeDeleted } = req.query
    const where = {}
    if (supplier) where.supplier = { name: supplier }
    if (!includeDeleted || includeDeleted === 'false') where.deletedAt = null
    const items = await prisma.item.findMany({ where, include: includeRelations, orderBy: { createdAt: 'desc' } })
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="stock-export.csv"')
    const stringifier = stringify({ header: true, columns: ['supplier','item','category','quantity','price','sku','deletedAt','createdAt'] })
    stringifier.pipe(res)
    for (const i of items) {
      stringifier.write({ supplier: i.supplier.name, item: i.item, category: i.category.name, quantity: i.quantity, price: Number(i.price).toFixed(2), sku: i.sku || '', deletedAt: i.deletedAt || '', createdAt: i.createdAt.toISOString() })
    }
    stringifier.end()
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed export' }) }
})

// Summary
app.get('/api/summary', async (req, res) => {
  try {
    const items = await prisma.item.findMany({ where: { deletedAt: null }, include: includeRelations })
    const bySupplier = {}, byCategory = {}; let grand = 0
    for (const i of items) { const total = Number(i.price) * i.quantity; grand += total; bySupplier[i.supplier.name] = (bySupplier[i.supplier.name]||0) + total; byCategory[i.category.name] = (byCategory[i.category.name]||0) + total }
    res.json({ bySupplier, byCategory, grand })
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed summary' }) }
})

// Static web
const webDist = path.join(__dirname, '../web/dist')
app.use(express.static(webDist))
app.get('*', (req, res) => res.sendFile(path.join(webDist, 'index.html')))

const PORT = process.env.PORT || 8080
app.listen(PORT, () => console.log(`Server on ${PORT}`))
