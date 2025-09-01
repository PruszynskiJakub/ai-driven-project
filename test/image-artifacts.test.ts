import { expect, test, describe, beforeEach, afterEach } from 'bun:test';
import { setupTestDatabase, cleanupTestDatabase, clearTestData } from './setup';
import { testApp } from './testApp';
import { createTestSparkInDb, createTestStoryInDb } from './factories';
import { setTestDb } from '../src/db/database';

async function createSparkWithStory() {
  const spark = await createTestSparkInDb();
  const story = await createTestStoryInDb({ sparkId: spark.id });
  return { ...spark, storyId: story.id };
}

let testDb: any;

describe('Image Artifacts', () => {
  beforeEach(async () => {
    testDb = setupTestDatabase();
    setTestDb(testDb);
    clearTestData();
  });

  afterEach(() => {
    cleanupTestDatabase();
  });

  test('should create image artifact with base64 content', async () => {
    const spark = await createSparkWithStory();
    
    const artifactData = {
      storyId: spark.storyId,
      type: 'image'
    };

    const response = await testApp.request('/api/artifacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(artifactData)
    });

    expect(response.status).toBe(201);
    const result = await response.json();
    
    expect(result.success).toBe(true);
    expect(result.data.type).toBe('image');
    expect(result.data.state).toBe('draft');
    expect(result.data.currentVersion).toBe(1);
    
    // Should contain base64 image data (placeholder in test env)
    expect(result.data.currentVersionContent).toBe('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==');
    expect(result.data.currentVersionGenerationType).toBe('ai_generated');
  });

  test('should handle image feedback and iteration', async () => {
    const spark = await createSparkWithStory();
    
    // Create image artifact
    const artifactData = {
      storyId: spark.storyId,
      type: 'image'
    };

    const createResponse = await testApp.request('/api/artifacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(artifactData)
    });

    const artifact = (await createResponse.json()).data;

    // Add feedback that should generate new content
    const feedbackData = {
      feedback: 'Make it more engaging'
    };

    const iterateResponse = await testApp.request(`/api/artifacts/${artifact.id}/iterate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(feedbackData)
    });

    expect(iterateResponse.status).toBe(200);
    const result = await iterateResponse.json();
    
    expect(result.success).toBe(true);
    expect(result.data.currentVersion).toBe(2);
    expect(result.data.newVersionCreated).toBe(true);
    
    // Should have updated content with feedback marker
    expect(result.data.currentVersionContent).toBe('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg== [Updated based on feedback]');
    expect(result.data.currentVersionFeedback).toBe('Make it more engaging');
  });

  test('should finalize image artifact', async () => {
    const spark = await createSparkWithStory();
    
    const artifactData = {
      storyId: spark.storyId,
      type: 'image'
    };

    const createResponse = await testApp.request('/api/artifacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(artifactData)
    });

    const artifact = (await createResponse.json()).data;

    // Finalize the artifact
    const finalizeResponse = await testApp.request(`/api/artifacts/${artifact.id}/finalize`, {
      method: 'POST'
    });

    expect(finalizeResponse.status).toBe(200);
    const result = await finalizeResponse.json();
    
    expect(result.success).toBe(true);
    expect(result.data.state).toBe('final');
    expect(result.data.finalizedAt).toBeDefined();
    
    // Content should remain as base64
    expect(result.data.currentVersionContent).toBe('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==');
  });

  test('should duplicate finalized image artifact', async () => {
    const spark = await createSparkWithStory();
    
    const artifactData = {
      storyId: spark.storyId,
      type: 'image'
    };

    const createResponse = await testApp.request('/api/artifacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(artifactData)
    });

    const artifact = (await createResponse.json()).data;

    // Finalize first
    await testApp.request(`/api/artifacts/${artifact.id}/finalize`, {
      method: 'POST'
    });

    // Duplicate the finalized artifact
    const duplicateResponse = await testApp.request(`/api/artifacts/${artifact.id}/duplicate`, {
      method: 'POST'
    });

    expect(duplicateResponse.status).toBe(201);
    const result = await duplicateResponse.json();
    
    expect(result.success).toBe(true);
    expect(result.data.id).not.toBe(artifact.id);
    expect(result.data.state).toBe('draft');
    expect(result.data.sourceArtifactId).toBe(artifact.id);
    expect(result.data.currentVersion).toBe(1);
    
    // Content should be copied from original
    expect(result.data.currentVersionContent).toBe('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==');
  });
});