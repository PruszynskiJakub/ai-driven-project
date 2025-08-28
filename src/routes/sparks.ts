import { Hono } from 'hono';
import { validator } from 'hono/validator';
import { getSparkById, listSparks, createSpark } from '../services/sparkService';
import { CreateSparkSchema } from '../models/spark';

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

export default sparks;