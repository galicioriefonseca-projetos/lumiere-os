import { GoogleGenAI } from "@google/genai";
import { env } from "../config/env.js";

/**
 * Isola a autenticação da Developer API Key removendo temporariamente variáveis GCP ADC
 */
export async function withDeveloperAuth<T>(apiKey: string, fn: (ai: GoogleGenAI) => Promise<T>): Promise<T> {
  const prevCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const prevGcloudProject = process.env.GOOGLE_GCLOUD_PROJECT;
  const prevCloudProject = process.env.GOOGLE_CLOUD_PROJECT;
  const prevGcloudProj = process.env.GCLOUD_PROJECT;
  const prevGcpProject = process.env.GCP_PROJECT;
  const prevMetadataHost = process.env.GCP_METADATA_HOST;
  const prevDetectMetadata = process.env.DETECT_GCP_METADATA;

  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  delete process.env.GOOGLE_GCLOUD_PROJECT;
  delete process.env.GOOGLE_CLOUD_PROJECT;
  delete process.env.GCLOUD_PROJECT;
  delete process.env.GCP_PROJECT;
  
  process.env.GCP_METADATA_HOST = "localhost";
  process.env.DETECT_GCP_METADATA = "false";

  try {
    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
          'Authorization': '',
        },
      },
    });

    return await fn(ai);
  } finally {
    if (prevCredentials) process.env.GOOGLE_APPLICATION_CREDENTIALS = prevCredentials;
    if (prevGcloudProject) process.env.GOOGLE_GCLOUD_PROJECT = prevGcloudProject;
    if (prevCloudProject) process.env.GOOGLE_CLOUD_PROJECT = prevCloudProject;
    if (prevGcloudProj) process.env.GCLOUD_PROJECT = prevGcloudProj;
    if (prevGcpProject) process.env.GCP_PROJECT = prevGcpProject;
    
    if (prevMetadataHost) {
      process.env.GCP_METADATA_HOST = prevMetadataHost;
    } else {
      delete process.env.GCP_METADATA_HOST;
    }

    if (prevDetectMetadata) {
      process.env.DETECT_GCP_METADATA = prevDetectMetadata;
    } else {
      delete process.env.DETECT_GCP_METADATA;
    }
  }
}
