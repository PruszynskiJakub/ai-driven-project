import {Hono} from 'hono';
import {validator} from 'hono/validator';
import {AddFeedbackSchema, CreateArtifactSchema, UpdateArtifactContentSchema} from '../models/artifact';
import {artifactService} from "../services/artifact.service.ts";

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
      const artifact = await artifactService.create(artifactData);
      
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
    const artifact = await artifactService.getById(id);
    
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
    const versions = await artifactService.getAllVersions(id);
    
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
    
    const versionData = await artifactService.getVersion(id, version);
    
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

// POST /artifacts/:id/versions/:version/restore - Restore specific version without creating duplicate (Draft only)
artifacts.post('/:id/versions/:version/restore', async (c) => {
  try {
    const id = c.req.param('id');
    const version = parseInt(c.req.param('version'), 10);
    
    if (isNaN(version) || version < 1) {
      return c.json({ error: 'Invalid version number' }, 400);
    }
    
    const artifact = await artifactService.restoreVersion(id, version);
    
    if (!artifact) {
      return c.json({ error: 'Artifact not found' }, 404);
    }
    
    return c.json({
      success: true,
      data: artifact,
      message: 'Version restored successfully'
    });
  } catch (error) {
    console.error('Error restoring artifact version:', error);
    const statusCode = error instanceof Error && 
      (error.message.includes('finalized') || 
       error.message.includes('Target version not found')) 
      ? 400 : 500;
      
    return c.json({ 
      error: 'Failed to restore version',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, statusCode);
  }
});

// DELETE /artifacts/:id/versions/:version - Remove specific version (Draft only)
artifacts.delete('/:id/versions/:version', async (c) => {
  try {
    const id = c.req.param('id');
    const version = parseInt(c.req.param('version'), 10);
    
    if (isNaN(version) || version < 1) {
      return c.json({ error: 'Invalid version number' }, 400);
    }
    
    const artifact = await artifactService.deleteVersion(id, version);
    
    if (!artifact) {
      return c.json({ error: 'Artifact not found' }, 404);
    }
    
    return c.json({
      success: true,
      data: artifact,
      message: 'Version removed successfully'
    });
  } catch (error) {
    console.error('Error removing artifact version:', error);
    const statusCode = error instanceof Error && 
      (error.message.includes('finalized') || 
       error.message.includes('last remaining') ||
       error.message.includes('Version not found')) 
      ? 400 : 500;
      
    return c.json({ 
      error: 'Failed to remove version',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, statusCode);
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
      const artifact = await artifactService.addFeedback(id, feedbackData);
      
      if (!artifact) {
        return c.json({ error: 'Artifact not found' }, 404);
      }
      
      const message = artifact.newVersionCreated 
        ? 'New version created with feedback'
        : 'Content unchanged - no new version created';
      
      return c.json({
        success: true,
        data: artifact,
        message
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
      const artifact = await artifactService.updateContent(id, contentData);
      
      if (!artifact) {
        return c.json({ error: 'Artifact not found' }, 404);
      }
      
      const message = artifact.newVersionCreated 
        ? 'Content updated successfully'
        : 'Content unchanged - no new version created';
      
      return c.json({
        success: true,
        data: artifact,
        message
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
    const artifact = await artifactService.finalize(id);
    
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
    const newArtifact = await artifactService.duplicate(id);
    
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

// DELETE /artifacts/:id - Delete entire draft artifact (cascades to all versions)
artifacts.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const deleted = await artifactService.delete(id);
    
    if (!deleted) {
      return c.json({ error: 'Artifact not found' }, 404);
    }
    
    return c.json({
      success: true,
      message: 'Artifact and all versions deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting artifact:', error);
    const statusCode = error instanceof Error && error.message.includes('finalized') ? 400 : 500;
    
    return c.json({ 
      error: 'Failed to delete artifact',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, statusCode);
  }
});

export default artifacts;