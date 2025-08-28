import { eq, desc } from 'drizzle-orm';
import { db } from '../db/database';
import { sparks } from '../db/schema/sparks';
import { SparkResponse } from '../models/spark';

export async function getSparkById(id: string): Promise<SparkResponse | null> {
  const [spark] = await db.select().from(sparks).where(eq(sparks.id, id));
  
  if (!spark) return null;
  
  return {
    id: spark.id,
    title: spark.title,
    initialThoughts: spark.initialThoughts || undefined,
    createdAt: spark.createdAt,
    updatedAt: spark.updatedAt,
  };
}

export async function listSparks(userId: string = 'default_user'): Promise<SparkResponse[]> {
  const sparksList = await db
    .select()
    .from(sparks)
    .where(eq(sparks.userId, userId))
    .orderBy(desc(sparks.createdAt));
  
  return sparksList.map(spark => ({
    id: spark.id,
    title: spark.title,
    initialThoughts: spark.initialThoughts || undefined,
    createdAt: spark.createdAt,
    updatedAt: spark.updatedAt,
  }));
}