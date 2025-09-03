import {afterEach, beforeEach, describe, expect, test} from 'bun:test';
import {
    cleanupTestDatabase,
    clearTestData,
    countSparksInDb,
    getSparkFromDb,
    getStoryBySparkIdFromDb,
    setupTestDatabase
} from './setup';
import {testApp} from './testApp';
import {setTestDb} from '../src/db/database';
import {createInvalidSparkData, createTestSparkInDb, createTestStoryInDb, createValidSparkData} from './factories';
import {isoNow} from '../src/utils/datetime';

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

describe('POST /api/sparks', () => {
  // Happy Path Tests
  test('creates spark with title and initialThoughts', async () => {
    const sparkData = createValidSparkData({
      title: 'My Test Spark',
      initialThoughts: 'This is a great idea'
    });

    const response = await testApp.request('/api/sparks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sparkData)
    });

    expect(response.status).toBe(201);
    const result = await response.json();
    
    expect(result.success).toBe(true);
    expect(result.message).toBe('Spark created successfully');
    expect(result.data.title).toBe(sparkData.title);
    expect(result.data.initialThoughts).toBe(sparkData.initialThoughts);
    expect(result.data.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(result.data.createdAt).toBeDefined();
    expect(result.data.updatedAt).toBeDefined();

    // Verify in database
    const sparkInDb = await getSparkFromDb(result.data.id);
    expect(sparkInDb).toBeDefined();
    expect(sparkInDb.title).toBe(sparkData.title);
    expect(sparkInDb.initialThoughts).toBe(sparkData.initialThoughts);
  });

  test('creates spark with title only (initialThoughts omitted)', async () => {
    const sparkData = { title: 'Title Only Spark' };

    const response = await testApp.request('/api/sparks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sparkData)
    });

    expect(response.status).toBe(201);
    const result = await response.json();
    
    expect(result.data.title).toBe(sparkData.title);
    expect(result.data.initialThoughts).toBeUndefined();

    // Verify in database
    const sparkInDb = await getSparkFromDb(result.data.id);
    expect(sparkInDb.initialThoughts).toBeNull();
  });

  test('auto-creates empty story for new spark', async () => {
    const sparkData = createValidSparkData();

    const response = await testApp.request('/api/sparks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sparkData)
    });

    expect(response.status).toBe(201);
    const result = await response.json();

    // Verify auto-created story exists
    const storyInDb = await getStoryBySparkIdFromDb(result.data.id);
    expect(storyInDb).toBeDefined();
    expect(storyInDb.sparkId).toBe(result.data.id);
    expect(storyInDb.content).toBe('');
    expect(storyInDb.createdAt).toBeDefined();
    expect(storyInDb.lastAutoSavedAt).toBeDefined();
  });

  test('returns correct response structure with 201 status', async () => {
    const sparkData = createValidSparkData();

    const response = await testApp.request('/api/sparks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sparkData)
    });

    expect(response.status).toBe(201);
    const result = await response.json();
    
    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('message');
    expect(result.data).toHaveProperty('id');
    expect(result.data).toHaveProperty('title');
    expect(result.data).toHaveProperty('createdAt');
    expect(result.data).toHaveProperty('updatedAt');
  });

  test('sets createdAt and updatedAt timestamps', async () => {
    const beforeTime = isoNow()
    const sparkData = createValidSparkData();

    const response = await testApp.request('/api/sparks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sparkData)
    });

    const result = await response.json();
    const afterTime = isoNow()
    
    expect(result.data.createdAt >= beforeTime).toBe(true);
    expect(result.data.createdAt <= afterTime).toBe(true);
    expect(result.data.updatedAt >= beforeTime).toBe(true);
    expect(result.data.updatedAt <= afterTime).toBe(true);
    expect(result.data.createdAt).toBe(result.data.updatedAt);
  });

  test('generates valid UUID for spark ID', async () => {
    const sparkData = createValidSparkData();

    const response = await testApp.request('/api/sparks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sparkData)
    });

    const result = await response.json();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    expect(result.data.id).toMatch(uuidRegex);
  });

  // Validation Tests
  test('rejects missing title (400)', async () => {
    const invalidData = createInvalidSparkData('missing-title');

    const response = await testApp.request('/api/sparks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidData)
    });

    expect(response.status).toBe(400);
    const result = await response.json();
    expect(result.error).toBe('Invalid input');
    expect(result.details).toBeDefined();

    // Verify no spark created in database
    const sparkCount = await countSparksInDb();
    expect(sparkCount).toBe(0);
  });

  test('rejects empty title after trim (400)', async () => {
    const invalidData = { title: '   ', initialThoughts: 'some thoughts' };

    const response = await testApp.request('/api/sparks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidData)
    });

    expect(response.status).toBe(400);
    const result = await response.json();
    expect(result.error).toBe('Invalid input');
  });

  test('rejects title over 255 characters (400)', async () => {
    const invalidData = createInvalidSparkData('title-too-long');

    const response = await testApp.request('/api/sparks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidData)
    });

    expect(response.status).toBe(400);
    const result = await response.json();
    expect(result.error).toBe('Invalid input');
  });

  test('rejects initialThoughts over 500 characters (400)', async () => {
    const invalidData = createInvalidSparkData('thoughts-too-long');

    const response = await testApp.request('/api/sparks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidData)
    });

    expect(response.status).toBe(400);
    const result = await response.json();
    expect(result.error).toBe('Invalid input');
  });

  test('rejects invalid request body structure (400)', async () => {
    const invalidData = 'not json object';

    const response = await testApp.request('/api/sparks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: invalidData
    });

    expect(response.status).toBe(400);
  });

  test('rejects non-string title (400)', async () => {
    const invalidData = createInvalidSparkData('non-string-title');

    const response = await testApp.request('/api/sparks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidData)
    });

    expect(response.status).toBe(400);
    const result = await response.json();
    expect(result.error).toBe('Invalid input');
  });

  test('rejects non-string initialThoughts (400)', async () => {
    const invalidData = createInvalidSparkData('non-string-thoughts');

    const response = await testApp.request('/api/sparks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidData)
    });

    expect(response.status).toBe(400);
    const result = await response.json();
    expect(result.error).toBe('Invalid input');
  });

  // Database State Assertions
  test('verifies spark exists in database after creation', async () => {
    const sparkData = createValidSparkData();

    const response = await testApp.request('/api/sparks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sparkData)
    });

    const result = await response.json();
    const sparkInDb = await getSparkFromDb(result.data.id);
    
    expect(sparkInDb).toBeDefined();
    expect(sparkInDb.id).toBe(result.data.id);
    expect(sparkInDb.title).toBe(sparkData.title);
    expect(sparkInDb.userId).toBe('default_user');
  });

  test('verifies auto-created story exists with correct sparkId', async () => {
    const sparkData = createValidSparkData();

    const response = await testApp.request('/api/sparks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sparkData)
    });

    const result = await response.json();
    const storyInDb = await getStoryBySparkIdFromDb(result.data.id);
    
    expect(storyInDb).toBeDefined();
    expect(storyInDb.sparkId).toBe(result.data.id);
  });

  test('verifies story has empty content initially', async () => {
    const sparkData = createValidSparkData();

    const response = await testApp.request('/api/sparks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sparkData)
    });

    const result = await response.json();
    const storyInDb = await getStoryBySparkIdFromDb(result.data.id);
    
    expect(storyInDb.content).toBe('');
  });
});

