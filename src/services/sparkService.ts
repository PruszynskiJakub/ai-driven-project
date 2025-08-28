import {eq, desc} from 'drizzle-orm';
import {db} from '../db/database';
import {sparks} from '../db/schema/sparks';
import type {CreateSparkRequest, SparkResponse} from '../models/spark';
import {v4 as uuidv4} from 'uuid';
import { createStory } from './storyService';

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

export async function createSpark(data: CreateSparkRequest): Promise<SparkResponse> {
    const id = uuidv4();
    const now = new Date().toISOString();

    const sparkData = {
        id,
        title: data.title,
        initialThoughts: data.initialThoughts || null,
        createdAt: now,
        updatedAt: now,
        userId: 'default_user',
    };

    await db.insert(sparks).values(sparkData);

    // Auto-create empty Story for the new Spark
    await createStory({ sparkId: id, content: '' });

    return {
        id: sparkData.id,
        title: sparkData.title,
        initialThoughts: sparkData.initialThoughts || undefined,
        createdAt: sparkData.createdAt,
        updatedAt: sparkData.updatedAt,
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