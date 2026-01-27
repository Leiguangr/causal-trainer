import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface BatchRequest {
  custom_id: string;
  method: string;
  url: string;
  body: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    temperature?: number;
    response_format?: { type: string };
    max_tokens?: number;
  };
}

export interface BatchResponse {
  custom_id: string;
  response?: {
    body: {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
      usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
      };
    };
  };
  error?: {
    message: string;
    code?: string;
  };
}

/**
 * Create a batch file (JSONL format) from an array of requests
 */
function createBatchFile(requests: BatchRequest[]): string {
  const tempDir = os.tmpdir();
  const fileName = `batch_${Date.now()}_${Math.random().toString(36).substring(7)}.jsonl`;
  const filePath = path.join(tempDir, fileName);

  const lines = requests.map(req => JSON.stringify(req));
  fs.writeFileSync(filePath, lines.join('\n'));

  return filePath;
}

/**
 * Upload a file to OpenAI
 */
async function uploadFile(filePath: string): Promise<string> {
  const fileStream = fs.createReadStream(filePath);
  const file = await openai.files.create({
    file: fileStream,
    purpose: 'batch',
  });

  // Clean up temp file
  try {
    fs.unlinkSync(filePath);
  } catch (error) {
    console.warn(`Failed to delete temp file ${filePath}:`, error);
  }

  return file.id;
}

/**
 * Create a batch from an uploaded file
 */
async function createBatch(fileId: string): Promise<string> {
  const batch = await openai.batches.create({
    input_file_id: fileId,
    endpoint: '/v1/chat/completions',
    completion_window: '24h',
  });

  return batch.id;
}

/**
 * Poll batch status until completion
 */
