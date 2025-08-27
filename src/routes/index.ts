import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { sparksRouter } from './sparks'

export const apiRouter = new OpenAPIHono()

apiRouter.route('/sparks', sparksRouter)

const apiOverviewRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['General'],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            message: z.string(),
            endpoints: z.object({
              sparks: z.string(),
              stories: z.string(),
              artifacts: z.string(),
              publications: z.string(),
            }),
          }),
        },
      },
      description: 'API overview',
    },
  },
})

apiRouter.openapi(apiOverviewRoute, (c) => {
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