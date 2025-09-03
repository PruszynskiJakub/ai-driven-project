import {Hono} from 'hono';
import {zValidator} from '@hono/zod-validator';
import {UpdateStorySchema} from '../models/story';
import {z} from 'zod';
import {storyService} from "../services/story.service.ts";
import {artifactService} from "../services/artifact.service.ts";

const stories = new Hono();

// Get Story by ID
stories.get('/:storyId', async (c) => {
    const storyId = c.req.param('storyId');
    
    if (!storyId) {
        return c.json({ error: 'Story ID is required' }, 400);
    }

    try {
        const story = await storyService.getById(storyId);
        
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
        const updatedStory = await storyService.update(storyId, data);
        
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
    const content  = c.req.valid('json');

    if (!storyId) {
        return c.json({ error: 'Story ID is required' }, 400);
    }

    try {
        const result = await storyService.update(storyId, {content, isAutoSave: true});
        
        if (!result) {
            return c.json({ error: 'Story not found' }, 404);
        }

        return c.json(result);
    } catch (error) {
        console.error('Error auto-saving story:', error);
        return c.json({ error: 'Internal server error' }, 500);
    }
});

// Get Artifacts by Story ID
stories.get('/:storyId/artifacts', async (c) => {
    const storyId = c.req.param('storyId');
    
    if (!storyId) {
        return c.json({ error: 'Story ID is required' }, 400);
    }

    try {
        const artifacts = await artifactService.getByStoryId(storyId);
        
        return c.json({
            success: true,
            data: artifacts
        });
    } catch (error) {
        console.error('Error fetching story artifacts:', error);
        return c.json({ 
            error: 'Failed to retrieve story artifacts',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, 500);
    }
});

export default stories;