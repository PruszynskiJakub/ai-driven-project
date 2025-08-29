import { Hono } from 'hono'
import sparks from './src/routes/sparks'
import stories from './src/routes/stories'
import artifacts from './src/routes/artifacts'

const app = new Hono()

app.get('/', (c) => {
  return c.json({ message: 'AI-Driven Content Platform API' })
})

app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.route('/api/sparks', sparks)
app.route('/api/stories', stories)
app.route('/api/artifacts', artifacts)

export default {
  port: 3002,
  fetch: app.fetch,
}