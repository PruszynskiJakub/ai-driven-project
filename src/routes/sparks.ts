import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { eq } from 'drizzle-orm'
import { db } from '../database/connection'
import { sparks } from '../database/schema'
import { CreateSparkSchema } from '../models/schemas'
import { randomUUID } from 'crypto'

export const sparksRouter = new Hono()

sparksRouter.get('/', async (c) => {
  const allSparks = await db.select().from(sparks)
  return c.json(allSparks)
})

sparksRouter.post('/', zValidator('json', CreateSparkSchema), async (c) => {
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

sparksRouter.get('/:id', async (c) => {
  const id = c.req.param('id')
  const spark = await db.select().from(sparks).where(eq(sparks.id, id)).limit(1)
  
  if (spark.length === 0) {
    return c.json({ error: 'Spark not found' }, 404)
  }
  
  return c.json(spark[0])
})