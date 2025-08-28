import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { getStoryById, getStoryBySparkId, updateStory, autoSaveStory } from '../services/storyService';
import { UpdateStorySchema } from '../models/story';
import { z } from 'zod';

const stories = new Hono();

// Get Story by ID
stories.get('/:storyId', async (c) => {
    const storyId = c.req.param('storyId');
    
    if (!storyId) {
        return c.json({ error: 'Story ID is required' }, 400);
    }

    try {
        const story = await getStoryById(storyId);
        
        if (!story) {
            return c.json({ error: 'Story not found' }, 404);
        }

        return c.json(story);
    } catch (error) {
        console.error('Error fetching story:', error);
        return c.json({ error: 'Internal server error' }, 500);
    }
});

// Update Story
stories.put('/:storyId', zValidator('json', UpdateStorySchema), async (c) => {
    const storyId = c.req.param('storyId');
    const data = c.req.valid('json');

    if (!storyId) {
        return c.json({ error: 'Story ID is required' }, 400);
    }

    try {
        const updatedStory = await updateStory(storyId, data);
        
        if (!updatedStory) {
            return c.json({ error: 'Story not found' }, 404);
        }

        return c.json(updatedStory);
    } catch (error) {
        console.error('Error updating story:', error);
        return c.json({ error: 'Internal server error' }, 500);
    }
});

// Auto-save Story
stories.patch('/:storyId/autosave', zValidator('json', z.object({ content: z.string() })), async (c) => {
    const storyId = c.req.param('storyId');
    const { content } = c.req.valid('json');

    if (!storyId) {
        return c.json({ error: 'Story ID is required' }, 400);
    }

    try {
        const result = await autoSaveStory(storyId, content);
        
        if (!result) {
            return c.json({ error: 'Story not found' }, 404);
        }

        return c.json(result);
    } catch (error) {
        console.error('Error auto-saving story:', error);
        return c.json({ error: 'Internal server error' }, 500);
    }
});

export default stories;