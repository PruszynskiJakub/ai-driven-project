import { z } from '@hono/zod-openapi'

export const SparkSchema = z.object({
  id: z.string().uuid().openapi({ example: '550e8400-e29b-41d4-a716-446655440000' }),
  content: z.string().min(1).openapi({ example: 'My breakthrough moment with imposter syndrome' }),
  createdAt: z.date().openapi({ example: '2024-08-27T19:17:20.000Z' }),
  updatedAt: z.date().openapi({ example: '2024-08-27T19:17:20.000Z' }),
}).openapi('Spark')

export const StorySchema = z.object({
  id: z.string().uuid(),
  sparkId: z.string().uuid(),
  content: z.string().min(1),
  backstory: z.string().optional(),
  motivation: z.string().optional(),
  context: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const ArtifactStateSchema = z.enum(['draft', 'final'])

export const ArtifactSchema = z.object({
  id: z.string().uuid(),
  storyId: z.string().uuid(),
  type: z.string(),
  content: z.string(),
  state: ArtifactStateSchema,
  sourceArtifactId: z.string().uuid().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  finalizedAt: z.date().optional(),
})

export const PublicationSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  artifactIds: z.array(z.string().uuid()),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const SnapshotSchema = z.object({
  id: z.string().uuid(),
  artifactId: z.string().uuid(),
  content: z.string(),
  state: ArtifactStateSchema,
  createdAt: z.date(),
})

export type Spark = z.infer<typeof SparkSchema>
export type Story = z.infer<typeof StorySchema>
export type Artifact = z.infer<typeof ArtifactSchema>
export type Publication = z.infer<typeof PublicationSchema>
export type Snapshot = z.infer<typeof SnapshotSchema>
export type ArtifactState = z.infer<typeof ArtifactStateSchema>

export const CreateSparkSchema = SparkSchema.omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
}).openapi('CreateSpark')

export const CreateStorySchema = StorySchema.omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
})

export const CreateArtifactSchema = ArtifactSchema.omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  finalizedAt: true 
}).extend({
  state: z.literal('draft')
})

export const CreatePublicationSchema = PublicationSchema.omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
})

export type CreateSpark = z.infer<typeof CreateSparkSchema>
export type CreateStory = z.infer<typeof CreateStorySchema>
export type CreateArtifact = z.infer<typeof CreateArtifactSchema>
export type CreatePublication = z.infer<typeof CreatePublicationSchema>