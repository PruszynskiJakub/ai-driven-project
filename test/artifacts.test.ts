import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { 
  setupTestDatabase, 
  cleanupTestDatabase, 
  clearTestData,
  getArtifactFromDb,
  getArtifactVersionFromDb,
  getArtifactVersionsByArtifactIdFromDb,
  countArtifactsInDb,
  countArtifactVersionsInDb
} from './setup';
import {
  createValidArtifactData,
  createValidArtifactContentData,
  createValidFeedbackData,
  createInvalidArtifactData,
  createInvalidContentData,
  createInvalidFeedbackData,
  createTestSparkInDb,
  createTestStoryInDb,
  createTestArtifactInDb,
  createTestArtifactVersionInDb
} from './factories';
import { testApp } from './testApp';
import { setTestDb } from '../src/db/database';

let testDb: any;

describe('Artifacts API', () => {
  beforeEach(async () => {
    testDb = setupTestDatabase();
    setTestDb(testDb);
    clearTestData();
  });

  afterEach(() => {
    cleanupTestDatabase();
  });

  describe('POST /api/artifacts', () => {
    test('should create artifact with valid data', async () => {
      const spark = await createTestSparkInDb();
      const story = await createTestStoryInDb({ sparkId: spark.id });
      const artifactData = createValidArtifactData({ storyId: story.id });

      const response = await testApp.request('/api/artifacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(artifactData),
      });

      expect(response.status).toBe(201);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        storyId: story.id,
        type: 'linkedin_post',
        state: 'draft',
        currentVersion: 1,
        finalizedAt: null,
        sourceArtifactId: null,
        currentVersionContent: '',
        currentVersionGenerationType: 'ai_generated'
      });

      // Verify database state
      const artifactInDb = await getArtifactFromDb(result.data.id);
      expect(artifactInDb).toBeTruthy();
      expect(artifactInDb?.state).toBe('draft');
      expect(artifactInDb?.currentVersion).toBe(1);

      const versions = await getArtifactVersionsByArtifactIdFromDb(result.data.id);
      expect(versions).toHaveLength(1);
      expect(versions[0].version).toBe(1);
      expect(versions[0].generationType).toBe('ai_generated');
    });

    test('should reject invalid artifact data', async () => {
      const invalidCases = [
        'missing-storyId',
        'invalid-storyId', 
        'missing-type',
        'invalid-type'
      ];

      for (const testCase of invalidCases) {
        const invalidData = createInvalidArtifactData(testCase);
        const response = await testApp.request('/api/artifacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invalidData),
        });

        expect(response.status).toBe(400);
        const result = await response.json();
        expect(result.error).toBe('Invalid input');
      }
    });
  });

  describe('GET /api/artifacts/:id', () => {
    test('should retrieve artifact with current version', async () => {
      const spark = await createTestSparkInDb();
      const story = await createTestStoryInDb({ sparkId: spark.id });
      const artifact = await createTestArtifactInDb({ storyId: story.id });
      const version = await createTestArtifactVersionInDb({ 
        artifactId: artifact.id,
        content: 'Test content',
        generationType: 'user_edited'
      });

      const response = await testApp.request(`/api/artifacts/${artifact.id}`);

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        id: artifact.id,
        storyId: story.id,
        type: artifact.type,
        state: 'draft',
        currentVersion: 1,
        currentVersionContent: 'Test content',
        currentVersionGenerationType: 'user_edited'
      });
    });

    test('should return 404 for non-existent artifact', async () => {
      const response = await testApp.request('/api/artifacts/non-existent-id');

      expect(response.status).toBe(404);
      const result = await response.json();
      expect(result.error).toBe('Artifact not found');
    });
  });

  describe('GET /api/artifacts/:id/versions', () => {
    test('should list all versions for artifact', async () => {
      const spark = await createTestSparkInDb();
      const story = await createTestStoryInDb({ sparkId: spark.id });
      const artifact = await createTestArtifactInDb({ storyId: story.id, currentVersion: 3 });
      
      // Create multiple versions
      const version1 = await createTestArtifactVersionInDb({ 
        artifactId: artifact.id, 
        version: 1,
        content: 'Version 1 content',
        generationType: 'ai_generated'
      });
      const version2 = await createTestArtifactVersionInDb({ 
        artifactId: artifact.id, 
        version: 2,
        content: 'Version 2 content',
        userFeedback: 'Make it better',
        generationType: 'ai_generated'
      });
      const version3 = await createTestArtifactVersionInDb({ 
        artifactId: artifact.id, 
        version: 3,
        content: 'Version 3 content',
        generationType: 'user_edited'
      });

      const response = await testApp.request(`/api/artifacts/${artifact.id}/versions`);

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(3);
      
      // Should be ordered by version desc
      expect(result.data[0].version).toBe(3);
      expect(result.data[1].version).toBe(2);
      expect(result.data[2].version).toBe(1);
      
      expect(result.data[1]).toMatchObject({
        version: 2,
        content: 'Version 2 content',
        userFeedback: 'Make it better',
        generationType: 'ai_generated'
      });
    });
  });

  describe('GET /api/artifacts/:id/versions/:version', () => {
    test('should retrieve specific version', async () => {
      const spark = await createTestSparkInDb();
      const story = await createTestStoryInDb({ sparkId: spark.id });
      const artifact = await createTestArtifactInDb({ storyId: story.id });
      const version = await createTestArtifactVersionInDb({ 
        artifactId: artifact.id,
        version: 2,
        content: 'Specific version content',
        userFeedback: 'User feedback',
        generationType: 'ai_generated'
      });

      const response = await testApp.request(`/api/artifacts/${artifact.id}/versions/2`);

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        version: 2,
        content: 'Specific version content',
        userFeedback: 'User feedback',
        generationType: 'ai_generated'
      });
    });

    test('should return 404 for non-existent version', async () => {
      const spark = await createTestSparkInDb();
      const story = await createTestStoryInDb({ sparkId: spark.id });
      const artifact = await createTestArtifactInDb({ storyId: story.id });

      const response = await testApp.request(`/api/artifacts/${artifact.id}/versions/999`);

      expect(response.status).toBe(404);
      const result = await response.json();
      expect(result.error).toBe('Version not found');
    });

    test('should return 400 for invalid version number', async () => {
      const spark = await createTestSparkInDb();
      const story = await createTestStoryInDb({ sparkId: spark.id });
      const artifact = await createTestArtifactInDb({ storyId: story.id });

      const response = await testApp.request(`/api/artifacts/${artifact.id}/versions/invalid`);

      expect(response.status).toBe(400);
      const result = await response.json();
      expect(result.error).toBe('Invalid version number');
    });
  });

  describe('POST /api/artifacts/:id/iterate', () => {
    test('should add feedback and create new version for draft artifact', async () => {
      const spark = await createTestSparkInDb();
      const story = await createTestStoryInDb({ sparkId: spark.id });
      const artifact = await createTestArtifactInDb({ storyId: story.id, currentVersion: 1 });
      await createTestArtifactVersionInDb({ 
        artifactId: artifact.id, 
        version: 1,
        content: 'Original content'
      });
      
      const feedbackData = createValidFeedbackData({ feedback: 'Make it more engaging' });

      const response = await testApp.request(`/api/artifacts/${artifact.id}/iterate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feedbackData),
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        currentVersion: 2,
        currentVersionFeedback: 'Make it more engaging',
        currentVersionGenerationType: 'ai_generated'
      });

      // Verify database state
      const artifactInDb = await getArtifactFromDb(artifact.id);
      expect(artifactInDb?.currentVersion).toBe(2);

      const versions = await getArtifactVersionsByArtifactIdFromDb(artifact.id);
      expect(versions).toHaveLength(2);
      
      const newVersion = versions.find(v => v.version === 2);
      expect(newVersion).toBeTruthy();
      expect(newVersion?.userFeedback).toBe('Make it more engaging');
      expect(newVersion?.generationType).toBe('ai_generated');
    });

    test('should reject feedback for finalized artifact', async () => {
      const spark = await createTestSparkInDb();
      const story = await createTestStoryInDb({ sparkId: spark.id });
      const artifact = await createTestArtifactInDb({ 
        storyId: story.id, 
        state: 'final',
        finalizedAt: new Date().toISOString()
      });
      
      const feedbackData = createValidFeedbackData();

      const response = await testApp.request(`/api/artifacts/${artifact.id}/iterate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feedbackData),
      });

      expect(response.status).toBe(400);
      const result = await response.json();
      expect(result.details).toContain('finalized');
    });

    test('should reject invalid feedback data', async () => {
      const spark = await createTestSparkInDb();
      const story = await createTestStoryInDb({ sparkId: spark.id });
      const artifact = await createTestArtifactInDb({ storyId: story.id });

      const invalidCases = ['empty-feedback', 'feedback-too-long', 'non-string-feedback'];

      for (const testCase of invalidCases) {
        const invalidData = createInvalidFeedbackData(testCase);
        const response = await testApp.request(`/api/artifacts/${artifact.id}/iterate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invalidData),
        });

        expect(response.status).toBe(400);
        const result = await response.json();
        expect(result.error).toBe('Invalid input');
      }
    });
  });

  describe('PUT /api/artifacts/:id/content', () => {
    test('should update content and create new version for draft artifact', async () => {
      const spark = await createTestSparkInDb();
      const story = await createTestStoryInDb({ sparkId: spark.id });
      const artifact = await createTestArtifactInDb({ storyId: story.id, currentVersion: 1 });
      await createTestArtifactVersionInDb({ 
        artifactId: artifact.id, 
        version: 1,
        content: 'Original content'
      });
      
      const contentData = createValidArtifactContentData({ content: 'Manually edited content' });

      const response = await testApp.request(`/api/artifacts/${artifact.id}/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contentData),
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        currentVersion: 2,
        currentVersionContent: 'Manually edited content',
        currentVersionFeedback: null,
        currentVersionGenerationType: 'user_edited'
      });

      // Verify database state
      const artifactInDb = await getArtifactFromDb(artifact.id);
      expect(artifactInDb?.currentVersion).toBe(2);

      const versions = await getArtifactVersionsByArtifactIdFromDb(artifact.id);
      expect(versions).toHaveLength(2);
      
      const newVersion = versions.find(v => v.version === 2);
      expect(newVersion).toBeTruthy();
      expect(newVersion?.content).toBe('Manually edited content');
      expect(newVersion?.userFeedback).toBe(null);
      expect(newVersion?.generationType).toBe('user_edited');
    });

    test('should reject content update for finalized artifact', async () => {
      const spark = await createTestSparkInDb();
      const story = await createTestStoryInDb({ sparkId: spark.id });
      const artifact = await createTestArtifactInDb({ 
        storyId: story.id, 
        state: 'final',
        finalizedAt: new Date().toISOString()
      });
      
      const contentData = createValidArtifactContentData();

      const response = await testApp.request(`/api/artifacts/${artifact.id}/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contentData),
      });

      expect(response.status).toBe(400);
      const result = await response.json();
      expect(result.details).toContain('finalized');
    });

    test('should reject invalid content data', async () => {
      const spark = await createTestSparkInDb();
      const story = await createTestStoryInDb({ sparkId: spark.id });
      const artifact = await createTestArtifactInDb({ storyId: story.id });

      const invalidCases = ['empty-content', 'content-too-long', 'non-string-content'];

      for (const testCase of invalidCases) {
        const invalidData = createInvalidContentData(testCase);
        const response = await testApp.request(`/api/artifacts/${artifact.id}/content`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invalidData),
        });

        expect(response.status).toBe(400);
        const result = await response.json();
        expect(result.error).toBe('Invalid input');
      }
    });
  });

  describe('POST /api/artifacts/:id/finalize', () => {
    test('should finalize draft artifact with non-empty content', async () => {
      const spark = await createTestSparkInDb();
      const story = await createTestStoryInDb({ sparkId: spark.id });
      const artifact = await createTestArtifactInDb({ storyId: story.id });
      await createTestArtifactVersionInDb({ 
        artifactId: artifact.id,
        content: 'Content ready for finalization'
      });

      const response = await testApp.request(`/api/artifacts/${artifact.id}/finalize`, {
        method: 'POST',
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        state: 'final',
        currentVersionContent: 'Content ready for finalization'
      });
      expect(result.data.finalizedAt).toBeTruthy();

      // Verify database state
      const artifactInDb = await getArtifactFromDb(artifact.id);
      expect(artifactInDb?.state).toBe('final');
      expect(artifactInDb?.finalizedAt).toBeTruthy();
    });

    test('should reject finalization of already finalized artifact', async () => {
      const spark = await createTestSparkInDb();
      const story = await createTestStoryInDb({ sparkId: spark.id });
      const artifact = await createTestArtifactInDb({ 
        storyId: story.id,
        state: 'final',
        finalizedAt: new Date().toISOString()
      });

      const response = await testApp.request(`/api/artifacts/${artifact.id}/finalize`, {
        method: 'POST',
      });

      expect(response.status).toBe(400);
      const result = await response.json();
      expect(result.details).toContain('already finalized');
    });

    test('should reject finalization with empty content', async () => {
      const spark = await createTestSparkInDb();
      const story = await createTestStoryInDb({ sparkId: spark.id });
      const artifact = await createTestArtifactInDb({ storyId: story.id });
      await createTestArtifactVersionInDb({ 
        artifactId: artifact.id,
        content: '' // Empty content
      });

      const response = await testApp.request(`/api/artifacts/${artifact.id}/finalize`, {
        method: 'POST',
      });

      expect(response.status).toBe(400);
      const result = await response.json();
      expect(result.details).toContain('empty content');
    });
  });

  describe('POST /api/artifacts/:id/duplicate', () => {
    test('should duplicate finalized artifact as new draft', async () => {
      const spark = await createTestSparkInDb();
      const story = await createTestStoryInDb({ sparkId: spark.id });
      const originalArtifact = await createTestArtifactInDb({ 
        storyId: story.id,
        state: 'final',
        finalizedAt: new Date().toISOString(),
        currentVersion: 2
      });
      await createTestArtifactVersionInDb({ 
        artifactId: originalArtifact.id,
        version: 2,
        content: 'Final version content to duplicate'
      });

      const response = await testApp.request(`/api/artifacts/${originalArtifact.id}/duplicate`, {
        method: 'POST',
      });

      expect(response.status).toBe(201);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        storyId: story.id,
        state: 'draft',
        currentVersion: 1,
        finalizedAt: null,
        sourceArtifactId: originalArtifact.id,
        currentVersionContent: 'Final version content to duplicate',
        currentVersionGenerationType: 'ai_generated'
      });
      expect(result.data.id).not.toBe(originalArtifact.id);

      // Verify database state
      const newArtifactInDb = await getArtifactFromDb(result.data.id);
      expect(newArtifactInDb?.state).toBe('draft');
      expect(newArtifactInDb?.sourceArtifactId).toBe(originalArtifact.id);

      const versions = await getArtifactVersionsByArtifactIdFromDb(result.data.id);
      expect(versions).toHaveLength(1);
      expect(versions[0].version).toBe(1);
      expect(versions[0].content).toBe('Final version content to duplicate');
    });

    test('should reject duplication of non-finalized artifact', async () => {
      const spark = await createTestSparkInDb();
      const story = await createTestStoryInDb({ sparkId: spark.id });
      const artifact = await createTestArtifactInDb({ 
        storyId: story.id,
        state: 'draft' // Not finalized
      });

      const response = await testApp.request(`/api/artifacts/${artifact.id}/duplicate`, {
        method: 'POST',
      });

      expect(response.status).toBe(400);
      const result = await response.json();
      expect(result.details).toContain('finalized');
    });
  });

  describe('GET /api/stories/:storyId/artifacts', () => {
    test('should list all artifacts for a story', async () => {
      const spark = await createTestSparkInDb();
      const story = await createTestStoryInDb({ sparkId: spark.id });
      
      // Create multiple artifacts
      const artifact1 = await createTestArtifactInDb({ 
        storyId: story.id,
        type: 'linkedin_post',
        state: 'draft'
      });
      const artifact2 = await createTestArtifactInDb({ 
        storyId: story.id,
        type: 'blog_article',
        state: 'final',
        finalizedAt: new Date().toISOString()
      });

      const response = await testApp.request(`/api/stories/${story.id}/artifacts`);

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      
      // Should include both artifacts
      const artifactIds = result.data.map((a: any) => a.id);
      expect(artifactIds).toContain(artifact1.id);
      expect(artifactIds).toContain(artifact2.id);
      
      // Check artifact details
      const draftArtifact = result.data.find((a: any) => a.id === artifact1.id);
      expect(draftArtifact).toMatchObject({
        type: 'linkedin_post',
        state: 'draft',
        finalizedAt: null
      });
      
      const finalArtifact = result.data.find((a: any) => a.id === artifact2.id);
      expect(finalArtifact).toMatchObject({
        type: 'blog_article',
        state: 'final'
      });
      expect(finalArtifact.finalizedAt).toBeTruthy();
    });

    test('should return empty array for story with no artifacts', async () => {
      const spark = await createTestSparkInDb();
      const story = await createTestStoryInDb({ sparkId: spark.id });

      const response = await testApp.request(`/api/stories/${story.id}/artifacts`);

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });
});