import { v4 as uuidv4 } from 'uuid';
import { getTestDb } from './setup';
import { sparks } from '../src/db/schema/sparks';
import { stories } from '../src/db/schema/stories';

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