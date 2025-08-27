import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { apiRouter } from './src/routes'

const app = new Hono()

app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.route('/api', apiRouter)

const port = 3000
console.log(`Server is running on port ${port}`)

serve({
  fetch: app.fetch,
  port,
})