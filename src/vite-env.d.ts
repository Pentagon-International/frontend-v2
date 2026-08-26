/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_API_AUTH_TOKEN?: string;
  readonly VITE_AZURE_CLIENT_ID: string;
  readonly VITE_AZURE_TENANT_ID: string;
  readonly VITE_ATTESTR_GSTIN_BASIC_AUTH?: string;
  readonly VITE_CHATBOT_API_BASE_URL?: string;
  readonly VITE_GOOGLE_SPEECH_API_KEY?: string;
  readonly VITE_OPENAI_API_KEY?: string;
  readonly VITE_QUOTATION_APPROVE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
