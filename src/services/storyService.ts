import { eq } from 'drizzle-orm';
import { db } from '../db/database';
import { stories } from '../db/schema/stories';
import type { CreateStoryRequest, UpdateStoryRequest, StoryResponse } from '../models/story';
import { v4 as uuidv4 } from 'uuid';

export async function getStoryById(id: string): Promise<StoryResponse | null> {
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
}

export async function getStoryBySparkId(sparkId: string): Promise<StoryResponse | null> {
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
}

export async function createStory(data: CreateStoryRequest): Promise<StoryResponse> {
    const id = uuidv4();
    const now = new Date().toISOString();

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
}

export async function updateStory(id: string, data: UpdateStoryRequest): Promise<StoryResponse | null> {
    const now = new Date().toISOString();
    
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

export async function autoSaveStory(id: string, content: string): Promise<{ lastAutoSavedAt: string } | null> {
    const now = new Date().toISOString();

    await db.update(stories)
        .set({ 
            content,
            lastAutoSavedAt: now 
        })
        .where(eq(stories.id, id));

    return { lastAutoSavedAt: now };
}