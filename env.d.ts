interface ImportMetaEnv {
  readonly VITE_WEBHOOK_URL?: string;
  readonly VITE_CASES_WEBHOOK_URL?: string;
  readonly VITE_CLIENTS_WEBHOOK_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}


