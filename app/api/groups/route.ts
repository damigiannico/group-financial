import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { groupMembers, householdGroups, transactions, user } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

async function getSessionUser() {
  const session = await auth.api.getSession({ headers: await headers() })
  return session?.user
}

async function getMembership(userId: string) {
  return db.select({ groupId: groupMembers.groupId, role: groupMembers.role })
    .from(groupMembers).where(eq(groupMembers.userId, userId)).limit(1)
}

export async function GET() {
  const current = await getSessionUser()
  if (!current) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const membership = (await getMembership(current.id))[0]
  if (!membership) return NextResponse.json({ group: null, members: [], currentUserId: current.id, currentUser: { id: current.id, name: current.name, email: current.email } })
  const group = (await db.select().from(householdGroups).where(eq(householdGroups.id, membership.groupId)).limit(1))[0]
  const members = await db.select({ id: user.id, name: user.name, email: user.email, role: groupMembers.role })
    .from(groupMembers).innerJoin(user, eq(user.id, groupMembers.userId)).where(eq(groupMembers.groupId, membership.groupId))
  return NextResponse.json({ group, members, currentUserId: current.id })
}

export async function POST(request: Request) {
  const current = await getSessionUser()
  if (!current) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()
  const name = String(body.name || '').trim()
  if (!name) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
  const existing = (await getMembership(current.id))[0]
  if (existing) return NextResponse.json({ error: 'Ya pertenecés a un grupo' }, { status: 409 })
  const id = crypto.randomUUID()
  await db.insert(householdGroups).values({ id, name, createdBy: current.id, createdAt: new Date() })
  await db.insert(groupMembers).values({ groupId: id, userId: current.id, role: 'member' })
  return GET()
}

export async function PATCH(request: Request) {
  const current = await getSessionUser()
  if (!current) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const membership = (await getMembership(current.id))[0]
  if (!membership) return NextResponse.json({ error: 'No pertenecés a un grupo' }, { status: 404 })
  const email = String((await request.json()).email || '').trim().toLowerCase()
  if (!email) return NextResponse.json({ error: 'Ingresá el email del usuario' }, { status: 400 })
  const invited = (await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1))[0]
  if (!invited) return NextResponse.json({ error: 'No existe un usuario con ese email' }, { status: 404 })
  const already = (await db.select().from(groupMembers).where(and(eq(groupMembers.groupId, membership.groupId), eq(groupMembers.userId, invited.id))).limit(1))[0]
  if (!already) await db.insert(groupMembers).values({ groupId: membership.groupId, userId: invited.id, role: 'member' })
  return GET()
}

export async function DELETE(request: Request) {
  const current = await getSessionUser()
  if (!current) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const membership = (await getMembership(current.id))[0]
  const params = new URL(request.url).searchParams
  const deleteGroup = params.get('group') === 'true'
  const userId = params.get('userId') || current.id
  if (!membership) return NextResponse.json({ error: 'No pertenecés a un grupo' }, { status: 404 })
  const group = (await db.select({ createdBy: householdGroups.createdBy }).from(householdGroups).where(eq(householdGroups.id, membership.groupId)).limit(1))[0]
  if (deleteGroup) {
    if (group?.createdBy !== current.id) return NextResponse.json({ error: 'Solo quien creó el grupo puede eliminarlo.' }, { status: 403 })
    await db.delete(transactions).where(eq(transactions.groupId, membership.groupId))
    await db.delete(groupMembers).where(eq(groupMembers.groupId, membership.groupId))
    await db.delete(householdGroups).where(eq(householdGroups.id, membership.groupId))
    return NextResponse.json({ ok: true, deletedGroupId: membership.groupId })
  }
  const target = (await db.select({ id: user.id, name: user.name }).from(user).where(eq(user.id, userId)).limit(1))[0]
  if (!target) return NextResponse.json({ error: 'No existe ese integrante.' }, { status: 404 })
  const targetMembership = (await db.select().from(groupMembers).where(and(eq(groupMembers.groupId, membership.groupId), eq(groupMembers.userId, userId))).limit(1))[0]
  if (!targetMembership) return NextResponse.json({ error: 'Ese usuario no pertenece al grupo.' }, { status: 404 })

  await db.delete(groupMembers).where(and(eq(groupMembers.groupId, membership.groupId), eq(groupMembers.userId, userId)))

  // Si el último integrante se va, el grupo deja de tener sentido y se elimina.
  const remaining = await db.select({ userId: groupMembers.userId }).from(groupMembers).where(eq(groupMembers.groupId, membership.groupId))
  if (remaining.length === 0) {
    await db.delete(transactions).where(eq(transactions.groupId, membership.groupId))
    await db.delete(householdGroups).where(eq(householdGroups.id, membership.groupId))
  }
  return NextResponse.json({ ok: true, removedUserId: userId })
}
