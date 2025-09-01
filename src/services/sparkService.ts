import {eq, desc, count, sql} from 'drizzle-orm';
import {db} from '../db/database';
import {sparks} from '../db/schema/sparks';
import {stories} from '../db/schema/stories';
import {artifacts} from '../db/schema/artifacts';
import type {CreateSparkRequest, SparkResponse} from '../models/spark';
import {v4 as uuidv4} from 'uuid';
import { createStory } from './storyService';

async function getArtifactCounts(sparkId: string): Promise<{ draft: number; final: number }> {
    const counts = await db
        .select({
            state: artifacts.state,
            count: count(),
        })
        .from(artifacts)
        .innerJoin(stories, eq(artifacts.storyId, stories.id))
        .where(eq(stories.sparkId, sparkId))
        .groupBy(artifacts.state);

    const result = { draft: 0, final: 0 };
    counts.forEach(({ state, count: artifactCount }) => {
        if (state === 'draft') result.draft = artifactCount;
        else if (state === 'final') result.final = artifactCount;
    });

    return result;
}

export async function getSparkById(id: string): Promise<SparkResponse | null> {
    const [spark] = await db.select().from(sparks).where(eq(sparks.id, id));

    if (!spark) return null;

    const artifactCounts = await getArtifactCounts(id);

    return {
        id: spark.id,
        title: spark.title,
        initialThoughts: spark.initialThoughts || undefined,
        createdAt: spark.createdAt,
        updatedAt: spark.updatedAt,
        artifactCounts,
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
        artifactCounts: { draft: 0, final: 0 },
    };
}

export async function listSparks(userId: string = 'default_user'): Promise<SparkResponse[]> {
    const sparksList = await db
        .select()
        .from(sparks)
        .where(eq(sparks.userId, userId))
        .orderBy(desc(sparks.createdAt));

    const result = [];
    for (const spark of sparksList) {
        const artifactCounts = await getArtifactCounts(spark.id);
        result.push({
            id: spark.id,
            title: spark.title,
            initialThoughts: spark.initialThoughts || undefined,
            createdAt: spark.createdAt,
            updatedAt: spark.updatedAt,
            artifactCounts,
        });
    }

    return result;
}

export async function deleteSpark(id: string): Promise<boolean> {
    const result = await db.delete(sparks).where(eq(sparks.id, id));
    return Boolean(result);
}