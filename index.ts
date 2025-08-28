import { Hono } from 'hono'
import sparks from './src/routes/sparks'

const app = new Hono()

app.get('/', (c) => {
  return c.json({ message: 'AI-Driven Content Platform API' })
})

app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.route('/api/sparks', sparks)

export default {
  port: 3001,
  fetch: app.fetch,
}