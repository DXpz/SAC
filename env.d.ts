interface ImportMetaEnv {
  readonly VITE_WEBHOOK_URL?: string;
  readonly VITE_CASES_WEBHOOK_URL?: string;
  readonly VITE_CLIENTS_WEBHOOK_URL?: string;
  readonly VITE_WEBHOOK_AGENTES_URL?: string;
  readonly VITE_WEBHOOK_CASOS_URL?: string;
  readonly VITE_WEBHOOK_ROUND_ROBIN_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}


