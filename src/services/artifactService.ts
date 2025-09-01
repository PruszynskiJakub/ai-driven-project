import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/database';
import { artifacts, artifactVersions } from '../db/schema/artifacts';
import type { 
  CreateArtifactRequest, 
  UpdateArtifactContentRequest,
  AddFeedbackRequest,
  ArtifactResponse, 
  ArtifactVersionResponse,
  ArtifactWithVersionResponse,
  ArtifactState,
  GenerationType
} from '../models/artifact';
import { v4 as uuidv4 } from 'uuid';
import { generateArtifactContent } from './aiService';
import { getStoryById } from './storyService';

export async function createArtifact(data: CreateArtifactRequest): Promise<ArtifactWithVersionResponse> {
  const artifactId = uuidv4();
  const versionId = uuidv4();
  const now = new Date().toISOString();

  const artifactData = {
    id: artifactId,
    storyId: data.storyId,
    type: data.type,
    state: 'draft' as ArtifactState,
    currentVersion: 1,
    createdAt: now,
    updatedAt: now,
    finalizedAt: null,
    sourceArtifactId: null,
  };

  // Get story content for AI generation context
  const story = await getStoryById(data.storyId);
  if (!story) {
    throw new Error('Story not found');
  }

  // Generate initial content using AI service
  let initialContent = '';
  try {
    initialContent = await generateArtifactContent(story.content, data.type);
  } catch (error) {
    console.error('AI content generation failed:', error);
    // Fall back to empty content if AI generation fails
    initialContent = '';
  }

  const initialVersionData = {
    id: versionId,
    artifactId,
    version: 1,
    content: initialContent,
    userFeedback: null,
    createdAt: now,
    generationType: 'ai_generated' as GenerationType,
  };

  await db.insert(artifacts).values(artifactData);
  await db.insert(artifactVersions).values(initialVersionData);

  return {
    id: artifactData.id,
    storyId: artifactData.storyId,
    type: artifactData.type,
    state: artifactData.state,
    currentVersion: artifactData.currentVersion,
    createdAt: artifactData.createdAt,
    updatedAt: artifactData.updatedAt,
    finalizedAt: artifactData.finalizedAt,
    sourceArtifactId: artifactData.sourceArtifactId,
    currentVersionContent: initialVersionData.content,
    currentVersionFeedback: initialVersionData.userFeedback,
    currentVersionGenerationType: initialVersionData.generationType,
  };
}

export async function getArtifactById(id: string): Promise<ArtifactWithVersionResponse | null> {
  const [artifact] = await db.select().from(artifacts).where(eq(artifacts.id, id));
  
  if (!artifact) return null;

  const [currentVersion] = await db
    .select()
    .from(artifactVersions)
    .where(and(
      eq(artifactVersions.artifactId, id),
      eq(artifactVersions.version, artifact.currentVersion)
    ));

  if (!currentVersion) return null;

  return {
    id: artifact.id,
    storyId: artifact.storyId,
    type: artifact.type as any,
    state: artifact.state as ArtifactState,
    currentVersion: artifact.currentVersion,
    createdAt: artifact.createdAt,
    updatedAt: artifact.updatedAt,
    finalizedAt: artifact.finalizedAt,
    sourceArtifactId: artifact.sourceArtifactId,
    currentVersionContent: currentVersion.content,
    currentVersionFeedback: currentVersion.userFeedback,
    currentVersionGenerationType: currentVersion.generationType as GenerationType,
  };
}

export async function getArtifactVersions(artifactId: string): Promise<ArtifactVersionResponse[]> {
  const versions = await db
    .select()
    .from(artifactVersions)
    .where(eq(artifactVersions.artifactId, artifactId))
    .orderBy(desc(artifactVersions.version));

  return versions.map(version => ({
    id: version.id,
    artifactId: version.artifactId,
    version: version.version,
    content: version.content,
    userFeedback: version.userFeedback,
    createdAt: version.createdAt,
    generationType: version.generationType as GenerationType,
  }));
}

