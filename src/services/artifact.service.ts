import type {
    AddFeedbackRequest,
    ArtifactListResponse,
    ArtifactState,
    ArtifactTypes,
    ArtifactVersionResponse,
    ArtifactWithVersionResponse,
    CreateArtifactRequest,
    GenerationType,
    UpdateArtifactContentRequest
} from "../models/artifact.ts";
import {v4 as uuidv4} from "uuid";
import {isoNow} from "../utils/datetime.ts";
import {storyService} from "./story.service.ts";
import {type AIMessage, aiService} from "./ai.service.ts";
import {prompt as createLinkedinPostPrompt} from "../prompts/linkedin-post.create.ts";
import {prompt as createImagePrompt} from "../prompts/image.create.ts";
import {db} from "../db/database.ts";
import {artifacts, artifactVersions} from "../db/schema";
import {and, desc, eq} from "drizzle-orm";
import {areContentsEqual} from "../utils/text.ts";

const generateContent = async (context: {type: ArtifactTypes, storyContent: string, feedback?: string}) : Promise<string> => {
    let content = ''

    switch (context.type) {
        case 'image':
            content = await aiService.image(createImagePrompt())
            break;
        case 'linkedin_post':
            const messages: AIMessage[] = [
                {
                    role: 'system',
                    content: createLinkedinPostPrompt()
                },
                {
                    role: 'user',
                    content: `Story context: ${context.storyContent}`
                }
            ];
            const completion = await aiService.completion({messages})
            content = completion.content
            break;
        default:
            // code block
            break;
    }

    return content
}

