import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { setupTestDatabase, cleanupTestDatabase, clearTestData } from "./setup";
import { testApp } from "./testApp";
import { setTestDb } from "../src/db/database";
import { createTestSparkInDb, createTestStoryInDb, createTestArtifactInDb, createTestArtifactVersionInDb } from "./factories";
import { sparks, stories, artifacts, artifactVersions } from "../src/db/schema";

let testDb: any;

beforeEach(() => {
  testDb = setupTestDatabase();
  setTestDb(testDb);
  clearTestData();
});

afterEach(() => {
  cleanupTestDatabase();
});

describe("Spark Deletion API", () => {
  test("DELETE /api/sparks/:id should delete spark and cascade to all related data", async () => {
    // Create test data
    const spark = await createTestSparkInDb({ title: "Test Spark" });
    const story = await createTestStoryInDb({ sparkId: spark.id });
    const artifact1 = await createTestArtifactInDb({ storyId: story.id, type: "blog_article" });
    const artifact2 = await createTestArtifactInDb({ storyId: story.id, type: "linkedin_post" });
    
    // Create multiple versions for each artifact
    await createTestArtifactVersionInDb({ artifactId: artifact1.id, version: 1, content: "Version 1" });
    await createTestArtifactVersionInDb({ artifactId: artifact1.id, version: 2, content: "Version 2" });
    await createTestArtifactVersionInDb({ artifactId: artifact2.id, version: 1, content: "Post content" });

    // Verify data exists before deletion
    const sparksBefore = await testDb.select().from(sparks);
    const storiesBefore = await testDb.select().from(stories);
    const artifactsBefore = await testDb.select().from(artifacts);
    const versionsBefore = await testDb.select().from(artifactVersions);

    expect(sparksBefore).toHaveLength(1);
    expect(storiesBefore).toHaveLength(1);
    expect(artifactsBefore).toHaveLength(2);
    expect(versionsBefore).toHaveLength(3);

    // Delete the spark
    const response = await testApp.request(`/api/sparks/${spark.id}`, {
      method: "DELETE",
    });

    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.success).toBe(true);
    expect(result.message).toContain("deleted successfully");

    // Verify all related data is deleted
    const sparksAfter = await testDb.select().from(sparks);
    const storiesAfter = await testDb.select().from(stories);
    const artifactsAfter = await testDb.select().from(artifacts);
    const versionsAfter = await testDb.select().from(artifactVersions);

    expect(sparksAfter).toHaveLength(0);
    expect(storiesAfter).toHaveLength(0);
    expect(artifactsAfter).toHaveLength(0);
    expect(versionsAfter).toHaveLength(0);
  });

  test("DELETE /api/sparks/:id should return 404 for non-existent spark", async () => {
    const response = await testApp.request("/api/sparks/non-existent-id", {
      method: "DELETE",
    });

    expect(response.status).toBe(404);
    const result = await response.json();
    expect(result.error).toBe("Spark not found");
  });

  test("DELETE /api/sparks/:id should only delete the specific spark's data", async () => {
    // Create two separate sparks with their data
    const spark1 = await createTestSparkInDb({ title: "Spark 1" });
    const story1 = await createTestStoryInDb({ sparkId: spark1.id });
    const artifact1 = await createTestArtifactInDb({ storyId: story1.id, type: "blog_article" });
    await createTestArtifactVersionInDb({ artifactId: artifact1.id, version: 1, content: "Content 1" });

    const spark2 = await createTestSparkInDb({ title: "Spark 2" });
    const story2 = await createTestStoryInDb({ sparkId: spark2.id });
    const artifact2 = await createTestArtifactInDb({ storyId: story2.id, type: "linkedin_post" });
    await createTestArtifactVersionInDb({ artifactId: artifact2.id, version: 1, content: "Content 2" });

    // Delete only the first spark
    const response = await testApp.request(`/api/sparks/${spark1.id}`, {
      method: "DELETE",
    });

    expect(response.status).toBe(200);

    // Verify only spark1's data is deleted
    const remainingSparks = await testDb.select().from(sparks);
    const remainingStories = await testDb.select().from(stories);
    const remainingArtifacts = await testDb.select().from(artifacts);
    const remainingVersions = await testDb.select().from(artifactVersions);

    expect(remainingSparks).toHaveLength(1);
    expect(remainingSparks[0].id).toBe(spark2.id);
    
    expect(remainingStories).toHaveLength(1);
    expect(remainingStories[0].sparkId).toBe(spark2.id);
    
    expect(remainingArtifacts).toHaveLength(1);
    expect(remainingArtifacts[0].storyId).toBe(story2.id);
    
    expect(remainingVersions).toHaveLength(1);
    expect(remainingVersions[0].artifactId).toBe(artifact2.id);
  });
});