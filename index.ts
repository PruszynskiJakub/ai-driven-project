import {Hono} from 'hono'
import sparks from './src/routes/sparks'
import stories from './src/routes/stories'
import artifacts from './src/routes/artifacts'
import {loggerMiddleware} from './src/middleware/logger'
import {AIServiceError} from "./src/services/ai.service.ts";

if (!process.env.OPENROUTER_API_KEY) {
    throw new AIServiceError('OPENROUTER_API_KEY environment variable is not set');
}

if (!process.env.REPLICATE_API_TOKEN) {
    throw new AIServiceError('REPLICATE_API_TOKEN environment variable is not set');
}

const app = new Hono()

app.use('*', loggerMiddleware)

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
  port: 3001,
  fetch: app.fetch,
}