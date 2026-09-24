import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { categories, groupMembers, transactions } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

const fallback = { icon: 'tag', color: '#d9d3c7' }

async function getContext() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null
  const membership = await db.select({ groupId: groupMembers.groupId }).from(groupMembers).where(eq(groupMembers.userId, session.user.id)).limit(1)
  return { user: session.user, groupId: membership[0]?.groupId ?? null }
}

export async function GET() {
  const context = await getContext()
  if (!context) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!context.groupId) return NextResponse.json([])
  return NextResponse.json(await db.select().from(categories).where(eq(categories.groupId, context.groupId)).orderBy(categories.name))
}

export async function POST(request: Request) {
  const context = await getContext()
  if (!context) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!context.groupId) return NextResponse.json({ error: 'Primero creá o unite a un grupo.' }, { status: 400 })
  const body = await request.json()
  const name = String(body.name || '').trim()
  const appliesTo = ['income', 'expense', 'both'].includes(body.appliesTo) ? body.appliesTo : 'expense'
  if (!name) return NextResponse.json({ error: 'El nombre es obligatorio.' }, { status: 400 })
  const existing = await db.select({ id: categories.id }).from(categories).where(and(eq(categories.groupId, context.groupId), eq(categories.name, name))).limit(1)
  if (existing[0]) return NextResponse.json({ error: 'Ya existe una categoría con ese nombre.' }, { status: 409 })
  const row = { id: crypto.randomUUID(), groupId: context.groupId, name, appliesTo, icon: fallback.icon, color: fallback.color, createdAt: new Date() }
  await db.insert(categories).values(row)
  return NextResponse.json(row, { status: 201 })
}

export async function PATCH(request: Request) {
  const context = await getContext()
  if (!context) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!context.groupId) return NextResponse.json({ error: 'No tenés un grupo activo.' }, { status: 400 })
  const body = await request.json()
  const id = String(body.id || '')
  const name = String(body.name || '').trim()
  const appliesTo = ['income', 'expense', 'both'].includes(body.appliesTo) ? body.appliesTo : 'expense'
  if (!id || !name) return NextResponse.json({ error: 'La categoría es inválida.' }, { status: 400 })
  const target = await db.select({ name: categories.name }).from(categories).where(and(eq(categories.id, id), eq(categories.groupId, context.groupId))).limit(1)
  if (!target[0]) return NextResponse.json({ error: 'Categoría no encontrada.' }, { status: 404 })
  await db.update(categories).set({ name, appliesTo }).where(and(eq(categories.id, id), eq(categories.groupId, context.groupId)))
  await db.update(transactions).set({ category: name }).where(and(eq(transactions.groupId, context.groupId), eq(transactions.category, target[0].name)))
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const context = await getContext()
  if (!context) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!context.groupId) return NextResponse.json({ error: 'No tenés un grupo activo.' }, { status: 400 })
  const id = new URL(request.url).searchParams.get('id') || ''
  const target = await db.select({ name: categories.name }).from(categories).where(and(eq(categories.id, id), eq(categories.groupId, context.groupId))).limit(1)
  if (!target[0]) return NextResponse.json({ error: 'Categoría no encontrada.' }, { status: 404 })
  if (target[0].name === 'Otros') return NextResponse.json({ error: 'La categoría Otros no se puede eliminar.' }, { status: 400 })
  await db.update(transactions).set({ category: 'Otros', icon: 'tag', color: fallback.color }).where(and(eq(transactions.groupId, context.groupId), eq(transactions.category, target[0].name)))
  await db.delete(categories).where(and(eq(categories.id, id), eq(categories.groupId, context.groupId)))
  return NextResponse.json({ ok: true })
}

export const dynamic = 'force-dynamic'