describe('GET /api/sparks', () => {
  // Happy Path Tests
  test('returns empty array when no sparks exist', async () => {
    const response = await testApp.request('/api/sparks');

    expect(response.status).toBe(200);
    const result = await response.json();
    
    expect(result.success).toBe(true);
    expect(result.message).toBe('Sparks retrieved successfully');
    expect(result.data).toEqual([]);
  });

  test('returns single spark correctly', async () => {
    const testSpark = await createTestSparkInDb({
      title: 'Single Test Spark',
      initialThoughts: 'Test thoughts'
    });

    const response = await testApp.request('/api/sparks');

    expect(response.status).toBe(200);
    const result = await response.json();
    
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe(testSpark.id);
    expect(result.data[0].title).toBe(testSpark.title);
    expect(result.data[0].initialThoughts).toBe(testSpark.initialThoughts);
  });

  test('returns multiple sparks ordered by createdAt desc (newest first)', async () => {
    // Create sparks with different timestamps
    const oldSpark = await createTestSparkInDb({
      title: 'Old Spark',
      createdAt: '2023-01-01T00:00:00.000Z'
    });
    
    const newSpark = await createTestSparkInDb({
      title: 'New Spark',
      createdAt: '2023-12-01T00:00:00.000Z'
    });

    const response = await testApp.request('/api/sparks');

    expect(response.status).toBe(200);
    const result = await response.json();
    
    expect(result.data).toHaveLength(2);
    expect(result.data[0].title).toBe('New Spark'); // newest first
    expect(result.data[1].title).toBe('Old Spark'); // oldest last
  });

  test('returns correct response structure with 200 status', async () => {
    await createTestSparkInDb();

    const response = await testApp.request('/api/sparks');

    expect(response.status).toBe(200);
    const result = await response.json();
    
    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('message');
    expect(Array.isArray(result.data)).toBe(true);
  });

  test('includes optional initialThoughts when present', async () => {
    await createTestSparkInDb({
      title: 'Spark with thoughts',
      initialThoughts: 'These are my thoughts'
    });

    const response = await testApp.request('/api/sparks');
    const result = await response.json();
    
    expect(result.data[0].initialThoughts).toBe('These are my thoughts');
  });

  test('excludes initialThoughts when null/undefined', async () => {
    await createTestSparkInDb({
      title: 'Spark without thoughts',
      initialThoughts: null
    });

    const response = await testApp.request('/api/sparks');
    const result = await response.json();
    
    expect(result.data[0].initialThoughts).toBeUndefined();
  });

  test('filters by default userId correctly', async () => {
    await createTestSparkInDb({ userId: 'default_user' });
    await createTestSparkInDb({ userId: 'other_user' });

    const response = await testApp.request('/api/sparks');
    const result = await response.json();
    
    expect(result.data).toHaveLength(1);
    expect(result.data[0].userId).toBeUndefined(); // userId not in response
  });

  // Data Transformation Tests
  test('converts null initialThoughts to undefined in response', async () => {
    await createTestSparkInDb({
      title: 'Test Spark',
      initialThoughts: null
    });

    const response = await testApp.request('/api/sparks');
    const result = await response.json();
    
    expect(result.data[0]).not.toHaveProperty('initialThoughts');
  });

  test('preserves all required fields', async () => {
    await createTestSparkInDb();

    const response = await testApp.request('/api/sparks');
    const result = await response.json();
    
    const spark = result.data[0];
    expect(spark).toHaveProperty('id');
    expect(spark).toHaveProperty('title');
    expect(spark).toHaveProperty('createdAt');
    expect(spark).toHaveProperty('updatedAt');
  });

  test('formats timestamps correctly as ISO strings', async () => {
    await createTestSparkInDb();

    const response = await testApp.request('/api/sparks');
    const result = await response.json();
    
    const spark = result.data[0];
    expect(spark.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
    expect(spark.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
  });
});

describe('GET /api/sparks/:id', () => {
  // Happy Path Tests
  test('returns existing spark by valid ID', async () => {
    const testSpark = await createTestSparkInDb({
      title: 'Test Spark',
      initialThoughts: 'Test thoughts'
    });

    const response = await testApp.request(`/api/sparks/${testSpark.id}`);

    expect(response.status).toBe(200);
    const result = await response.json();
    
    expect(result.success).toBe(true);
    expect(result.message).toBe('Spark retrieved successfully');
    expect(result.data.id).toBe(testSpark.id);
    expect(result.data.title).toBe(testSpark.title);
    expect(result.data.initialThoughts).toBe(testSpark.initialThoughts);
  });

  test('returns correct response structure with 200 status', async () => {
    const testSpark = await createTestSparkInDb();

    const response = await testApp.request(`/api/sparks/${testSpark.id}`);

    expect(response.status).toBe(200);
    const result = await response.json();
    
    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('message');
  });

  test('includes initialThoughts when present', async () => {
    const testSpark = await createTestSparkInDb({
      initialThoughts: 'Present thoughts'
    });

    const response = await testApp.request(`/api/sparks/${testSpark.id}`);
    const result = await response.json();
    
    expect(result.data.initialThoughts).toBe('Present thoughts');
  });

  test('excludes initialThoughts when null', async () => {
    const testSpark = await createTestSparkInDb({
      initialThoughts: null
    });

    const response = await testApp.request(`/api/sparks/${testSpark.id}`);
    const result = await response.json();
    
    expect(result.data.initialThoughts).toBeUndefined();
  });

  // Not Found Tests
  test('returns 404 for non-existent spark ID', async () => {
    const nonExistentId = '550e8400-e29b-41d4-a716-446655440000';

    const response = await testApp.request(`/api/sparks/${nonExistentId}`);

    expect(response.status).toBe(404);
    const result = await response.json();
    
    expect(result.error).toBe('Spark not found');
    expect(result.message).toBe('The requested spark does not exist.');
  });

  test('returns 404 for valid UUID that doesn\'t exist', async () => {
    const validButNonExistentUuid = '123e4567-e89b-12d3-a456-426614174000';

    const response = await testApp.request(`/api/sparks/${validButNonExistentUuid}`);

    expect(response.status).toBe(404);
    const result = await response.json();
    
    expect(result.error).toBe('Spark not found');
  });

  // Parameter Validation Tests
  test('handles invalid UUID format gracefully', async () => {
    const response = await testApp.request('/api/sparks/invalid-uuid');

    // Should still try to query and return 404, not crash
    expect(response.status).toBe(404);
  });

  test('handles empty ID parameter', async () => {
    const response = await testApp.request('/api/sparks/');

    // This actually returns 404 because the route is set up this way
    expect(response.status).toBe(404);
  });

  // Data Consistency Tests
  test('returned data matches database record exactly', async () => {
    const testSpark = await createTestSparkInDb({
      title: 'Exact Match Test',
      initialThoughts: 'Exact thoughts'
    });

    const response = await testApp.request(`/api/sparks/${testSpark.id}`);
    const result = await response.json();
    
    expect(result.data.id).toBe(testSpark.id);
    expect(result.data.title).toBe(testSpark.title);
    expect(result.data.initialThoughts).toBe(testSpark.initialThoughts);
    expect(result.data.createdAt).toBe(testSpark.createdAt);
    expect(result.data.updatedAt).toBe(testSpark.updatedAt);
  });

  test('timestamps are properly formatted', async () => {
    const testSpark = await createTestSparkInDb();

    const response = await testApp.request(`/api/sparks/${testSpark.id}`);
    const result = await response.json();
    
    expect(result.data.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
    expect(result.data.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
  });
});

describe('GET /api/sparks/:sparkId/story', () => {
  // Happy Path Tests
  test('returns story for existing spark', async () => {
    const testSpark = await createTestSparkInDb();
    const testStory = await createTestStoryInDb({
      sparkId: testSpark.id,
      content: 'Test story content'
    });

    const response = await testApp.request(`/api/sparks/${testSpark.id}/story`);

    expect(response.status).toBe(200);
    const result = await response.json();
    
    expect(result.success).toBe(true);
    expect(result.message).toBe('Story retrieved successfully');
    expect(result.data.id).toBe(testStory.id);
    expect(result.data.sparkId).toBe(testSpark.id);
    expect(result.data.content).toBe(testStory.content);
  });

  test('returns correct response structure with 200 status', async () => {
    const testSpark = await createTestSparkInDb();
    await createTestStoryInDb({ sparkId: testSpark.id });

    const response = await testApp.request(`/api/sparks/${testSpark.id}/story`);

    expect(response.status).toBe(200);
    const result = await response.json();
    
    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('message');
  });

  // Not Found Tests
  test('returns 404 for non-existent spark ID', async () => {
    const nonExistentId = '550e8400-e29b-41d4-a716-446655440000';

    const response = await testApp.request(`/api/sparks/${nonExistentId}/story`);

    expect(response.status).toBe(404);
    const result = await response.json();
    
    expect(result.error).toBe('Story not found');
    expect(result.message).toBe('The story for this spark does not exist.');
  });

  test('returns 404 when spark exists but no story (edge case)', async () => {
    const testSpark = await createTestSparkInDb();
    // Don't create a story

    const response = await testApp.request(`/api/sparks/${testSpark.id}/story`);

    expect(response.status).toBe(404);
    const result = await response.json();
    
    expect(result.error).toBe('Story not found');
  });

  // Parameter Tests
  test('handles invalid sparkId UUID format', async () => {
    const response = await testApp.request('/api/sparks/invalid-uuid/story');

    expect(response.status).toBe(404);
  });

  // Integration Tests
  test('story sparkId matches requested sparkId', async () => {
    const testSpark = await createTestSparkInDb();
    const testStory = await createTestStoryInDb({ sparkId: testSpark.id });

    const response = await testApp.request(`/api/sparks/${testSpark.id}/story`);
    const result = await response.json();
    
    expect(result.data.sparkId).toBe(testSpark.id);
  });

  test('story contains all required fields', async () => {
    const testSpark = await createTestSparkInDb();
    await createTestStoryInDb({ sparkId: testSpark.id });

    const response = await testApp.request(`/api/sparks/${testSpark.id}/story`);
    const result = await response.json();
    
    expect(result.data).toHaveProperty('id');
    expect(result.data).toHaveProperty('sparkId');
    expect(result.data).toHaveProperty('content');
    expect(result.data).toHaveProperty('createdAt');
    expect(result.data).toHaveProperty('updatedAt');
    expect(result.data).toHaveProperty('lastAutoSavedAt');
  });

  test('timestamps are properly set and formatted', async () => {
    const testSpark = await createTestSparkInDb();
    await createTestStoryInDb({ sparkId: testSpark.id });

    const response = await testApp.request(`/api/sparks/${testSpark.id}/story`);
    const result = await response.json();
    
    expect(result.data.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
    expect(result.data.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
    expect(result.data.lastAutoSavedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
  });
});