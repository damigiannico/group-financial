import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { groupMembers, transactions } from '@/lib/db/schema'
import { and, asc, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

async function currentUser() { const session = await auth.api.getSession({ headers: await headers() }); return session?.user }
async function groupFor(userId: string) {
  const member = await db.select({ groupId: groupMembers.groupId }).from(groupMembers).where(eq(groupMembers.userId, userId)).limit(1)
  return member[0]?.groupId ?? null
}

export async function GET() {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const groupId = await groupFor(user.id)
  if (!groupId) return NextResponse.json([])
  return NextResponse.json(await db.select().from(transactions).where(eq(transactions.groupId, groupId)).orderBy(asc(transactions.date)))
}

export async function POST(request: Request) {
  try {
    const user = await currentUser()
    if (!user) return NextResponse.json({ error: 'Tu sesión venció. Volvé a iniciar sesión.' }, { status: 401 })
    const groupId = await groupFor(user.id)
    if (!groupId) return NextResponse.json({ error: 'No podés guardar movimientos todavía: primero creá o unite a un grupo desde Configuración.' }, { status: 400 })

    const body = await request.json()
    const amount = Number(body.amount)
    const type = body.type === 'income' || body.type === 'expense' ? body.type : null
    const date = String(body.date || new Date().toISOString().slice(0, 10))
    if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount <= 0) return NextResponse.json({ error: 'El monto debe ser un número entero mayor a cero.' }, { status: 400 })
    if (!type) return NextResponse.json({ error: 'Elegí si el movimiento es un ingreso o un gasto.' }, { status: 400 })
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: 'La fecha no tiene un formato válido.' }, { status: 400 })

    const category = String(body.category || 'Otros')
    const categoryVisuals: Record<string, { icon: string; color: string }> = {
      Supermercado: { icon: 'shopping', color: '#d7f16a' },
      Casa: { icon: 'home', color: '#ffb07c' },
      Hijos: { icon: 'school', color: '#a9d5ff' },
      Transporte: { icon: 'car', color: '#d9c5ff' },
      Personal: { icon: 'user', color: '#ffcae5' },
      Servicios: { icon: 'bolt', color: '#c4edd7' },
    }
    const visual = categoryVisuals[category] ?? { icon: 'tag', color: '#e5e7eb' }
    const row = { id: crypto.randomUUID(), groupId, userId: user.id, type, amount, category, description: String(body.description || category || 'Movimiento'), date, icon: visual.icon, color: visual.color, createdAt: new Date() }
    await db.insert(transactions).values(row)
    return NextResponse.json(row, { status: 201 })
  } catch (error) {
    console.error('[v0] Error guardando movimiento:', error)
    return NextResponse.json({ error: 'No pudimos guardar el movimiento. Revisá la conexión e intentá nuevamente.' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const user = await currentUser(); const id = new URL(request.url).searchParams.get('id')
  if (!user || !id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const groupId = await groupFor(user.id)
  if (!groupId) return NextResponse.json({ error: 'Necesitás crear o unirte a un grupo antes de registrar movimientos.' }, { status: 400 })
  await db.delete(transactions).where(and(eq(transactions.id, id), eq(transactions.groupId, groupId)))
  return NextResponse.json({ ok: true })
}