export async function getArtifactVersion(artifactId: string, version: number): Promise<ArtifactVersionResponse | null> {
  const [versionData] = await db
    .select()
    .from(artifactVersions)
    .where(and(
      eq(artifactVersions.artifactId, artifactId),
      eq(artifactVersions.version, version)
    ));

  if (!versionData) return null;

  return {
    id: versionData.id,
    artifactId: versionData.artifactId,
    version: versionData.version,
    content: versionData.content,
    userFeedback: versionData.userFeedback,
    createdAt: versionData.createdAt,
    generationType: versionData.generationType as GenerationType,
  };
}

export async function addFeedbackAndIterate(artifactId: string, data: AddFeedbackRequest): Promise<ArtifactWithVersionResponse | null> {
  const [artifact] = await db.select().from(artifacts).where(eq(artifacts.id, artifactId));
  
  if (!artifact) return null;
  if (artifact.state !== 'draft') {
    throw new Error('Cannot add feedback to finalized artifact');
  }

  const newVersion = artifact.currentVersion + 1;
  const now = new Date().toISOString();
  
  // Get story content for AI generation context
  const story = await getStoryById(artifact.storyId);
  if (!story) {
    throw new Error('Story not found');
  }

  // Generate new content based on feedback using AI service
  let newContent = '';
  try {
    newContent = await generateArtifactContent(story.content, artifact.type as string, data.feedback);
  } catch (error) {
    console.error('AI content generation failed:', error);
    // Fall back to placeholder content if AI generation fails
    newContent = `[AI Generated content based on feedback: "${data.feedback}"]`;
  }

  const newVersionData = {
    id: uuidv4(),
    artifactId,
    version: newVersion,
    content: newContent,
    userFeedback: data.feedback,
    createdAt: now,
    generationType: 'ai_generated' as GenerationType,
  };

  await db.insert(artifactVersions).values(newVersionData);
  await db.update(artifacts)
    .set({ 
      currentVersion: newVersion,
      updatedAt: now 
    })
    .where(eq(artifacts.id, artifactId));

  return {
    id: artifact.id,
    storyId: artifact.storyId,
    type: artifact.type as any,
    state: artifact.state as ArtifactState,
    currentVersion: newVersion,
    createdAt: artifact.createdAt,
    updatedAt: now,
    finalizedAt: artifact.finalizedAt,
    sourceArtifactId: artifact.sourceArtifactId,
    currentVersionContent: newVersionData.content,
    currentVersionFeedback: newVersionData.userFeedback,
    currentVersionGenerationType: newVersionData.generationType,
  };
}

export async function updateArtifactContent(artifactId: string, data: UpdateArtifactContentRequest): Promise<ArtifactWithVersionResponse | null> {
  const [artifact] = await db.select().from(artifacts).where(eq(artifacts.id, artifactId));
  
  if (!artifact) return null;
  if (artifact.state !== 'draft') {
    throw new Error('Cannot edit finalized artifact');
  }

  const newVersion = artifact.currentVersion + 1;
  const now = new Date().toISOString();
  
  const newVersionData = {
    id: uuidv4(),
    artifactId,
    version: newVersion,
    content: data.content,
    userFeedback: null,
    createdAt: now,
    generationType: 'user_edited' as GenerationType,
  };

  await db.insert(artifactVersions).values(newVersionData);
  await db.update(artifacts)
    .set({ 
      currentVersion: newVersion,
      updatedAt: now 
    })
    .where(eq(artifacts.id, artifactId));

  return {
    id: artifact.id,
    storyId: artifact.storyId,
    type: artifact.type as any,
    state: artifact.state as ArtifactState,
    currentVersion: newVersion,
    createdAt: artifact.createdAt,
    updatedAt: now,
    finalizedAt: artifact.finalizedAt,
    sourceArtifactId: artifact.sourceArtifactId,
    currentVersionContent: newVersionData.content,
    currentVersionFeedback: newVersionData.userFeedback,
    currentVersionGenerationType: newVersionData.generationType,
  };
}

