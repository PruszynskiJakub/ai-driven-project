import { v4 as uuidv4 } from 'uuid';
import { getTestDb } from './setup';
import { sparks } from '../src/db/schema/sparks';
import { stories } from '../src/db/schema/stories';
import { artifacts, artifactVersions } from '../src/db/schema/artifacts';

export function createValidSparkData(overrides: any = {}) {
  return {
    title: 'Test Spark Title',
    initialThoughts: 'Some initial thoughts about this spark',
    ...overrides
  };
}

export function createValidStoryUpdateData(overrides: any = {}) {
  return {
    content: 'Updated story content',
    isAutoSave: false,
    ...overrides
  };
}

export function createValidStoryData(overrides: any = {}) {
  return {
    sparkId: uuidv4(),
    content: '',
    ...overrides
  };
}

export function createInvalidSparkData(type: string) {
  switch (type) {
    case 'missing-title':
      return { initialThoughts: 'thoughts without title' };
    case 'empty-title':
      return { title: '', initialThoughts: 'some thoughts' };
    case 'title-too-long':
      return { title: 'a'.repeat(256), initialThoughts: 'some thoughts' };
    case 'thoughts-too-long':
      return { title: 'Valid Title', initialThoughts: 'a'.repeat(501) };
    case 'non-string-title':
      return { title: 123, initialThoughts: 'some thoughts' };
    case 'non-string-thoughts':
      return { title: 'Valid Title', initialThoughts: 123 };
    default:
      return {};
  }
}

export function createInvalidStoryUpdateData(type: string) {
  switch (type) {
    case 'content-too-long':
      return { content: 'a'.repeat(50001) };
    case 'non-string-content':
      return { content: 123 };
    case 'invalid-autosave':
      return { content: 'valid content', isAutoSave: 'not-boolean' };
    case 'missing-content':
      return { isAutoSave: true };
    default:
      return {};
  }
}

export function generateLongString(length: number): string {
  return 'a'.repeat(length);
}

export async function createTestSparkInDb(data: any = {}) {
  const db = getTestDb();
  const sparkData = {
    id: uuidv4(),
    title: 'Test Spark',
    initialThoughts: 'Test thoughts',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userId: 'default_user',
    ...data
  };
  
  await db.insert(sparks).values(sparkData);
  return sparkData;
}

export async function createTestStoryInDb(data: any = {}) {
  const db = getTestDb();
  const storyData = {
    id: uuidv4(),
    sparkId: data.sparkId || uuidv4(),
    content: 'Test story content',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastAutoSavedAt: new Date().toISOString(),
    ...data
  };
  
  await db.insert(stories).values(storyData);
  return storyData;
}

export function createValidArtifactData(overrides: any = {}) {
  return {
    storyId: uuidv4(),
    type: 'linkedin_post',
    ...overrides
  };
}

export function createValidArtifactContentData(overrides: any = {}) {
  return {
    content: 'Updated artifact content',
    ...overrides
  };
}

export function createValidFeedbackData(overrides: any = {}) {
  return {
    feedback: 'Please make it more engaging and add emojis',
    ...overrides
  };
}

export function createInvalidArtifactData(type: string) {
  switch (type) {
    case 'missing-storyId':
      return { type: 'linkedin_post' };
    case 'invalid-storyId':
      return { storyId: 'not-a-uuid', type: 'linkedin_post' };
    case 'missing-type':
      return { storyId: uuidv4() };
    case 'invalid-type':
      return { storyId: uuidv4(), type: 'invalid_type' };
    default:
      return {};
  }
}

export function createInvalidContentData(type: string) {
  switch (type) {
    case 'empty-content':
      return { content: '' };
    case 'content-too-long':
      return { content: 'a'.repeat(50001) };
    case 'non-string-content':
      return { content: 123 };
    default:
      return {};
  }
}

export function createInvalidFeedbackData(type: string) {
  switch (type) {
    case 'empty-feedback':
      return { feedback: '' };
    case 'feedback-too-long':
      return { feedback: 'a'.repeat(2001) };
    case 'non-string-feedback':
      return { feedback: 123 };
    default:
      return {};
  }
}

export async function createTestArtifactInDb(data: any = {}) {
  const db = getTestDb();
  const artifactData = {
    id: uuidv4(),
    storyId: data.storyId || uuidv4(),
    type: 'linkedin_post',
    state: 'draft',
    currentVersion: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    finalizedAt: null,
    sourceArtifactId: null,
    ...data
  };
  
  await db.insert(artifacts).values(artifactData);
  return artifactData;
}

export async function createTestArtifactVersionInDb(data: any = {}) {
  const db = getTestDb();
  const versionData = {
    id: uuidv4(),
    artifactId: data.artifactId || uuidv4(),
    version: 1,
    content: 'Test artifact content',
    userFeedback: null,
    createdAt: new Date().toISOString(),
    generationType: 'ai_generated',
    ...data
  };
  
  await db.insert(artifactVersions).values(versionData);
  return versionData;
}