import type {CreateStoryRequest, StoryResponse, UpdateStoryRequest} from "../models/story.ts";
import {db} from "../db/database.ts";
import {stories} from "../db/schema";
import {eq} from "drizzle-orm";
import {v4 as uuidv4} from "uuid";

export const storyService = {
    getById: async (id: string): Promise<StoryResponse | null> => {
        const [story] = await db.select().from(stories).where(eq(stories.id, id));

        if (!story) return null;

        return {
            id: story.id,
            sparkId: story.sparkId,
            content: story.content,
            createdAt: story.createdAt,
            updatedAt: story.updatedAt,
            lastAutoSavedAt: story.lastAutoSavedAt,
        };
    },
    getBySparkId: async (sparkId: string): Promise<StoryResponse | null> => {
        const [story] = await db.select().from(stories).where(eq(stories.sparkId, sparkId));

        if (!story) return null;

        return {
            id: story.id,
            sparkId: story.sparkId,
            content: story.content,
            createdAt: story.createdAt,
            updatedAt: story.updatedAt,
            lastAutoSavedAt: story.lastAutoSavedAt,
        };
    },
    create: async  (data: CreateStoryRequest): Promise<StoryResponse> => {
        const id = uuidv4();
        const now = isoNow()

        const storyData = {
            id,
            sparkId: data.sparkId,
            content: data.content || '',
            createdAt: now,
            updatedAt: now,
            lastAutoSavedAt: now,
        };

        await db.insert(stories).values(storyData);

        return {
            id: storyData.id,
            sparkId: storyData.sparkId,
            content: storyData.content,
            createdAt: storyData.createdAt,
            updatedAt: storyData.updatedAt,
            lastAutoSavedAt: storyData.lastAutoSavedAt,
        };
    },
    update: async  (data: UpdateStoryRequest): Promise<StoryResponse|null> => {
        const now = isoNow()

        const updateData: any = {
            content: data.content,
            updatedAt: now,
        };

        if (data.isAutoSave) {
            updateData.lastAutoSavedAt = now;
        }

        await db.update(stories).set(updateData).where(eq(stories.id, id));

        const [updatedStory] = await db.select().from(stories).where(eq(stories.id, id));

        if (!updatedStory) return null;

        return {
            id: updatedStory.id,
            sparkId: updatedStory.sparkId,
            content: updatedStory.content,
            createdAt: updatedStory.createdAt,
            updatedAt: updatedStory.updatedAt,
            lastAutoSavedAt: updatedStory.lastAutoSavedAt,
        };
    }
}