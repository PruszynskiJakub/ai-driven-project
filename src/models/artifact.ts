import { z } from 'zod';

const ARTIFACT_TYPES = [
  'linkedin_post',
  'image'
] as const;

const ARTIFACT_STATES = ['draft', 'final'] as const;
const GENERATION_TYPES = ['ai_generated', 'user_edited'] as const;

export const CreateArtifactSchema = z.object({
  storyId: z.string().uuid(),
  type: z.enum(ARTIFACT_TYPES),
});

export const UpdateArtifactContentSchema = z.object({
  content: z.string()
    .min(1, 'Content cannot be empty')
    .max(50000, 'Content must be 50,000 characters or less'),
});

export const AddFeedbackSchema = z.object({
  feedback: z.string()
    .min(1, 'Feedback cannot be empty')
    .max(2000, 'Feedback must be 2,000 characters or less'),
});

export const ArtifactResponseSchema = z.object({
  id: z.string().uuid(),
  storyId: z.string().uuid(),
  type: z.enum(ARTIFACT_TYPES),
  state: z.enum(ARTIFACT_STATES),
  currentVersion: z.number().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  finalizedAt: z.string().datetime().nullable(),
  sourceArtifactId: z.string().uuid().nullable(),
});

export const ArtifactVersionResponseSchema = z.object({
  id: z.string().uuid(),
  artifactId: z.string().uuid(),
  version: z.number().positive(),
  content: z.string(),
  userFeedback: z.string().nullable(),
  createdAt: z.string().datetime(),
  generationType: z.enum(GENERATION_TYPES),
});

export const ArtifactWithVersionResponseSchema = ArtifactResponseSchema.extend({
  currentVersionContent: z.string(),
  currentVersionFeedback: z.string().nullable(),
  currentVersionGenerationType: z.enum(GENERATION_TYPES),
});

export type CreateArtifactRequest = z.infer<typeof CreateArtifactSchema>;
export type UpdateArtifactContentRequest = z.infer<typeof UpdateArtifactContentSchema>;
export type AddFeedbackRequest = z.infer<typeof AddFeedbackSchema>;
export type ArtifactResponse = z.infer<typeof ArtifactResponseSchema>;
export type ArtifactVersionResponse = z.infer<typeof ArtifactVersionResponseSchema>;
export type ArtifactWithVersionResponse = z.infer<typeof ArtifactWithVersionResponseSchema>;
export type ArtifactState = typeof ARTIFACT_STATES[number];
export type GenerationType = typeof GENERATION_TYPES[number];