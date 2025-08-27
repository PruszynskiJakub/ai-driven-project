import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { eq } from 'drizzle-orm'
import { db } from '../database/connection'
import { sparks } from '../database/schema'
import { CreateSparkSchema, SparkSchema } from '../models/schemas'
import { randomUUID } from 'crypto'

export const sparksRouter = new OpenAPIHono()

const listSparksRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Sparks'],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.array(SparkSchema),
        },
      },
      description: 'List of all sparks',
    },
  },
})

const createSparkRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Sparks'],
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateSparkSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: SparkSchema,
        },
      },
      description: 'Created spark',
    },
  },
})

const getSparkRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['Sparks'],
  request: {
    params: z.object({
      id: z.string().uuid().openapi({ param: { name: 'id', in: 'path' } }),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SparkSchema,
        },
      },
      description: 'Retrieved spark',
    },
    404: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
      description: 'Spark not found',
    },
  },
})

sparksRouter.openapi(listSparksRoute, async (c) => {
  const allSparks = await db.select().from(sparks)
  return c.json(allSparks)
})

sparksRouter.openapi(createSparkRoute, async (c) => {
  const data = c.req.valid('json')
  
  const newSpark = {
    id: randomUUID(),
    ...data,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  
  await db.insert(sparks).values(newSpark)
  return c.json(newSpark, 201)
})

sparksRouter.openapi(getSparkRoute, async (c) => {
  const { id } = c.req.valid('param')
  const spark = await db.select().from(sparks).where(eq(sparks.id, id)).limit(1)
  
  if (spark.length === 0) {
    return c.json({ error: 'Spark not found' }, 404)
  }
  
  return c.json(spark[0])
})