async function pollBatchStatus(batchId: string, onProgress?: (status: string) => void): Promise<void> {
  const maxWaitTime = 24 * 60 * 60 * 1000; // 24 hours in ms
  const pollInterval = 10000; // Poll every 10 seconds
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    const batch = await openai.batches.retrieve(batchId);
    
    if (onProgress) {
      onProgress(batch.status);
    }

    if (batch.status === 'completed' || batch.status === 'failed' || batch.status === 'expired' || batch.status === 'canceling' || batch.status === 'canceled') {
      if (batch.status === 'failed' || batch.status === 'expired' || batch.status === 'canceled') {
        // Capture detailed error information from the batch
        const errorDetails: string[] = [`Batch ${batchId} failed with status: ${batch.status}`];
        
        // Check for token limit errors
        let isTokenLimitError = false;
        if ('errors' in batch && batch.errors) {
          const errors = batch.errors as any;
          if (errors.data && Array.isArray(errors.data)) {
            for (const err of errors.data) {
              if (err.code === 'token_limit_exceeded') {
                isTokenLimitError = true;
                errorDetails.push(`Token limit exceeded: ${err.message}`);
                break;
              }
            }
          }
        }
        
        // OpenAI batch object may have error field or errors array
        if ('error' in batch && batch.error) {
          errorDetails.push(`Error: ${JSON.stringify(batch.error)}`);
        }
        if ('errors' in batch && batch.errors && !isTokenLimitError) {
          errorDetails.push(`Errors: ${JSON.stringify(batch.errors)}`);
        }
        if ('request_counts' in batch && batch.request_counts) {
          const counts = batch.request_counts as any;
          errorDetails.push(`Request counts - Total: ${counts.total || 'unknown'}, Completed: ${counts.completed || 'unknown'}, Failed: ${counts.failed || 'unknown'}`);
        }
        
        const error = new Error(errorDetails.join('. '));
        // Add a flag to indicate this is a token limit error for fallback handling
        if (isTokenLimitError) {
          (error as any).isTokenLimitError = true;
        }
        throw error;
      }
      return;
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  throw new Error(`Batch ${batchId} timed out after 24 hours`);
}

/**
 * Retrieve batch results
 */
async function getBatchResults(batchId: string): Promise<BatchResponse[]> {
  const batch = await openai.batches.retrieve(batchId);
  
  if (!batch.output_file_id) {
    throw new Error(`Batch ${batchId} has no output file`);
  }

  // Download the output file
  const file = await openai.files.content(batch.output_file_id);
  const content = await file.text();
  
  // Parse JSONL
  const lines = content.trim().split('\n').filter(line => line.trim());
  return lines.map(line => JSON.parse(line) as BatchResponse);
}

/**
 * Split requests into fixed-size chunks
 * Default chunk size is 20 requests per batch to stay well under the 90k token limit
 */
function chunkRequests(requests: BatchRequest[], chunkSize: number = 20): BatchRequest[][] {
  const chunks: BatchRequest[][] = [];
  
  for (let i = 0; i < requests.length; i += chunkSize) {
    chunks.push(requests.slice(i, i + chunkSize));
  }

  return chunks;
}

/**
 * Process a single chunk of requests
 */
async function processChunk(
  chunk: BatchRequest[],
  chunkIndex: number,
  totalChunks: number,
  onProgress?: (status: string) => void
): Promise<BatchResponse[]> {
  console.log(`[Batch API] Processing chunk ${chunkIndex + 1}/${totalChunks} (${chunk.length} requests)`);

  // Create batch file
  const filePath = createBatchFile(chunk);
  
  // Upload file
  console.log(`[Batch API] Uploading chunk ${chunkIndex + 1} file...`);
  const fileId = await uploadFile(filePath);
  console.log(`[Batch API] Chunk ${chunkIndex + 1} file uploaded: ${fileId}`);
  
  // Create batch
  console.log(`[Batch API] Creating chunk ${chunkIndex + 1} batch...`);
  const batchId = await createBatch(fileId);
  console.log(`[Batch API] Chunk ${chunkIndex + 1} batch created: ${batchId}`);
  
  // Poll for completion
  console.log(`[Batch API] Polling chunk ${chunkIndex + 1} for completion...`);
  await pollBatchStatus(batchId, (status) => {
    console.log(`[Batch API] Chunk ${chunkIndex + 1} batch ${batchId} status: ${status}`);
    if (onProgress) {
      onProgress(status);
    }
  });
  
  // Retrieve results
  console.log(`[Batch API] Retrieving chunk ${chunkIndex + 1} results...`);
  const results = await getBatchResults(batchId);
  console.log(`[Batch API] Retrieved ${results.length} results for chunk ${chunkIndex + 1}`);
  
  // Sort results by custom_id to match request order
  const resultsMap = new Map<string, BatchResponse>();
  results.forEach(result => {
    resultsMap.set(result.custom_id, result);
  });
  
  return chunk.map(req => resultsMap.get(req.custom_id) || {
    custom_id: req.custom_id,
    error: { message: 'Result not found' },
  });
}

/**
 * Process requests using OpenAI Batch API
 * Automatically chunks large batches to stay under token limits
 * Returns an array of responses in the same order as requests
 */
export async function processBatch(
  requests: BatchRequest[],
  onProgress?: (status: string) => void
): Promise<BatchResponse[]> {
  if (requests.length === 0) {
    return [];
  }

  console.log(`[Batch API] Processing ${requests.length} requests via OpenAI Batch API`);

  // Split into chunks if needed
  const chunks = chunkRequests(requests);
  
  if (chunks.length > 1) {
    console.log(`[Batch API] Split into ${chunks.length} chunks to stay under token limit`);
  }

  // Process chunks sequentially to avoid hitting the token limit
  const allResults: BatchResponse[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunkResults = await processChunk(chunks[i], i, chunks.length, onProgress);
    allResults.push(...chunkResults);
    
    // Small delay between chunks to avoid rate limits
    if (i < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log(`[Batch API] Completed processing all ${allResults.length} requests`);
  return allResults;
}

/**
 * Check if batch API should be used based on sample count
 */
export function shouldUseBatchAPI(sampleCount: number): boolean {
  return sampleCount > 10;
}
