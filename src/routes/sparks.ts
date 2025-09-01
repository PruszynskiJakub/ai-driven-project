import { Hono } from 'hono';
import { validator } from 'hono/validator';
import { getSparkById, listSparks, createSpark, deleteSpark } from '../services/sparkService';
import { CreateSparkSchema } from '../models/spark';
import { getStoryBySparkId } from '../services/storyService';

const sparks = new Hono();

sparks.post('/', 
  validator('json', (value, c) => {
    const parsed = CreateSparkSchema.safeParse(value);
    if (!parsed.success) {
      return c.json({ error: 'Invalid input', details: parsed.error.issues }, 400);
    }
    return parsed.data;
  }),
  async (c) => {
    try {
      const sparkData = c.req.valid('json');
      const spark = await createSpark(sparkData);
      
      return c.json({
        success: true,
        data: spark,
        message: 'Spark created successfully'
      }, 201);
    } catch (error) {
      console.error('Error creating spark:', error);
      return c.json({ 
        error: 'Failed to create spark',
        message: 'An unexpected error occurred. Please try again.'
      }, 500);
    }
  }
);

sparks.get('/', async (c) => {
  try {
    const sparksList = await listSparks();
    
    return c.json({
      success: true,
      data: sparksList,
      message: 'Sparks retrieved successfully'
    });
  } catch (error) {
    console.error('Error listing sparks:', error);
    return c.json({ 
      error: 'Failed to list sparks',
      message: 'An unexpected error occurred. Please try again.'
    }, 500);
  }
});

sparks.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const spark = await getSparkById(id);
    
    if (!spark) {
      return c.json({
        error: 'Spark not found',
        message: 'The requested spark does not exist.'
      }, 404);
    }
    
    return c.json({
      success: true,
      data: spark,
      message: 'Spark retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting spark:', error);
    return c.json({ 
      error: 'Failed to get spark',
      message: 'An unexpected error occurred. Please try again.'
    }, 500);
  }
});

sparks.get('/:sparkId/story', async (c) => {
  try {
    const sparkId = c.req.param('sparkId');
    const story = await getStoryBySparkId(sparkId);
    
    if (!story) {
      return c.json({
        error: 'Story not found',
        message: 'The story for this spark does not exist.'
      }, 404);
    }
    
    return c.json({
      success: true,
      data: story,
      message: 'Story retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting story:', error);
    return c.json({ 
      error: 'Failed to get story',
      message: 'An unexpected error occurred. Please try again.'
    }, 500);
  }
});

sparks.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const deleted = await deleteSpark(id);
    
    if (!deleted) {
      return c.json({
        error: 'Spark not found',
        message: 'The requested spark does not exist.'
      }, 404);
    }
    
    return c.json({
      success: true,
      message: 'Spark and all related data deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting spark:', error);
    return c.json({ 
      error: 'Failed to delete spark',
      message: 'An unexpected error occurred. Please try again.'
    }, 500);
  }
});

export default sparks;