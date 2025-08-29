import { Hono } from 'hono';
import { validator } from 'hono/validator';
import {
  createArtifact,
  getArtifactById,
  getArtifactVersions,
  getArtifactVersion,
  addFeedbackAndIterate,
  updateArtifactContent,
  finalizeArtifact,
  duplicateArtifact,
  getArtifactsByStoryId
} from '../services/artifactService';
import {
  CreateArtifactSchema,
  UpdateArtifactContentSchema,
  AddFeedbackSchema
} from '../models/artifact';

const artifacts = new Hono();

// POST /artifacts - Create new artifact
artifacts.post('/',
  validator('json', (value, c) => {
    const parsed = CreateArtifactSchema.safeParse(value);
    if (!parsed.success) {
      return c.json({ error: 'Invalid input', details: parsed.error.issues }, 400);
    }
    return parsed.data;
  }),
  async (c) => {
    try {
      const artifactData = c.req.valid('json');
      const artifact = await createArtifact(artifactData);
      
      return c.json({
        success: true,
        data: artifact,
        message: 'Artifact created successfully'
      }, 201);
    } catch (error) {
      console.error('Error creating artifact:', error);
      return c.json({ 
        error: 'Failed to create artifact',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  }
);

// GET /artifacts/:id - Retrieve artifact with current version
artifacts.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const artifact = await getArtifactById(id);
    
    if (!artifact) {
      return c.json({ error: 'Artifact not found' }, 404);
    }
    
    return c.json({
      success: true,
      data: artifact
    });
  } catch (error) {
    console.error('Error retrieving artifact:', error);
    return c.json({ 
      error: 'Failed to retrieve artifact',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// GET /artifacts/:id/versions - List all versions with metadata
artifacts.get('/:id/versions', async (c) => {
  try {
    const id = c.req.param('id');
    const versions = await getArtifactVersions(id);
    
    return c.json({
      success: true,
      data: versions
    });
  } catch (error) {
    console.error('Error retrieving artifact versions:', error);
    return c.json({ 
      error: 'Failed to retrieve artifact versions',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// GET /artifacts/:id/versions/:version - Retrieve specific version
artifacts.get('/:id/versions/:version', async (c) => {
  try {
    const id = c.req.param('id');
    const version = parseInt(c.req.param('version'), 10);
    
    if (isNaN(version) || version < 1) {
      return c.json({ error: 'Invalid version number' }, 400);
    }
    
    const versionData = await getArtifactVersion(id, version);
    
    if (!versionData) {
      return c.json({ error: 'Version not found' }, 404);
    }
    
    return c.json({
      success: true,
      data: versionData
    });
  } catch (error) {
    console.error('Error retrieving artifact version:', error);
    return c.json({ 
      error: 'Failed to retrieve artifact version',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// POST /artifacts/:id/iterate - Add feedback and generate new version (Draft only)
artifacts.post('/:id/iterate',
  validator('json', (value, c) => {
    const parsed = AddFeedbackSchema.safeParse(value);
    if (!parsed.success) {
      return c.json({ error: 'Invalid input', details: parsed.error.issues }, 400);
    }
    return parsed.data;
  }),
  async (c) => {
    try {
      const id = c.req.param('id');
      const feedbackData = c.req.valid('json');
      const artifact = await addFeedbackAndIterate(id, feedbackData);
      
      if (!artifact) {
        return c.json({ error: 'Artifact not found' }, 404);
      }
      
      return c.json({
        success: true,
        data: artifact,
        message: 'New version created with feedback'
      });
    } catch (error) {
      console.error('Error adding feedback:', error);
      return c.json({ 
        error: 'Failed to add feedback',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, error instanceof Error && error.message.includes('finalized') ? 400 : 500);
    }
  }
);

// PUT /artifacts/:id/content - Save manually edited content as new version (Draft only)
artifacts.put('/:id/content',
  validator('json', (value, c) => {
    const parsed = UpdateArtifactContentSchema.safeParse(value);
    if (!parsed.success) {
      return c.json({ error: 'Invalid input', details: parsed.error.issues }, 400);
    }
    return parsed.data;
  }),
  async (c) => {
    try {
      const id = c.req.param('id');
      const contentData = c.req.valid('json');
      const artifact = await updateArtifactContent(id, contentData);
      
      if (!artifact) {
        return c.json({ error: 'Artifact not found' }, 404);
      }
      
      return c.json({
        success: true,
        data: artifact,
        message: 'Content updated successfully'
      });
    } catch (error) {
      console.error('Error updating content:', error);
      return c.json({ 
        error: 'Failed to update content',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, error instanceof Error && error.message.includes('finalized') ? 400 : 500);
    }
  }
);

// POST /artifacts/:id/finalize - Mark as Final
artifacts.post('/:id/finalize', async (c) => {
  try {
    const id = c.req.param('id');
    const artifact = await finalizeArtifact(id);
    
    if (!artifact) {
      return c.json({ error: 'Artifact not found' }, 404);
    }
    
    return c.json({
      success: true,
      data: artifact,
      message: 'Artifact finalized successfully'
    });
  } catch (error) {
    console.error('Error finalizing artifact:', error);
    const statusCode = error instanceof Error && 
      (error.message.includes('already finalized') || error.message.includes('empty content')) 
      ? 400 : 500;
      
    return c.json({ 
      error: 'Failed to finalize artifact',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, statusCode);
  }
});

// POST /artifacts/:id/duplicate - Create Draft copy from Final artifact
artifacts.post('/:id/duplicate', async (c) => {
  try {
    const id = c.req.param('id');
    const newArtifact = await duplicateArtifact(id);
    
    if (!newArtifact) {
      return c.json({ error: 'Artifact not found' }, 404);
    }
    
    return c.json({
      success: true,
      data: newArtifact,
      message: 'Artifact duplicated successfully'
    }, 201);
  } catch (error) {
    console.error('Error duplicating artifact:', error);
    const statusCode = error instanceof Error && error.message.includes('finalized') ? 400 : 500;
    
    return c.json({ 
      error: 'Failed to duplicate artifact',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, statusCode);
  }
});

export default artifacts;