export const artifactService = {
    create: async (data: CreateArtifactRequest): Promise<ArtifactWithVersionResponse> => {
        const artifactId = uuidv4();
        const versionId = uuidv4();
        const now = isoNow()

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

        const story = await storyService.getById(data.storyId);
        if (!story) {
            throw new Error('Story not found');
        }

        const initialVersionData = {
            id: versionId,
            artifactId,
            version: 1,
            content: await generateContent({type: data.type as ArtifactTypes, storyContent: story.content}),
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
    },
    getById: async (id: string): Promise<ArtifactWithVersionResponse | null> => {
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
    },
    getAllVersions: async (artifactId: string): Promise<ArtifactVersionResponse[]> => {
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
    },
    getVersion: async (artifactId: string, version: number): Promise<ArtifactVersionResponse|null> => {
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
    },
    addFeedback: async (artifactId: string, data: AddFeedbackRequest): Promise<(ArtifactWithVersionResponse & { newVersionCreated: boolean }) | null> => {
        const [artifact] = await db.select().from(artifacts).where(eq(artifacts.id, artifactId));

        if (!artifact) return null;
        if (artifact.state !== 'draft') {
            throw new Error('Cannot add feedback to finalized artifact');
        }

        // Get current version content for comparison
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

        const now = isoNow()

        // Get story content for AI generation context
        const story = await storyService.getById(artifact.storyId);
        if (!story) {
            throw new Error('Story not found');
        }

        let newContent = await generateContent({type: artifact.type as ArtifactTypes, storyContent: story.content, feedback: data.feedback})

        // Check if the generated content is the same as current content
        if (areContentsEqual(newContent, currentVersion.content)) {
            // Content unchanged, just update the artifact timestamp and return current version
            await db.update(artifacts)
                .set({updatedAt: now})
                .where(eq(artifacts.id, artifactId));

            return {
                id: artifact.id,
                storyId: artifact.storyId,
                type: artifact.type as any,
                state: artifact.state as ArtifactState,
                currentVersion: artifact.currentVersion,
                createdAt: artifact.createdAt,
                updatedAt: now,
                finalizedAt: artifact.finalizedAt,
                sourceArtifactId: artifact.sourceArtifactId,
                currentVersionContent: currentVersion.content,
                currentVersionFeedback: currentVersion.userFeedback,
                currentVersionGenerationType: currentVersion.generationType as GenerationType,
                newVersionCreated: false,
            };
        }

        // Content is different, create new version
        // Get the maximum version number from existing versions to avoid collisions after restore
        const existingVersions = await db
            .select()
            .from(artifactVersions)
            .where(eq(artifactVersions.artifactId, artifactId));

        const maxVersion = Math.max(...existingVersions.map(v => v.version));
        const newVersion = maxVersion + 1;
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
            newVersionCreated: true,
        };
    },
    finalize: async (artifactId: string): Promise<ArtifactWithVersionResponse | null> => {
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

        const now = isoNow()

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
    },
    duplicate: async (sourceArtifactId: string): Promise<ArtifactWithVersionResponse | null> => {
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
        const now = isoNow()

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
    },
    restoreVersion: async (artifactId: string, targetVersion: number): Promise<ArtifactWithVersionResponse | null> => {
        const [artifact] = await db.select().from(artifacts).where(eq(artifacts.id, artifactId));

        if (!artifact) return null;
        if (artifact.state !== 'draft') {
            throw new Error('Cannot restore versions in finalized artifact');
        }

        // Get the target version content
        const [targetVersionData] = await db
            .select()
            .from(artifactVersions)
            .where(and(
                eq(artifactVersions.artifactId, artifactId),
                eq(artifactVersions.version, targetVersion)
            ));

        if (!targetVersionData) {
            throw new Error('Target version not found');
        }

        // If we're already at this version, no action needed
        if (artifact.currentVersion === targetVersion) {
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
                currentVersionContent: targetVersionData.content,
                currentVersionFeedback: targetVersionData.userFeedback,
                currentVersionGenerationType: targetVersionData.generationType as GenerationType,
            };
        }

        const now = isoNow()

        // Simply update the current version pointer to the target version
        await db.update(artifacts)
            .set({
                currentVersion: targetVersion,
                updatedAt: now
            })
            .where(eq(artifacts.id, artifactId));

        return {
            id: artifact.id,
            storyId: artifact.storyId,
            type: artifact.type as any,
            state: artifact.state as ArtifactState,
            currentVersion: targetVersion,
            createdAt: artifact.createdAt,
            updatedAt: now,
            finalizedAt: artifact.finalizedAt,
            sourceArtifactId: artifact.sourceArtifactId,
            currentVersionContent: targetVersionData.content,
            currentVersionFeedback: targetVersionData.userFeedback,
            currentVersionGenerationType: targetVersionData.generationType as GenerationType,
        };
    },
    getByStoryId: async (storyId: string): Promise<ArtifactListResponse[]> => {
        const artifactsList = await db
            .select({
                id: artifacts.id,
                storyId: artifacts.storyId,
                type: artifacts.type,
                state: artifacts.state,
                currentVersion: artifacts.currentVersion,
                createdAt: artifacts.createdAt,
                updatedAt: artifacts.updatedAt,
                finalizedAt: artifacts.finalizedAt,
                sourceArtifactId: artifacts.sourceArtifactId,
                content: artifactVersions.content,
            })
            .from(artifacts)
            .innerJoin(artifactVersions, and(
                eq(artifactVersions.artifactId, artifacts.id),
                eq(artifactVersions.version, artifacts.currentVersion)
            ))
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
            contentSnippet: artifact.type.toLowerCase().includes('image')
                ? ''
                : artifact.content.substring(0, 150),
        }));
    },
    delete: async (artifactId: string): Promise<boolean> => {
        const [artifact] = await db.select().from(artifacts).where(eq(artifacts.id, artifactId));

        if (!artifact) return false;
        if (artifact.state !== 'draft') {
            throw new Error('Cannot delete finalized artifact');
        }

        // Delete the artifact - this will cascade delete all artifact versions
        // due to the foreign key constraint with onDelete: 'cascade'
        await db.delete(artifacts).where(eq(artifacts.id, artifactId));

        return true;
    },
    deleteVersion: async (artifactId: string, version: number): Promise<ArtifactWithVersionResponse | null> => {
        // Validate artifact exists and is in draft state
        const [artifact] = await db.select().from(artifacts).where(eq(artifacts.id, artifactId));

        if (!artifact) return null;
        if (artifact.state !== 'draft') {
            throw new Error('Cannot remove versions from finalized artifact');
        }

        // Get all versions for this artifact
        const allVersions = await db
            .select()
            .from(artifactVersions)
            .where(eq(artifactVersions.artifactId, artifactId))
            .orderBy(artifactVersions.version);

        if (allVersions.length === 0) {
            throw new Error('No versions found for artifact');
        }

        if (allVersions.length === 1) {
            throw new Error('Cannot remove the last remaining version');
        }

        // Check if the version to remove exists
        const versionToRemove = allVersions.find(v => v.version === version);
        if (!versionToRemove) {
            throw new Error('Version not found');
        }

        const now = isoNow()
        let newCurrentVersion = artifact.currentVersion;

        // If removing the current version, need to update the pointer
        if (version === artifact.currentVersion) {
            // Find the highest remaining version after removal
            const remainingVersions = allVersions.filter(v => v.version !== version);
            newCurrentVersion = Math.max(...remainingVersions.map(v => v.version));
        }

        // Perform the removal and update in a transaction-like manner
        await db.delete(artifactVersions)
            .where(and(
                eq(artifactVersions.artifactId, artifactId),
                eq(artifactVersions.version, version)
            ));

        // Update artifact's currentVersion if it was changed
        if (newCurrentVersion !== artifact.currentVersion) {
            await db.update(artifacts)
                .set({
                    currentVersion: newCurrentVersion,
                    updatedAt: now
                })
                .where(eq(artifacts.id, artifactId));
        } else {
            // Just update the timestamp
            await db.update(artifacts)
                .set({updatedAt: now})
                .where(eq(artifacts.id, artifactId));
        }

        // Get the updated artifact with new current version
        const [newCurrentVersionData] = await db
            .select()
            .from(artifactVersions)
            .where(and(
                eq(artifactVersions.artifactId, artifactId),
                eq(artifactVersions.version, newCurrentVersion)
            ));

        if (!newCurrentVersionData) {
            throw new Error('Failed to find new current version after removal');
        }

        return {
            id: artifact.id,
            storyId: artifact.storyId,
            type: artifact.type as any,
            state: artifact.state as ArtifactState,
            currentVersion: newCurrentVersion,
            createdAt: artifact.createdAt,
            updatedAt: now,
            finalizedAt: artifact.finalizedAt,
            sourceArtifactId: artifact.sourceArtifactId,
            currentVersionContent: newCurrentVersionData.content,
            currentVersionFeedback: newCurrentVersionData.userFeedback,
            currentVersionGenerationType: newCurrentVersionData.generationType as GenerationType,
        };
    },
    updateContent: async (artifactId: string, data: UpdateArtifactContentRequest): Promise<(ArtifactWithVersionResponse & { newVersionCreated: boolean }) | null> => {
        const [artifact] = await db.select().from(artifacts).where(eq(artifacts.id, artifactId));

        if (!artifact) return null;
        if (artifact.state !== 'draft') {
            throw new Error('Cannot edit finalized artifact');
        }

        // Get current version content for comparison
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

        const now = isoNow()

        // Check if the provided content is the same as current content
        if (areContentsEqual(data.content, currentVersion.content)) {
            // Content unchanged, just update the artifact timestamp and return current version
            await db.update(artifacts)
                .set({updatedAt: now})
                .where(eq(artifacts.id, artifactId));

            return {
                id: artifact.id,
                storyId: artifact.storyId,
                type: artifact.type as any,
                state: artifact.state as ArtifactState,
                currentVersion: artifact.currentVersion,
                createdAt: artifact.createdAt,
                updatedAt: now,
                finalizedAt: artifact.finalizedAt,
                sourceArtifactId: artifact.sourceArtifactId,
                currentVersionContent: currentVersion.content,
                currentVersionFeedback: currentVersion.userFeedback,
                currentVersionGenerationType: currentVersion.generationType as GenerationType,
                newVersionCreated: false,
            };
        }

        // Content is different, create new version
        // Get the maximum version number from existing versions to avoid collisions after restore
        const existingVersions = await db
            .select()
            .from(artifactVersions)
            .where(eq(artifactVersions.artifactId, artifactId));

        const maxVersion = Math.max(...existingVersions.map(v => v.version));
        const newVersion = maxVersion + 1;
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
            newVersionCreated: true,
        };
    }
}