import { test, expect } from "bun:test";
import { setupTestDB } from "./setup";
import { createSpark, createStory, createArtifact, createArtifactVersion } from "./factories";
import { db } from "../src/db/database";
import { sparks, stories, artifacts, artifactVersions } from "../src/db/schema";
import { eq } from "drizzle-orm";

const app = await setupTestDB();

test.describe("Spark Deletion API", () => {
  test("DELETE /api/sparks/:id should delete spark and cascade to all related data", async () => {
    // Create test data
    const spark = await createSpark({ title: "Test Spark" });
    const story = await createStory({ sparkId: spark.id });
    const artifact1 = await createArtifact({ storyId: story.id, type: "blog_article" });
    const artifact2 = await createArtifact({ storyId: story.id, type: "linkedin_post" });
    
    // Create multiple versions for each artifact
    await createArtifactVersion({ artifactId: artifact1.id, version: 1, content: "Version 1" });
    await createArtifactVersion({ artifactId: artifact1.id, version: 2, content: "Version 2" });
    await createArtifactVersion({ artifactId: artifact2.id, version: 1, content: "Post content" });

    // Verify data exists before deletion
    const sparksBefore = await db.select().from(sparks);
    const storiesBefore = await db.select().from(stories);
    const artifactsBefore = await db.select().from(artifacts);
    const versionsBefore = await db.select().from(artifactVersions);

    expect(sparksBefore).toHaveLength(1);
    expect(storiesBefore).toHaveLength(1);
    expect(artifactsBefore).toHaveLength(2);
    expect(versionsBefore).toHaveLength(3);

    // Delete the spark
    const response = await app.request(`/api/sparks/${spark.id}`, {
      method: "DELETE",
    });

    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.success).toBe(true);
    expect(result.message).toContain("deleted successfully");

    // Verify all related data is deleted
    const sparksAfter = await db.select().from(sparks);
    const storiesAfter = await db.select().from(stories);
    const artifactsAfter = await db.select().from(artifacts);
    const versionsAfter = await db.select().from(artifactVersions);

    expect(sparksAfter).toHaveLength(0);
    expect(storiesAfter).toHaveLength(0);
    expect(artifactsAfter).toHaveLength(0);
    expect(versionsAfter).toHaveLength(0);
  });

  test("DELETE /api/sparks/:id should return 404 for non-existent spark", async () => {
    const response = await app.request("/api/sparks/non-existent-id", {
      method: "DELETE",
    });

    expect(response.status).toBe(404);
    const result = await response.json();
    expect(result.error).toBe("Spark not found");
  });

  test("DELETE /api/sparks/:id should only delete the specific spark's data", async () => {
    // Create two separate sparks with their data
    const spark1 = await createSpark({ title: "Spark 1" });
    const story1 = await createStory({ sparkId: spark1.id });
    const artifact1 = await createArtifact({ storyId: story1.id, type: "blog_article" });
    await createArtifactVersion({ artifactId: artifact1.id, version: 1, content: "Content 1" });

    const spark2 = await createSpark({ title: "Spark 2" });
    const story2 = await createStory({ sparkId: spark2.id });
    const artifact2 = await createArtifact({ storyId: story2.id, type: "linkedin_post" });
    await createArtifactVersion({ artifactId: artifact2.id, version: 1, content: "Content 2" });

    // Delete only the first spark
    const response = await app.request(`/api/sparks/${spark1.id}`, {
      method: "DELETE",
    });

    expect(response.status).toBe(200);

    // Verify only spark1's data is deleted
    const remainingSparks = await db.select().from(sparks);
    const remainingStories = await db.select().from(stories);
    const remainingArtifacts = await db.select().from(artifacts);
    const remainingVersions = await db.select().from(artifactVersions);

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