import { Hono } from 'hono'
import { sparksRouter } from './sparks'

export const apiRouter = new Hono()

apiRouter.route('/sparks', sparksRouter)

apiRouter.get('/', (c) => {
  return c.json({ 
    message: 'Content Creation Platform API',
    endpoints: {
      sparks: '/api/sparks',
      stories: '/api/stories (coming soon)',
      artifacts: '/api/artifacts (coming soon)',
      publications: '/api/publications (coming soon)'
    }
  })
})