import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { 
  setupTestDatabase, 
  cleanupTestDatabase,
  clearTestData,
  getSparkFromDb,
  getStoryFromDb,
  getArtifactFromDb,
  getArtifactVersionFromDb,
  countSparksInDb,
  countStoriesInDb,
  countArtifactsInDb,
  countArtifactVersionsInDb,
  getTestDb
} from './setup';
import {
  createTestSparkInDb,
  createTestStoryInDb,
  createTestArtifactInDb,
  createTestArtifactVersionInDb
} from './factories';
import { sparks } from '../src/db/schema/sparks';
import { eq } from 'drizzle-orm';
import { setTestDb } from '../src/db/database';

let testDb: any;

describe('Cascade Delete Behavior', () => {
  beforeEach(async () => {
    testDb = setupTestDatabase();
    setTestDb(testDb);
    clearTestData();
  });

  afterEach(() => {
    cleanupTestDatabase();
  });

  test('should cascade delete: Spark -> Story -> Artifacts -> ArtifactVersions', async () => {
    // Setup: Create a complete hierarchy
    const spark = await createTestSparkInDb({ title: 'Test Spark for Cascade' });
    const story = await createTestStoryInDb({ sparkId: spark.id });
    
    // Create multiple artifacts
    const artifact1 = await createTestArtifactInDb({ 
      storyId: story.id, 
      type: 'linkedin_post',
      state: 'draft',
      currentVersion: 2
    });
    const artifact2 = await createTestArtifactInDb({ 
      storyId: story.id, 
      type: 'blog_article',
      state: 'final',
      currentVersion: 3
    });

    // Create multiple versions for each artifact
    const artifact1Version1 = await createTestArtifactVersionInDb({ 
      artifactId: artifact1.id, 
      version: 1,
      content: 'Artifact 1, Version 1'
    });
    const artifact1Version2 = await createTestArtifactVersionInDb({ 
      artifactId: artifact1.id, 
      version: 2,
      content: 'Artifact 1, Version 2'
    });

    const artifact2Version1 = await createTestArtifactVersionInDb({ 
      artifactId: artifact2.id, 
      version: 1,
      content: 'Artifact 2, Version 1'
    });
    const artifact2Version2 = await createTestArtifactVersionInDb({ 
      artifactId: artifact2.id, 
      version: 2,
      content: 'Artifact 2, Version 2'
    });
    const artifact2Version3 = await createTestArtifactVersionInDb({ 
      artifactId: artifact2.id, 
      version: 3,
      content: 'Artifact 2, Version 3'
    });

    // Verify initial state
    expect(await countSparksInDb()).toBe(1);
    expect(await countStoriesInDb()).toBe(1);
    expect(await countArtifactsInDb()).toBe(2);
    expect(await countArtifactVersionsInDb()).toBe(5);

    // Verify all entities exist before deletion
    expect(await getSparkFromDb(spark.id)).toBeTruthy();
    expect(await getStoryFromDb(story.id)).toBeTruthy();
    expect(await getArtifactFromDb(artifact1.id)).toBeTruthy();
    expect(await getArtifactFromDb(artifact2.id)).toBeTruthy();
    expect(await getArtifactVersionFromDb(artifact1Version1.id)).toBeTruthy();
    expect(await getArtifactVersionFromDb(artifact2Version3.id)).toBeTruthy();

    // Delete the spark - this should trigger cascade delete
    const db = getTestDb();
    await db.delete(sparks).where(eq(sparks.id, spark.id));

    // Verify complete cascade deletion
    expect(await countSparksInDb()).toBe(0);
    expect(await countStoriesInDb()).toBe(0);
    expect(await countArtifactsInDb()).toBe(0);
    expect(await countArtifactVersionsInDb()).toBe(0);

    // Verify all entities are deleted
    expect(await getSparkFromDb(spark.id)).toBeFalsy();
    expect(await getStoryFromDb(story.id)).toBeFalsy();
    expect(await getArtifactFromDb(artifact1.id)).toBeFalsy();
    expect(await getArtifactFromDb(artifact2.id)).toBeFalsy();
    expect(await getArtifactVersionFromDb(artifact1Version1.id)).toBeFalsy();
    expect(await getArtifactVersionFromDb(artifact1Version2.id)).toBeFalsy();
    expect(await getArtifactVersionFromDb(artifact2Version1.id)).toBeFalsy();
    expect(await getArtifactVersionFromDb(artifact2Version2.id)).toBeFalsy();
    expect(await getArtifactVersionFromDb(artifact2Version3.id)).toBeFalsy();
  });

  test('should not affect artifacts from different sparks', async () => {
    // Setup: Create two separate hierarchies
    const spark1 = await createTestSparkInDb({ title: 'Spark 1' });
    const story1 = await createTestStoryInDb({ sparkId: spark1.id });
    const artifact1 = await createTestArtifactInDb({ storyId: story1.id });
    const version1 = await createTestArtifactVersionInDb({ artifactId: artifact1.id });

    const spark2 = await createTestSparkInDb({ title: 'Spark 2' });
    const story2 = await createTestStoryInDb({ sparkId: spark2.id });
    const artifact2 = await createTestArtifactInDb({ storyId: story2.id });
    const version2 = await createTestArtifactVersionInDb({ artifactId: artifact2.id });

    // Verify initial state
    expect(await countSparksInDb()).toBe(2);
    expect(await countStoriesInDb()).toBe(2);
    expect(await countArtifactsInDb()).toBe(2);
    expect(await countArtifactVersionsInDb()).toBe(2);

    // Delete only spark1
    const db = getTestDb();
    await db.delete(sparks).where(eq(sparks.id, spark1.id));

    // Verify only spark1 hierarchy is deleted
    expect(await countSparksInDb()).toBe(1);
    expect(await countStoriesInDb()).toBe(1);
    expect(await countArtifactsInDb()).toBe(1);
    expect(await countArtifactVersionsInDb()).toBe(1);

    // Verify spark1 hierarchy is gone
    expect(await getSparkFromDb(spark1.id)).toBeFalsy();
    expect(await getStoryFromDb(story1.id)).toBeFalsy();
    expect(await getArtifactFromDb(artifact1.id)).toBeFalsy();
    expect(await getArtifactVersionFromDb(version1.id)).toBeFalsy();

    // Verify spark2 hierarchy remains
    expect(await getSparkFromDb(spark2.id)).toBeTruthy();
    expect(await getStoryFromDb(story2.id)).toBeTruthy();
    expect(await getArtifactFromDb(artifact2.id)).toBeTruthy();
    expect(await getArtifactVersionFromDb(version2.id)).toBeTruthy();
  });

  test('should handle sourceArtifactId references correctly', async () => {
    // Setup: Create source artifact and duplicated artifact
    const spark = await createTestSparkInDb();
    const story = await createTestStoryInDb({ sparkId: spark.id });
    
    // Create original (source) artifact
    const sourceArtifact = await createTestArtifactInDb({ 
      storyId: story.id,
      state: 'final',
      currentVersion: 1
    });
    await createTestArtifactVersionInDb({ 
      artifactId: sourceArtifact.id,
      content: 'Source content'
    });

    // Create duplicated artifact referencing the source
    const duplicatedArtifact = await createTestArtifactInDb({ 
      storyId: story.id,
      sourceArtifactId: sourceArtifact.id,
      state: 'draft'
    });
    await createTestArtifactVersionInDb({ 
      artifactId: duplicatedArtifact.id,
      content: 'Duplicated content'
    });

    // Verify initial state
    expect(await countArtifactsInDb()).toBe(2);
    expect(await countArtifactVersionsInDb()).toBe(2);
    
    const duplicatedInDb = await getArtifactFromDb(duplicatedArtifact.id);
    expect(duplicatedInDb?.sourceArtifactId).toBe(sourceArtifact.id);

    // Delete the spark - should cascade delete everything
    const db = getTestDb();
    await db.delete(sparks).where(eq(sparks.id, spark.id));

    // Verify everything is deleted (cascade works with foreign key references)
    expect(await countSparksInDb()).toBe(0);
    expect(await countStoriesInDb()).toBe(0);
    expect(await countArtifactsInDb()).toBe(0);
    expect(await countArtifactVersionsInDb()).toBe(0);
    
    expect(await getArtifactFromDb(sourceArtifact.id)).toBeFalsy();
    expect(await getArtifactFromDb(duplicatedArtifact.id)).toBeFalsy();
  });

  test('should preserve referential integrity during partial deletions', async () => {
    // Setup: Create multiple sparks with cross-references
    const spark1 = await createTestSparkInDb({ title: 'Spark 1' });
    const story1 = await createTestStoryInDb({ sparkId: spark1.id });
    const sourceArtifact = await createTestArtifactInDb({ 
      storyId: story1.id,
      state: 'final'
    });
    await createTestArtifactVersionInDb({ artifactId: sourceArtifact.id });

    const spark2 = await createTestSparkInDb({ title: 'Spark 2' });
    const story2 = await createTestStoryInDb({ sparkId: spark2.id });
    
    // Create artifact in spark2 that references artifact from spark1
    // Note: This would be prevented in real application, but testing DB behavior
    const duplicatedArtifact = await createTestArtifactInDb({ 
      storyId: story2.id,
      sourceArtifactId: sourceArtifact.id // Cross-spark reference
    });
    await createTestArtifactVersionInDb({ artifactId: duplicatedArtifact.id });

    // Verify initial state
    expect(await countSparksInDb()).toBe(2);
    expect(await countArtifactsInDb()).toBe(2);

    const duplicatedInDb = await getArtifactFromDb(duplicatedArtifact.id);
    expect(duplicatedInDb?.sourceArtifactId).toBe(sourceArtifact.id);

    // Delete spark1 - should cascade delete story1 and sourceArtifact
    // duplicatedArtifact.sourceArtifactId should be set to null (ON DELETE SET NULL)
    const db = getTestDb();
    await db.delete(sparks).where(eq(sparks.id, spark1.id));

    // Verify spark1 hierarchy is deleted
    expect(await countSparksInDb()).toBe(1);
    expect(await getSparkFromDb(spark1.id)).toBeFalsy();
    expect(await getStoryFromDb(story1.id)).toBeFalsy();
    expect(await getArtifactFromDb(sourceArtifact.id)).toBeFalsy();

    // Verify spark2 hierarchy remains with sourceArtifactId set to null
    expect(await getSparkFromDb(spark2.id)).toBeTruthy();
    expect(await getStoryFromDb(story2.id)).toBeTruthy();
    
    const remainingArtifact = await getArtifactFromDb(duplicatedArtifact.id);
    expect(remainingArtifact).toBeTruthy();
    expect(remainingArtifact?.sourceArtifactId).toBe(null); // Should be nullified
  });

  test('should handle complex artifact hierarchies with multiple versions', async () => {
    // Setup: Create a complex scenario with many artifacts and versions
    const spark = await createTestSparkInDb({ title: 'Complex Spark' });
    const story = await createTestStoryInDb({ sparkId: spark.id });

    // Create 5 artifacts with varying numbers of versions
    const artifacts = [];
    const allVersions = [];

    for (let i = 1; i <= 5; i++) {
      const artifact = await createTestArtifactInDb({ 
        storyId: story.id,
        type: i % 2 === 0 ? 'blog_article' : 'linkedin_post',
        currentVersion: i // Each artifact has i versions
      });
      artifacts.push(artifact);

      // Create i versions for each artifact
      for (let v = 1; v <= i; v++) {
        const version = await createTestArtifactVersionInDb({
          artifactId: artifact.id,
          version: v,
          content: `Artifact ${i}, Version ${v}`,
          generationType: v === 1 ? 'ai_generated' : 'user_edited'
        });
        allVersions.push(version);
      }
    }

    // Verify setup: 5 artifacts, 1+2+3+4+5 = 15 versions
    expect(await countSparksInDb()).toBe(1);
    expect(await countStoriesInDb()).toBe(1);
    expect(await countArtifactsInDb()).toBe(5);
    expect(await countArtifactVersionsInDb()).toBe(15);

    // Verify all entities exist
    for (const artifact of artifacts) {
      expect(await getArtifactFromDb(artifact.id)).toBeTruthy();
    }
    for (const version of allVersions) {
      expect(await getArtifactVersionFromDb(version.id)).toBeTruthy();
    }

    // Delete the spark
    const db = getTestDb();
    await db.delete(sparks).where(eq(sparks.id, spark.id));

    // Verify complete cleanup
    expect(await countSparksInDb()).toBe(0);
    expect(await countStoriesInDb()).toBe(0);
    expect(await countArtifactsInDb()).toBe(0);
    expect(await countArtifactVersionsInDb()).toBe(0);

    // Verify all entities are deleted
    for (const artifact of artifacts) {
      expect(await getArtifactFromDb(artifact.id)).toBeFalsy();
    }
    for (const version of allVersions) {
      expect(await getArtifactVersionFromDb(version.id)).toBeFalsy();
    }
  });
});