export async function finalizeArtifact(artifactId: string): Promise<ArtifactWithVersionResponse | null> {
  const [artifact] = await db.select().from(artifacts).where(eq(artifacts.id, artifactId));
  
  if (!artifact) return null;
  if (artifact.state !== 'draft') {
    throw new Error('Artifact is already finalized');
  }

  // Get current version to validate content is non-empty
  const [currentVersion] = await db
    .select()
    .from(artifactVersions)
    .where(and(
      eq(artifactVersions.artifactId, artifactId),
      eq(artifactVersions.version, artifact.currentVersion)
    ));

  if (!currentVersion) {
    throw new Error('Current version not found');
  }

  if (!currentVersion.content || currentVersion.content.trim().length === 0) {
    throw new Error('Cannot finalize artifact with empty content');
  }

  const now = new Date().toISOString();
  
  await db.update(artifacts)
    .set({ 
      state: 'final' as ArtifactState,
      finalizedAt: now,
      updatedAt: now 
    })
    .where(eq(artifacts.id, artifactId));

  return {
    id: artifact.id,
    storyId: artifact.storyId,
    type: artifact.type as any,
    state: 'final',
    currentVersion: artifact.currentVersion,
    createdAt: artifact.createdAt,
    updatedAt: now,
    finalizedAt: now,
    sourceArtifactId: artifact.sourceArtifactId,
    currentVersionContent: currentVersion.content,
    currentVersionFeedback: currentVersion.userFeedback,
    currentVersionGenerationType: currentVersion.generationType as GenerationType,
  };
}

export async function duplicateArtifact(sourceArtifactId: string): Promise<ArtifactWithVersionResponse | null> {
  const [sourceArtifact] = await db.select().from(artifacts).where(eq(artifacts.id, sourceArtifactId));
  
  if (!sourceArtifact) return null;
  if (sourceArtifact.state !== 'final') {
    throw new Error('Can only duplicate finalized artifacts');
  }

  // Get the final version content
  const [finalVersion] = await db
    .select()
    .from(artifactVersions)
    .where(and(
      eq(artifactVersions.artifactId, sourceArtifactId),
      eq(artifactVersions.version, sourceArtifact.currentVersion)
    ));

  if (!finalVersion) {
    throw new Error('Final version not found');
  }

  const newArtifactId = uuidv4();
  const newVersionId = uuidv4();
  const now = new Date().toISOString();

  const newArtifactData = {
    id: newArtifactId,
    storyId: sourceArtifact.storyId,
    type: sourceArtifact.type,
    state: 'draft' as ArtifactState,
    currentVersion: 1,
    createdAt: now,
    updatedAt: now,
    finalizedAt: null,
    sourceArtifactId: sourceArtifactId,
  };

  const newVersionData = {
    id: newVersionId,
    artifactId: newArtifactId,
    version: 1,
    content: finalVersion.content,
    userFeedback: null,
    createdAt: now,
    generationType: 'ai_generated' as GenerationType, // Initial version from duplication
  };

  await db.insert(artifacts).values(newArtifactData);
  await db.insert(artifactVersions).values(newVersionData);

  return {
    id: newArtifactData.id,
    storyId: newArtifactData.storyId,
    type: newArtifactData.type as any,
    state: newArtifactData.state,
    currentVersion: newArtifactData.currentVersion,
    createdAt: newArtifactData.createdAt,
    updatedAt: newArtifactData.updatedAt,
    finalizedAt: newArtifactData.finalizedAt,
    sourceArtifactId: newArtifactData.sourceArtifactId,
    currentVersionContent: newVersionData.content,
    currentVersionFeedback: newVersionData.userFeedback,
    currentVersionGenerationType: newVersionData.generationType,
  };
}

export async function getArtifactsByStoryId(storyId: string): Promise<ArtifactResponse[]> {
  const artifactsList = await db
    .select()
    .from(artifacts)
    .where(eq(artifacts.storyId, storyId))
    .orderBy(desc(artifacts.createdAt));

  return artifactsList.map(artifact => ({
    id: artifact.id,
    storyId: artifact.storyId,
    type: artifact.type as any,
    state: artifact.state as ArtifactState,
    currentVersion: artifact.currentVersion,
    createdAt: artifact.createdAt,
    updatedAt: artifact.updatedAt,
    finalizedAt: artifact.finalizedAt,
    sourceArtifactId: artifact.sourceArtifactId,
  }));
}