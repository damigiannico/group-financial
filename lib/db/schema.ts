import { date, integer, pgTable, text, timestamp, primaryKey } from 'drizzle-orm/pg-core'

export const user = pgTable('user', { id: text('id').primaryKey(), name: text('name').notNull(), email: text('email').notNull(), emailVerified: timestamp('emailVerified'), image: text('image'), createdAt: timestamp('createdAt').notNull(), updatedAt: timestamp('updatedAt').notNull() })
export const householdGroups = pgTable('household_groups', { id: text('id').primaryKey(), name: text('name').notNull(), createdAt: timestamp('created_at').notNull(), createdBy: text('created_by').notNull() })
export const groupMembers = pgTable('group_members', { groupId: text('group_id').notNull(), userId: text('user_id').notNull(), role: text('role').notNull().default('member') }, (table) => ({ pk: primaryKey({ columns: [table.groupId, table.userId] }) }))
export const transactions = pgTable('transactions', { id: text('id').primaryKey(), groupId: text('group_id').notNull(), userId: text('user_id').notNull(), type: text('type').notNull(), amount: integer('amount').notNull(), category: text('category').notNull(), description: text('description').notNull(), date: date('date').notNull(), icon: text('icon').notNull(), color: text('color').notNull(), createdAt: timestamp('created_at').notNull() })
export const categories = pgTable('categories', { id: text('id').primaryKey(), groupId: text('group_id').notNull(), name: text('name').notNull(), icon: text('icon').notNull().default('tag'), color: text('color').notNull().default('#d9d3c7'), appliesTo: text('applies_to').notNull().default('expense'), createdAt: timestamp('created_at').notNull() })
export type Transaction = typeof transactions.$inferSelect
export type Category = typeof categories.$inferSelect
