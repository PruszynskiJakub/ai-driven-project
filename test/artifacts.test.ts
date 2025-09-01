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

    test('should not create new version when AI generates identical content', async () => {
      const spark = await createTestSparkInDb();
      const story = await createTestStoryInDb({ sparkId: spark.id });
      const artifact = await createTestArtifactInDb({ storyId: story.id, currentVersion: 1 });
      await createTestArtifactVersionInDb({ 
        artifactId: artifact.id, 
        version: 1,
        content: 'Existing content that AI will regenerate identically'
      });
      
      // Mock AI service to return the same content (this would need to be implemented in real scenario)
      const feedbackData = createValidFeedbackData({ feedback: 'Please review this content' });

      const response = await testApp.request(`/api/artifacts/${artifact.id}/iterate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feedbackData),
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        currentVersion: 1, // Should remain version 1
        currentVersionFeedback: null // Should keep original feedback, not new one
      });
      expect(result.message).toBe('Content unchanged - no new version created');

      // Verify database state - should still have only 1 version
      const artifactInDb = await getArtifactFromDb(artifact.id);
      expect(artifactInDb?.currentVersion).toBe(1);

      const versions = await getArtifactVersionsByArtifactIdFromDb(artifact.id);
      expect(versions).toHaveLength(1); // Should not create new version
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

    test('should not create new version when content is identical', async () => {
      const spark = await createTestSparkInDb();
      const story = await createTestStoryInDb({ sparkId: spark.id });
      const artifact = await createTestArtifactInDb({ storyId: story.id, currentVersion: 1 });
      const existingContent = 'Existing content in the artifact';
      await createTestArtifactVersionInDb({ 
        artifactId: artifact.id, 
        version: 1,
        content: existingContent
      });
      
      // Try to update with identical content (with whitespace variations)
      const contentData = createValidArtifactContentData({ content: '  Existing content in the artifact  \n' });

      const response = await testApp.request(`/api/artifacts/${artifact.id}/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contentData),
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        currentVersion: 1, // Should remain version 1
        currentVersionContent: existingContent, // Should keep original content
        currentVersionGenerationType: 'ai_generated' // Should keep original generation type
      });
      expect(result.message).toBe('Content unchanged - no new version created');

      // Verify database state - should still have only 1 version
      const artifactInDb = await getArtifactFromDb(artifact.id);
      expect(artifactInDb?.currentVersion).toBe(1);
      expect(artifactInDb?.updatedAt).toBeTruthy(); // Should have updated timestamp

      const versions = await getArtifactVersionsByArtifactIdFromDb(artifact.id);
      expect(versions).toHaveLength(1); // Should not create new version
      expect(versions[0].content).toBe(existingContent); // Content should be unchanged
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
      await createTestArtifactVersionInDb({ 
        artifactId: artifact1.id,
        version: 1,
        content: 'LinkedIn post content for testing contentSnippet'
      });
      
      const artifact2 = await createTestArtifactInDb({ 
        storyId: story.id,
        type: 'blog_article',
        state: 'final',
        finalizedAt: new Date().toISOString()
      });
      await createTestArtifactVersionInDb({ 
        artifactId: artifact2.id,
        version: 1,
        content: 'Blog article content that should also be included in the list'
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
      
      // Check contentSnippet is included
      expect(draftArtifact.contentSnippet).toBe('LinkedIn post content for testing contentSnippet');
      expect(finalArtifact.contentSnippet).toBe('Blog article content that should also be included in the list');
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
    
    test('should return empty contentSnippet for image artifacts', async () => {
      const spark = await createTestSparkInDb();
      const story = await createTestStoryInDb({ sparkId: spark.id });
      
      const imageArtifact = await createTestArtifactInDb({ 
        storyId: story.id,
        type: 'image',
        state: 'draft'
      });
      await createTestArtifactVersionInDb({ 
        artifactId: imageArtifact.id,
        version: 1,
        content: 'https://example.com/image.jpg'
      });

      const response = await testApp.request(`/api/stories/${story.id}/artifacts`);

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      
      expect(result.data[0].contentSnippet).toBe('');
      expect(result.data[0].type).toBe('image');
    });
  });

  describe('DELETE /api/artifacts/:id/versions/:version', () => {
    test('should remove specific version from draft artifact', async () => {
      const spark = await createTestSparkInDb();
      const story = await createTestStoryInDb({ sparkId: spark.id });
      const artifact = await createTestArtifactInDb({ storyId: story.id, currentVersion: 3 });
      
      // Create multiple versions
      await createTestArtifactVersionInDb({ 
        artifactId: artifact.id, 
        version: 1,
        content: 'Version 1 content'
      });
      await createTestArtifactVersionInDb({ 
        artifactId: artifact.id, 
        version: 2,
        content: 'Version 2 content'
      });
      await createTestArtifactVersionInDb({ 
        artifactId: artifact.id, 
        version: 3,
        content: 'Version 3 content'
      });

      const response = await testApp.request(`/api/artifacts/${artifact.id}/versions/2`, {
        method: 'DELETE'
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        currentVersion: 3, // Should remain 3 since we removed version 2
        currentVersionContent: 'Version 3 content'
      });

      // Verify database state - version 2 should be removed
      const versions = await getArtifactVersionsByArtifactIdFromDb(artifact.id);
      expect(versions).toHaveLength(2);
      expect(versions.map(v => v.version)).toEqual([1, 3]); // Version 2 should be gone
    });

    test('should remove current version and update currentVersion pointer', async () => {
      const spark = await createTestSparkInDb();
      const story = await createTestStoryInDb({ sparkId: spark.id });
      const artifact = await createTestArtifactInDb({ storyId: story.id, currentVersion: 3 });
      
      // Create multiple versions
      await createTestArtifactVersionInDb({ 
        artifactId: artifact.id, 
        version: 1,
        content: 'Version 1 content'
      });
      await createTestArtifactVersionInDb({ 
        artifactId: artifact.id, 
        version: 2,
        content: 'Version 2 content'
      });
      await createTestArtifactVersionInDb({ 
        artifactId: artifact.id, 
        version: 3,
        content: 'Version 3 content'
      });

      // Remove the current version (version 3)
      const response = await testApp.request(`/api/artifacts/${artifact.id}/versions/3`, {
        method: 'DELETE'
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        currentVersion: 2, // Should update to highest remaining version
        currentVersionContent: 'Version 2 content'
      });

      // Verify database state
      const artifactInDb = await getArtifactFromDb(artifact.id);
      expect(artifactInDb?.currentVersion).toBe(2);

      const versions = await getArtifactVersionsByArtifactIdFromDb(artifact.id);
      expect(versions).toHaveLength(2);
      expect(versions.map(v => v.version)).toEqual([1, 2]); // Version 3 should be gone
    });

    test('should reject removal from finalized artifact', async () => {
      const spark = await createTestSparkInDb();
      const story = await createTestStoryInDb({ sparkId: spark.id });
      const artifact = await createTestArtifactInDb({ 
        storyId: story.id, 
        state: 'final',
        finalizedAt: new Date().toISOString(),
        currentVersion: 2
      });
      
      await createTestArtifactVersionInDb({ 
        artifactId: artifact.id, 
        version: 1,
        content: 'Version 1 content'
      });
      await createTestArtifactVersionInDb({ 
        artifactId: artifact.id, 
        version: 2,
        content: 'Version 2 content'
      });

      const response = await testApp.request(`/api/artifacts/${artifact.id}/versions/1`, {
        method: 'DELETE'
      });

      expect(response.status).toBe(400);
      const result = await response.json();
      expect(result.error).toBe('Failed to remove version');
      expect(result.details).toContain('finalized');

      // Verify no versions were removed
      const versions = await getArtifactVersionsByArtifactIdFromDb(artifact.id);
      expect(versions).toHaveLength(2);
    });

    test('should reject removal of last remaining version', async () => {
      const spark = await createTestSparkInDb();
      const story = await createTestStoryInDb({ sparkId: spark.id });
      const artifact = await createTestArtifactInDb({ storyId: story.id, currentVersion: 1 });
      
      // Create only one version
      await createTestArtifactVersionInDb({ 
        artifactId: artifact.id, 
        version: 1,
        content: 'Only version content'
      });

      const response = await testApp.request(`/api/artifacts/${artifact.id}/versions/1`, {
        method: 'DELETE'
      });

      expect(response.status).toBe(400);
      const result = await response.json();
      expect(result.error).toBe('Failed to remove version');
      expect(result.details).toContain('last remaining');

      // Verify version was not removed
      const versions = await getArtifactVersionsByArtifactIdFromDb(artifact.id);
      expect(versions).toHaveLength(1);
    });

    test('should reject removal of non-existent version', async () => {
      const spark = await createTestSparkInDb();
      const story = await createTestStoryInDb({ sparkId: spark.id });
      const artifact = await createTestArtifactInDb({ storyId: story.id, currentVersion: 2 });
      
      await createTestArtifactVersionInDb({ 
        artifactId: artifact.id, 
        version: 1,
        content: 'Version 1 content'
      });
      await createTestArtifactVersionInDb({ 
        artifactId: artifact.id, 
        version: 2,
        content: 'Version 2 content'
      });

      const response = await testApp.request(`/api/artifacts/${artifact.id}/versions/999`, {
        method: 'DELETE'
      });

      expect(response.status).toBe(400);
      const result = await response.json();
      expect(result.error).toBe('Failed to remove version');
      expect(result.details).toContain('Version not found');

      // Verify no versions were removed
      const versions = await getArtifactVersionsByArtifactIdFromDb(artifact.id);
      expect(versions).toHaveLength(2);
    });

    test('should return 404 for non-existent artifact', async () => {
      const response = await testApp.request('/api/artifacts/non-existent-id/versions/1', {
        method: 'DELETE'
      });

      expect(response.status).toBe(404);
      const result = await response.json();
      expect(result.error).toBe('Artifact not found');
    });

    test('should return 400 for invalid version number', async () => {
      const spark = await createTestSparkInDb();
      const story = await createTestStoryInDb({ sparkId: spark.id });
      const artifact = await createTestArtifactInDb({ storyId: story.id });

      const invalidVersions = ['invalid', '0', '-1'];

      for (const version of invalidVersions) {
        const response = await testApp.request(`/api/artifacts/${artifact.id}/versions/${version}`, {
          method: 'DELETE'
        });

        expect(response.status).toBe(400);
        const result = await response.json();
        expect(result.error).toBe('Invalid version number');
      }
    });

    test('should handle version gaps correctly after removal', async () => {
      const spark = await createTestSparkInDb();
      const story = await createTestStoryInDb({ sparkId: spark.id });
      const artifact = await createTestArtifactInDb({ storyId: story.id, currentVersion: 4 });
      
      // Create versions 1, 2, 3, 4
      await createTestArtifactVersionInDb({ 
        artifactId: artifact.id, 
        version: 1,
        content: 'Version 1 content'
      });
      await createTestArtifactVersionInDb({ 
        artifactId: artifact.id, 
        version: 2,
        content: 'Version 2 content'
      });
      await createTestArtifactVersionInDb({ 
        artifactId: artifact.id, 
        version: 3,
        content: 'Version 3 content'
      });
      await createTestArtifactVersionInDb({ 
        artifactId: artifact.id, 
        version: 4,
        content: 'Version 4 content'
      });

      // Remove version 2 (creates gap: 1, 3, 4)
      const response = await testApp.request(`/api/artifacts/${artifact.id}/versions/2`, {
        method: 'DELETE'
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        currentVersion: 4, // Should remain 4
        currentVersionContent: 'Version 4 content'
      });

      // Verify database state - should have versions 1, 3, 4 (gap at 2)
      const versions = await getArtifactVersionsByArtifactIdFromDb(artifact.id);
      expect(versions).toHaveLength(3);
      expect(versions.map(v => v.version).sort()).toEqual([1, 3, 4]);
    });
  });

  describe('POST /api/artifacts/:id/versions/:version/restore', () => {
    test('should restore previous version without creating duplicate', async () => {
      const spark = await createTestSparkInDb();
      const story = await createTestStoryInDb({ sparkId: spark.id });
      const artifact = await createTestArtifactInDb({ storyId: story.id, currentVersion: 3 });
      
      // Create versions 1, 2, 3
      await createTestArtifactVersionInDb({ 
        artifactId: artifact.id, 
        version: 1,
        content: 'Version 1 content'
      });
      await createTestArtifactVersionInDb({ 
        artifactId: artifact.id, 
        version: 2,
        content: 'Version 2 content'
      });
      await createTestArtifactVersionInDb({ 
        artifactId: artifact.id, 
        version: 3,
        content: 'Version 3 content'
      });

      // Count versions before restore
      const versionsBeforeRestore = await getArtifactVersionsByArtifactIdFromDb(artifact.id);
      expect(versionsBeforeRestore).toHaveLength(3);

      // Restore to version 2
      const response = await testApp.request(`/api/artifacts/${artifact.id}/versions/2/restore`, {
        method: 'POST'
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        currentVersion: 2,
        currentVersionContent: 'Version 2 content'
      });
      expect(result.message).toBe('Version restored successfully');

      // Verify no new version was created - should still have only 3 versions
      const versionsAfterRestore = await getArtifactVersionsByArtifactIdFromDb(artifact.id);
      expect(versionsAfterRestore).toHaveLength(3);
      expect(versionsAfterRestore.map(v => v.version).sort()).toEqual([1, 2, 3]);

      // Verify artifact current version was updated
      const updatedArtifact = await getArtifactFromDb(artifact.id);
      expect(updatedArtifact.currentVersion).toBe(2);
    });

    test('should handle restore to current version gracefully', async () => {
      const spark = await createTestSparkInDb();
      const story = await createTestStoryInDb({ sparkId: spark.id });
      const artifact = await createTestArtifactInDb({ storyId: story.id, currentVersion: 2 });
      
      await createTestArtifactVersionInDb({ 
        artifactId: artifact.id, 
        version: 1,
        content: 'Version 1 content'
      });
      await createTestArtifactVersionInDb({ 
        artifactId: artifact.id, 
        version: 2,
        content: 'Version 2 content'
      });

      // Try to restore to current version (2)
      const response = await testApp.request(`/api/artifacts/${artifact.id}/versions/2/restore`, {
        method: 'POST'
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        currentVersion: 2,
        currentVersionContent: 'Version 2 content'
      });
    });

    test('should reject restore on finalized artifact', async () => {
      const spark = await createTestSparkInDb();
      const story = await createTestStoryInDb({ sparkId: spark.id });
      const artifact = await createTestArtifactInDb({ 
        storyId: story.id, 
        state: 'final',
        currentVersion: 2 
      });
      
      await createTestArtifactVersionInDb({ 
        artifactId: artifact.id, 
        version: 1,
        content: 'Version 1 content'
      });
      await createTestArtifactVersionInDb({ 
        artifactId: artifact.id, 
        version: 2,
        content: 'Version 2 content'
      });

      const response = await testApp.request(`/api/artifacts/${artifact.id}/versions/1/restore`, {
        method: 'POST'
      });

      expect(response.status).toBe(400);
      const result = await response.json();
      expect(result.error).toBe('Failed to restore version');
      expect(result.details).toContain('finalized');
    });

    test('should reject restore to non-existent version', async () => {
      const spark = await createTestSparkInDb();
      const story = await createTestStoryInDb({ sparkId: spark.id });
      const artifact = await createTestArtifactInDb({ storyId: story.id, currentVersion: 1 });
      
      await createTestArtifactVersionInDb({ 
        artifactId: artifact.id, 
        version: 1,
        content: 'Version 1 content'
      });

      const response = await testApp.request(`/api/artifacts/${artifact.id}/versions/999/restore`, {
        method: 'POST'
      });

      expect(response.status).toBe(400);
      const result = await response.json();
      expect(result.error).toBe('Failed to restore version');
      expect(result.details).toContain('Target version not found');
    });

    test('should return 404 for non-existent artifact', async () => {
      const response = await testApp.request('/api/artifacts/non-existent-id/versions/1/restore', {
        method: 'POST'
      });

      expect(response.status).toBe(404);
      const result = await response.json();
      expect(result.error).toBe('Artifact not found');
    });

    test('should return 400 for invalid version number', async () => {
      const spark = await createTestSparkInDb();
      const story = await createTestStoryInDb({ sparkId: spark.id });
      const artifact = await createTestArtifactInDb({ storyId: story.id });

      const invalidVersions = ['invalid', '0', '-1'];

      for (const version of invalidVersions) {
        const response = await testApp.request(`/api/artifacts/${artifact.id}/versions/${version}/restore`, {
          method: 'POST'
        });

        expect(response.status).toBe(400);
        const result = await response.json();
        expect(result.error).toBe('Invalid version number');
      }
    });

    test('should correctly handle version numbering after restore operations', async () => {
      const spark = await createTestSparkInDb();
      const story = await createTestStoryInDb({ sparkId: spark.id });
      const artifact = await createTestArtifactInDb({ storyId: story.id, currentVersion: 3 });
      
      // Create versions 1, 2, 3
      await createTestArtifactVersionInDb({ 
        artifactId: artifact.id, 
        version: 1,
        content: 'Version 1 content'
      });
      await createTestArtifactVersionInDb({ 
        artifactId: artifact.id, 
        version: 2,
        content: 'Version 2 content'
      });
      await createTestArtifactVersionInDb({ 
        artifactId: artifact.id, 
        version: 3,
        content: 'Version 3 content'
      });

      // Restore to version 1
      await testApp.request(`/api/artifacts/${artifact.id}/versions/1/restore`, {
        method: 'POST'
      });

      // Now add feedback to create a new version - should be version 4, not 2
      const feedbackData = createValidFeedbackData({ 
        feedback: 'Make it better' // This should trigger new version creation in test mode
      });
      
      const response = await testApp.request(`/api/artifacts/${artifact.id}/iterate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feedbackData),
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data.currentVersion).toBe(4); // Should be 4, not 2
      expect(result.data.newVersionCreated).toBe(true);

      // Verify we have versions 1, 2, 3, 4 in database
      const allVersions = await getArtifactVersionsByArtifactIdFromDb(artifact.id);
      expect(allVersions).toHaveLength(4);
      expect(allVersions.map(v => v.version).sort()).toEqual([1, 2, 3, 4]);
    });

    test('should correctly handle version numbering after restore when updating content', async () => {
      const spark = await createTestSparkInDb();
      const story = await createTestStoryInDb({ sparkId: spark.id });
      const artifact = await createTestArtifactInDb({ storyId: story.id, currentVersion: 3 });
      
      // Create versions 1, 2, 3
      await createTestArtifactVersionInDb({ 
        artifactId: artifact.id, 
        version: 1,
        content: 'Version 1 content'
      });
      await createTestArtifactVersionInDb({ 
        artifactId: artifact.id, 
        version: 2,
        content: 'Version 2 content'
      });
      await createTestArtifactVersionInDb({ 
        artifactId: artifact.id, 
        version: 3,
        content: 'Version 3 content'
      });

      // Restore to version 1
      await testApp.request(`/api/artifacts/${artifact.id}/versions/1/restore`, {
        method: 'POST'
      });

      // Now update content to create a new version - should be version 4, not 2
      const contentData = createValidArtifactContentData({ 
        content: 'New updated content'
      });
      
      const response = await testApp.request(`/api/artifacts/${artifact.id}/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contentData),
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data.currentVersion).toBe(4); // Should be 4, not 2
      expect(result.data.newVersionCreated).toBe(true);

      // Verify we have versions 1, 2, 3, 4 in database
      const allVersions = await getArtifactVersionsByArtifactIdFromDb(artifact.id);
      expect(allVersions).toHaveLength(4);
      expect(allVersions.map(v => v.version).sort()).toEqual([1, 2, 3, 4]);
    });
  });

  describe('DELETE /api/artifacts/:id', () => {
    test('should delete draft artifact and cascade delete all versions', async () => {
      const spark = await createTestSparkInDb();
      const story = await createTestStoryInDb({ sparkId: spark.id });
      const artifact = await createTestArtifactInDb({ 
        storyId: story.id, 
        state: 'draft',
        currentVersion: 3 
      });
      
      // Create multiple versions
      await createTestArtifactVersionInDb({ 
        artifactId: artifact.id, 
        version: 1,
        content: 'Version 1 content'
      });
      await createTestArtifactVersionInDb({ 
        artifactId: artifact.id, 
        version: 2,
        content: 'Version 2 content'
      });
      await createTestArtifactVersionInDb({ 
        artifactId: artifact.id, 
        version: 3,
        content: 'Version 3 content'
      });

      // Verify artifacts and versions exist before deletion
      const artifactCountBefore = await countArtifactsInDb();
      const versionCountBefore = await countArtifactVersionsInDb();
      expect(artifactCountBefore).toBeGreaterThan(0);
      expect(versionCountBefore).toBe(3);

      const response = await testApp.request(`/api/artifacts/${artifact.id}`, {
        method: 'DELETE'
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.message).toBe('Artifact and all versions deleted successfully');

      // Verify artifact and all versions were deleted
      const artifactCountAfter = await countArtifactsInDb();
      const versionCountAfter = await countArtifactVersionsInDb();
      expect(artifactCountAfter).toBe(artifactCountBefore - 1);
      expect(versionCountAfter).toBe(0);

      // Verify the artifact is no longer accessible
      const getResponse = await testApp.request(`/api/artifacts/${artifact.id}`);
      expect(getResponse.status).toBe(404);
    });

    test('should reject deletion of finalized artifact', async () => {
      const spark = await createTestSparkInDb();
      const story = await createTestStoryInDb({ sparkId: spark.id });
      const artifact = await createTestArtifactInDb({ 
        storyId: story.id, 
        state: 'final',
        currentVersion: 1 
      });
      
      await createTestArtifactVersionInDb({ 
        artifactId: artifact.id, 
        version: 1,
        content: 'Final version content'
      });

      const response = await testApp.request(`/api/artifacts/${artifact.id}`, {
        method: 'DELETE'
      });

      expect(response.status).toBe(400);
      const result = await response.json();
      expect(result.error).toBe('Failed to delete artifact');
      expect(result.details).toContain('finalized');

      // Verify artifact was not deleted
      const getResponse = await testApp.request(`/api/artifacts/${artifact.id}`);
      expect(getResponse.status).toBe(200);
    });

    test('should return 404 for non-existent artifact', async () => {
      const response = await testApp.request('/api/artifacts/non-existent-id', {
        method: 'DELETE'
      });

      expect(response.status).toBe(404);
      const result = await response.json();
      expect(result.error).toBe('Artifact not found');
    });

    test('should handle deletion of artifact with no versions gracefully', async () => {
      const spark = await createTestSparkInDb();
      const story = await createTestStoryInDb({ sparkId: spark.id });
      const artifact = await createTestArtifactInDb({ 
        storyId: story.id, 
        state: 'draft',
        currentVersion: 1 
      });
      
      // Don't create any versions - this is an edge case

      const response = await testApp.request(`/api/artifacts/${artifact.id}`, {
        method: 'DELETE'
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.message).toBe('Artifact and all versions deleted successfully');

      // Verify the artifact is no longer accessible
      const getResponse = await testApp.request(`/api/artifacts/${artifact.id}`);
      expect(getResponse.status).toBe(404);
    });
  });
});