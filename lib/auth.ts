import { betterAuth } from 'better-auth'
import { Pool } from 'pg'

export const auth = betterAuth({
  database: new Pool({
    connectionString: process.env.DATABASE_URL,
  }),

  emailAndPassword: {
    enabled: true,
  },

  baseURL: {
    allowedHosts: [
      'localhost:3000',
      '*.vercel.app',
    ],
    protocol: process.env.NODE_ENV === 'development' ? 'http' : 'https',
  },

  trustedOrigins: [
    'http://localhost:3000',
    'https://*.vercel.app',
  ],

  ...(process.env.NODE_ENV === 'development'
    ? {
        advanced: {
          defaultCookieAttributes: {
            sameSite: 'none' as const,
            secure: true,
          },
        },
      }
    : {}),
})