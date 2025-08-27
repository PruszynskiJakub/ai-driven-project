import { OpenAPIHono } from '@hono/zod-openapi'
import { serve } from '@hono/node-server'
import { swaggerUI } from '@hono/swagger-ui'
import { apiRouter } from './src/routes'

const app = new OpenAPIHono()

app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.route('/api', apiRouter)

app.doc('/doc', {
  openapi: '3.0.0',
  info: {
    version: '1.0.0',
    title: 'Content Creation Platform API',
    description: 'API for managing sparks, stories, artifacts, and publications in your creative workflow',
  },
})

app.get('/docs', swaggerUI({ url: '/doc' }))

const port = 3000
console.log(`Server is running on port ${port}`)

serve({
  fetch: app.fetch,
  port,
})