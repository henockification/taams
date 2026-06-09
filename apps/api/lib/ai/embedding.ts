import { embed, embedMany, generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { db } from '../../db/db';
import { cosineDistance, desc, gt, sql } from 'drizzle-orm';

const embeddingModel = openai.embedding('text-embedding-3-small');
const textModel = openai('gpt-4o-mini');
export interface ChunkRow {
  content: string;
  metadata?: Record<string, any>;
}

export interface EmbeddingResult {
  embedding: number[];
  content: string;
  metadata?: Record<string, any>;
}

/**
 * Generate embeddings for multiple chunks
 * @param chunks - Array of chunk content
 * @returns Promise with embeddings and content
 */
export const generateEmbeddings = async (
  chunks: ChunkRow[]
): Promise<EmbeddingResult[]> => {
  try {
    const { embeddings: embeddingVectors } = await embedMany({
      model: embeddingModel,
      values: chunks.map(c => c.content),
    });

    return embeddingVectors.map((embedding, index) => ({
      content: chunks[index].content,
      embedding,
      metadata: chunks[index].metadata,
    }));
  } catch (error) {
    console.error('Error generating embeddings:', error);
    throw new Error(`Failed to generate embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Generate a single embedding
 * @param value - Text to embed
 * @returns Promise with embedding vector
 */
export const generateEmbedding = async (value: string): Promise<number[]> => {
  try {
    const input = value.replace(/\\n/g, ' ').trim();
    const { embedding } = await embed({
      model: embeddingModel,
      value: input,
    });
    return embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

function toVectorLiteral(vec: number[]) {
  // pgvector expects '[v1, v2, ...]'::vector
  return sql.raw(`'[${vec.join(',')}]'::vector`);
}

export const generateTextResponse = async (prompt: string, system: string): Promise<string> => {
  const { text } = await generateText({
    model: textModel,
    system,
    prompt,
  });
  return text;
};