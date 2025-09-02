import type {CreateSparkRequest, SparkResponse} from "../models/spark.ts";
import {db} from "../db/database.ts";
import {artifacts, sparks, stories} from "../db/schema";
import {count, eq} from "drizzle-orm";
import {v4 as uuidv4} from "uuid";
import {storyService} from "./story.service.ts";

async function getArtifactCounts(id: string): Promise<{ draft: number; final: number }> {
    const counts = await db
        .select({
            state: artifacts.state,
            count: count(),
        })
        .from(artifacts)
        .innerJoin(stories, eq(artifacts.storyId, stories.id))
        .where(eq(stories.sparkId, id))
        .groupBy(artifacts.state);

    const result = { draft: 0, final: 0 };
    counts.forEach(({ state, count: artifactCount }) => {
        if (state === 'draft') result.draft = artifactCount;
        else if (state === 'final') result.final = artifactCount;
    });

    return result;
}

export const sparkService = {
    getById: async (id: string): Promise<SparkResponse | null> => {
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
    },
    create: async (data: CreateSparkRequest): Promise<SparkResponse> => {
        const id = uuidv4();
        const now = isoNow()

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
        await storyService.create({ sparkId: id, content: '' });

        return {
            id: sparkData.id,
            title: sparkData.title,
            initialThoughts: sparkData.initialThoughts || undefined,
            createdAt: sparkData.createdAt,
            updatedAt: sparkData.updatedAt,
            artifactCounts: { draft: 0, final: 0 },
        };
    },
    listAll: async  (userId: string = 'default_user'): Promise<SparkResponse[]> => {
        const sparksList = await db
            .select()
            .from(sparks)
            .where(eq(sparks.userId, userId))
            .orderBy(desc(sparks.createdAt));

        const result = [];
        for (const spark of sparksList) {
            //TODO optimize it
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
    },
    delete: async (id: string): Promise<boolean> => {
        const result = await db.delete(sparks).where(eq(sparks.id, id));
        return Boolean(result);
    }
}