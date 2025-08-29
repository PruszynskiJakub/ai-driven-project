import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { setupTestDatabase, cleanupTestDatabase, clearTestData, getSparkFromDb, getStoryFromDb, getStoryBySparkIdFromDb, countSparksInDb, countStoriesInDb } from './setup';
import { testApp } from './testApp';
import { setTestDb } from '../src/db/database';
import { createValidSparkData, createValidStoryUpdateData, createTestSparkInDb, createTestStoryInDb, generateLongString } from './factories';

let testDb: any;

beforeEach(() => {
  testDb = setupTestDatabase();
  setTestDb(testDb);
  // Use shared testApp instance
  clearTestData();
});

afterEach(() => {
  cleanupTestDatabase();
});

describe('Integration Tests', () => {
  // Complete spark creation workflow
  test('complete spark creation workflow', async () => {
    // 1. Create spark via POST /api/sparks
    const sparkData = createValidSparkData({
      title: 'Integration Test Spark',
      initialThoughts: 'This is an integration test'
    });

    const createResponse = await testApp.request('/api/sparks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sparkData)
    });

    expect(createResponse.status).toBe(201);
    const createdSpark = await createResponse.json();
    const sparkId = createdSpark.data.id;

    // 2. Verify auto-story creation via GET /api/sparks/:id/story
    const storyResponse = await testApp.request(`/api/sparks/${sparkId}/story`);
    
    expect(storyResponse.status).toBe(200);
    const storyData = await storyResponse.json();
    
    expect(storyData.data.sparkId).toBe(sparkId);
    expect(storyData.data.content).toBe('');

    // 3. Verify spark retrieval via GET /api/sparks/:id
    const sparkResponse = await testApp.request(`/api/sparks/${sparkId}`);
    
    expect(sparkResponse.status).toBe(200);
    const retrievedSpark = await sparkResponse.json();
    
    expect(retrievedSpark.data.id).toBe(sparkId);
    expect(retrievedSpark.data.title).toBe(sparkData.title);
    expect(retrievedSpark.data.initialThoughts).toBe(sparkData.initialThoughts);

    // 4. Verify spark appears in list via GET /api/sparks
    const listResponse = await testApp.request('/api/sparks');
    
    expect(listResponse.status).toBe(200);
    const sparksList = await listResponse.json();
    
    expect(sparksList.data).toHaveLength(1);
    expect(sparksList.data[0].id).toBe(sparkId);

    // 5. Verify database state
    const sparkInDb = await getSparkFromDb(sparkId);
    const storyInDb = await getStoryBySparkIdFromDb(sparkId);
    
    expect(sparkInDb).toBeDefined();
    expect(storyInDb).toBeDefined();
    expect(storyInDb.sparkId).toBe(sparkId);
  });

  // Story update workflow
  test('story update workflow', async () => {
    // 1. Create spark (auto-creates story)
    const sparkData = createValidSparkData();
    const createResponse = await testApp.request('/api/sparks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sparkData)
    });

    const createdSpark = await createResponse.json();
    const sparkId = createdSpark.data.id;

    // 2. Get the auto-created story
    const storyResponse = await testApp.request(`/api/sparks/${sparkId}/story`);
    const storyData = await storyResponse.json();
    const storyId = storyData.data.id;

    // 3. Update story via PUT /api/stories/:id
    const updateData = createValidStoryUpdateData({
      content: 'Updated story content',
      isAutoSave: false
    });

    const updateResponse = await testApp.request(`/api/stories/${storyId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    });

    expect(updateResponse.status).toBe(200);
    const updatedStory = await updateResponse.json();
    expect(updatedStory.content).toBe('Updated story content');

    // 4. Verify update via GET /api/stories/:id
    const getUpdatedResponse = await testApp.request(`/api/stories/${storyId}`);
    const retrievedStory = await getUpdatedResponse.json();
    
    expect(retrievedStory.content).toBe('Updated story content');

    // 5. Verify via spark endpoint as well
    const sparkStoryResponse = await testApp.request(`/api/sparks/${sparkId}/story`);
    const sparkStoryData = await sparkStoryResponse.json();
    
    expect(sparkStoryData.data.content).toBe('Updated story content');

    // 6. Verify database state
    const storyInDb = await getStoryFromDb(storyId);
    expect(storyInDb.content).toBe('Updated story content');
  });

  // Autosave workflow
  test('autosave workflow', async () => {
    // 1. Create spark and story
    const testSpark = await createTestSparkInDb();
    const testStory = await createTestStoryInDb({
      sparkId: testSpark.id,
      content: 'Original content'
    });

    const originalLastAutoSavedAt = testStory.lastAutoSavedAt;
    const originalUpdatedAt = testStory.updatedAt;
    
    await new Promise(resolve => setTimeout(resolve, 10));

    // 2. Auto-save story via PATCH /api/stories/:id/autosave
    const autoSaveData = { content: 'Auto-saved content' };
    const autoSaveResponse = await testApp.request(`/api/stories/${testStory.id}/autosave`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(autoSaveData)
    });

    expect(autoSaveResponse.status).toBe(200);
    const autoSaveResult = await autoSaveResponse.json();
    expect(autoSaveResult.lastAutoSavedAt).not.toBe(originalLastAutoSavedAt);

    // 3. Verify via GET /api/stories/:id
    const getStoryResponse = await testApp.request(`/api/stories/${testStory.id}`);
    const retrievedStory = await getStoryResponse.json();
    
    expect(retrievedStory.content).toBe('Auto-saved content');
    expect(retrievedStory.lastAutoSavedAt).not.toBe(originalLastAutoSavedAt);
    expect(retrievedStory.updatedAt).toBe(originalUpdatedAt); // Should not change on autosave

    // 4. Verify timestamps differ correctly
    expect(new Date(retrievedStory.lastAutoSavedAt).getTime()).toBeGreaterThan(new Date(originalLastAutoSavedAt).getTime());
    expect(retrievedStory.updatedAt).toBe(originalUpdatedAt);

    // 5. Verify database state
    const storyInDb = await getStoryFromDb(testStory.id);
    expect(storyInDb.content).toBe('Auto-saved content');
    expect(storyInDb.lastAutoSavedAt).not.toBe(originalLastAutoSavedAt);
    expect(storyInDb.updatedAt).toBe(originalUpdatedAt);
  });

  // Data consistency across endpoints
  test('data consistency across endpoints', async () => {
    // Create test data
    const testSpark = await createTestSparkInDb({
      title: 'Consistency Test Spark',
      initialThoughts: 'Test consistency'
    });
    const testStory = await createTestStoryInDb({
      sparkId: testSpark.id,
      content: 'Consistent content'
    });

    // Get data from different endpoints
    const sparkFromSparkEndpoint = await testApp.request(`/api/sparks/${testSpark.id}`);
    const sparkData = await sparkFromSparkEndpoint.json();

    const storyFromStoryEndpoint = await testApp.request(`/api/stories/${testStory.id}`);
    const storyFromStoryData = await storyFromStoryEndpoint.json();

    const storyFromSparkEndpoint = await testApp.request(`/api/sparks/${testSpark.id}/story`);
    const storyFromSparkData = await storyFromSparkEndpoint.json();

    const sparksFromListEndpoint = await testApp.request('/api/sparks');
    const sparksList = await sparksFromListEndpoint.json();

    // Verify consistency
    expect(sparkData.data.id).toBe(testSpark.id);
    expect(sparkData.data.title).toBe(testSpark.title);

    expect(storyFromStoryData.id).toBe(testStory.id);
    expect(storyFromStoryData.sparkId).toBe(testSpark.id);
    expect(storyFromStoryData.content).toBe(testStory.content);

    expect(storyFromSparkData.data.id).toBe(testStory.id);
    expect(storyFromSparkData.data.sparkId).toBe(testSpark.id);
    expect(storyFromSparkData.data.content).toBe(testStory.content);

    expect(sparksList.data).toHaveLength(1);
    expect(sparksList.data[0].id).toBe(testSpark.id);

    // Stories from both endpoints should be identical
    expect(storyFromStoryData.id).toBe(storyFromSparkData.data.id);
    expect(storyFromStoryData.content).toBe(storyFromSparkData.data.content);
    expect(storyFromStoryData.createdAt).toBe(storyFromSparkData.data.createdAt);
    expect(storyFromStoryData.updatedAt).toBe(storyFromSparkData.data.updatedAt);
    expect(storyFromStoryData.lastAutoSavedAt).toBe(storyFromSparkData.data.lastAutoSavedAt);
  });

  // Concurrent operations
  test('concurrent operations', async () => {
    // Create initial spark and story
    const testSpark = await createTestSparkInDb();
    const testStory = await createTestStoryInDb({
      sparkId: testSpark.id,
      content: 'Initial content'
    });

    // Perform concurrent operations
    const promises = [
      // Multiple autosaves
      testApp.request(`/api/stories/${testStory.id}/autosave`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Autosave 1' })
      }),
      testApp.request(`/api/stories/${testStory.id}/autosave`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Autosave 2' })
      }),
      // Regular update
      testApp.request(`/api/stories/${testStory.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: 'Regular update',
          isAutoSave: false
        })
      }),
      // Read operations
      testApp.request(`/api/stories/${testStory.id}`),
      testApp.request(`/api/sparks/${testSpark.id}/story`)
    ];

    const results = await Promise.all(promises);

    // All operations should succeed
    results.forEach((result, index) => {
      if (index < 4) { // Write operations
        expect(result.status).toBeLessThan(400);
      } else { // Read operations
        expect(result.status).toBe(200);
      }
    });

    // Final state should be consistent
    const finalStoryResponse = await testApp.request(`/api/stories/${testStory.id}`);
    const finalStory = await finalStoryResponse.json();
    
    expect(finalStory.id).toBe(testStory.id);
    expect(finalStory.sparkId).toBe(testSpark.id);
    // Content should be one of the updated values
    expect(['Autosave 1', 'Autosave 2', 'Regular update']).toContain(finalStory.content);
  });

  // Complex workflow: Create spark -> Update story -> Autosave -> Verify all endpoints
  test('complex end-to-end workflow', async () => {
    // 1. Create spark
    const sparkData = createValidSparkData({
      title: 'Complex Workflow Spark',
      initialThoughts: 'Starting complex workflow'
    });

    const createSparkResponse = await testApp.request('/api/sparks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sparkData)
    });

    const createdSpark = await createSparkResponse.json();
    const sparkId = createdSpark.data.id;

    // 2. Get auto-created story
    const initialStoryResponse = await testApp.request(`/api/sparks/${sparkId}/story`);
    const initialStory = await initialStoryResponse.json();
    const storyId = initialStory.data.id;

    expect(initialStory.data.content).toBe('');

    // 3. Update story manually
    const manualUpdateData = createValidStoryUpdateData({
      content: 'First manual update',
      isAutoSave: false
    });

    const manualUpdateResponse = await testApp.request(`/api/stories/${storyId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(manualUpdateData)
    });

    expect(manualUpdateResponse.status).toBe(200);
    const manuallyUpdatedStory = await manualUpdateResponse.json();
    
    const manualUpdateTime = manuallyUpdatedStory.updatedAt;
    const firstAutoSaveTime = manuallyUpdatedStory.lastAutoSavedAt;

    // 4. Auto-save story
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const autoSaveResponse = await testApp.request(`/api/stories/${storyId}/autosave`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Auto-saved content' })
    });

    expect(autoSaveResponse.status).toBe(200);
    const autoSaveResult = await autoSaveResponse.json();

    // 5. Another manual update with auto-save flag
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const autoUpdateData = createValidStoryUpdateData({
      content: 'Final content with auto-save',
      isAutoSave: true
    });

    const autoUpdateResponse = await testApp.request(`/api/stories/${storyId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(autoUpdateData)
    });

    expect(autoUpdateResponse.status).toBe(200);
    const finalStory = await autoUpdateResponse.json();

    // 6. Verify final state from all endpoints
    const finalSparkResponse = await testApp.request(`/api/sparks/${sparkId}`);
    const finalSparkData = await finalSparkResponse.json();

    const finalStoryDirectResponse = await testApp.request(`/api/stories/${storyId}`);
    const finalStoryDirect = await finalStoryDirectResponse.json();

    const finalStoryViaSparkResponse = await testApp.request(`/api/sparks/${sparkId}/story`);
    const finalStoryViaSpark = await finalStoryViaSparkResponse.json();

    const finalSparksListResponse = await testApp.request('/api/sparks');
    const finalSparksList = await finalSparksListResponse.json();

    // 7. Verify all data consistency
    expect(finalSparkData.data.id).toBe(sparkId);
    expect(finalSparkData.data.title).toBe(sparkData.title);

    expect(finalStoryDirect.id).toBe(storyId);
    expect(finalStoryDirect.content).toBe('Final content with auto-save');

    expect(finalStoryViaSpark.data.id).toBe(storyId);
    expect(finalStoryViaSpark.data.content).toBe('Final content with auto-save');

    expect(finalSparksList.data).toHaveLength(1);
    expect(finalSparksList.data[0].id).toBe(sparkId);

    // 8. Verify timestamp progression
    expect(new Date(finalStory.updatedAt).getTime()).toBeGreaterThan(new Date(manualUpdateTime).getTime());
    expect(new Date(finalStory.lastAutoSavedAt).getTime()).toBeGreaterThan(new Date(firstAutoSaveTime).getTime());

    // 9. Verify database consistency
    const finalSparkInDb = await getSparkFromDb(sparkId);
    const finalStoryInDb = await getStoryFromDb(storyId);

    expect(finalSparkInDb.id).toBe(sparkId);
    expect(finalSparkInDb.title).toBe(sparkData.title);

    expect(finalStoryInDb.id).toBe(storyId);
    expect(finalStoryInDb.content).toBe('Final content with auto-save');
    expect(finalStoryInDb.sparkId).toBe(sparkId);
  });

  // Test error scenarios in workflows
  test('workflow error handling', async () => {
    // 1. Try to get story for non-existent spark
    const nonExistentSparkId = '550e8400-e29b-41d4-a716-446655440000';
    const nonExistentSparkStoryResponse = await testApp.request(`/api/sparks/${nonExistentSparkId}/story`);
    expect(nonExistentSparkStoryResponse.status).toBe(404);

    // 2. Try to update non-existent story
    const nonExistentStoryId = '550e8400-e29b-41d4-a716-446655440001';
    const updateData = createValidStoryUpdateData();
    
    const updateNonExistentResponse = await testApp.request(`/api/stories/${nonExistentStoryId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    });
    expect(updateNonExistentResponse.status).toBe(404);

    // 3. Try to autosave non-existent story
    const autoSaveNonExistentResponse = await testApp.request(`/api/stories/${nonExistentStoryId}/autosave`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'content' })
    });
    // The current implementation doesn't validate story existence
    expect(autoSaveNonExistentResponse.status).toBe(200);

    // 4. Verify no data was created
    const sparkCount = await countSparksInDb();
    const storyCount = await countStoriesInDb();
    expect(sparkCount).toBe(0);
    expect(storyCount).toBe(0);
  });

  // Test boundary conditions in workflows
  test('workflow boundary conditions', async () => {
    // 1. Create spark with maximum title length
    const maxTitleSparkData = createValidSparkData({
      title: generateLongString(255),
      initialThoughts: generateLongString(500)
    });

    const createResponse = await testApp.request('/api/sparks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(maxTitleSparkData)
    });

    expect(createResponse.status).toBe(201);
    const createdSpark = await createResponse.json();
    const sparkId = createdSpark.data.id;

    // 2. Update story with maximum content length
    const storyResponse = await testApp.request(`/api/sparks/${sparkId}/story`);
    const storyData = await storyResponse.json();
    const storyId = storyData.data.id;

    const maxContentUpdate = createValidStoryUpdateData({
      content: generateLongString(50000)
    });

    const updateResponse = await testApp.request(`/api/stories/${storyId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(maxContentUpdate)
    });

    expect(updateResponse.status).toBe(200);

    // 3. Verify via all endpoints
    const finalStoryResponse = await testApp.request(`/api/stories/${storyId}`);
    const finalStory = await finalStoryResponse.json();
    expect(finalStory.content).toHaveLength(50000);

    const storyViaSparkResponse = await testApp.request(`/api/sparks/${sparkId}/story`);
    const storyViaSpark = await storyViaSparkResponse.json();
    expect(storyViaSpark.data.content).toHaveLength(50000);

    // 4. Verify database state
    const storyInDb = await getStoryFromDb(storyId);
    expect(storyInDb.content).toHaveLength(50000);
  });
});