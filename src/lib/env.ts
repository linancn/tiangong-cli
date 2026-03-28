export type EnvSpec = {
  key: string;
  required: boolean;
  description: string;
  defaultValue?: string;
};

export type ResolvedEnv = {
  key: string;
  source: 'env' | 'default' | 'missing';
  value: string | null;
  present: boolean;
};

export const ENV_KEYS = {
  apiBaseUrl: 'TIANGONG_LCA_API_BASE_URL',
  apiKey: 'TIANGONG_LCA_API_KEY',
  region: 'TIANGONG_LCA_REGION',
} as const;

export const ENV_SPECS: EnvSpec[] = [
  {
    key: ENV_KEYS.apiBaseUrl,
    required: true,
    description: 'Main TianGong LCA API / Edge Functions base URL',
  },
  {
    key: ENV_KEYS.apiKey,
    required: true,
    description: 'Main TianGong LCA API key',
  },
  {
    key: ENV_KEYS.region,
    required: false,
    description: 'Target TianGong LCA API region',
    defaultValue: 'us-east-1',
  },
];

export type DoctorCheck = {
  key: string;
  description: string;
  required: boolean;
  source: ResolvedEnv['source'];
  present: boolean;
  valuePreview: string | null;
};

export type DoctorReport = {
  ok: boolean;
  loadedDotEnv: boolean;
  dotEnvPath: string;
  dotEnvKeysLoaded: number;
  checks: DoctorCheck[];
};

export type RuntimeEnv = {
  apiBaseUrl: string | null;
  apiKey: string | null;
  region: string;
};

export function resolveEnv(spec: EnvSpec, env: NodeJS.ProcessEnv): ResolvedEnv {
  const envValue = env[spec.key];
  if (envValue) {
    return {
      key: spec.key,
      source: 'env',
      value: envValue,
      present: true,
    };
  }

  if (spec.defaultValue !== undefined) {
    return {
      key: spec.key,
      source: 'default',
      value: spec.defaultValue,
      present: true,
    };
  }

  return {
    key: spec.key,
    source: 'missing',
    value: null,
    present: false,
  };
}

export function readRuntimeEnv(env: NodeJS.ProcessEnv): RuntimeEnv {
  const apiBaseUrl = resolveEnv(ENV_SPECS[0], env).value;
  const apiKey = resolveEnv(ENV_SPECS[1], env).value;
  const region = resolveEnv(ENV_SPECS[2], env).value as string;

  return {
    apiBaseUrl,
    apiKey,
    region,
  };
}

export function maskSecret(value: string | null): string | null {
  if (!value) {
    return value;
  }
  if (value.length <= 8) {
    return value;
  }
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function buildDoctorReport(
  env: NodeJS.ProcessEnv,
  dotEnvStatus: { loaded: boolean; path: string; count: number },
): DoctorReport {
  const checks = ENV_SPECS.map((spec) => {
    const resolved = resolveEnv(spec, env);
    return {
      key: spec.key,
      description: spec.description,
      required: spec.required,
      source: resolved.source,
      present: resolved.present,
      valuePreview: maskSecret(resolved.value),
    };
  });

  return {
    ok: checks.every((check) => !check.required || check.present),
    loadedDotEnv: dotEnvStatus.loaded,
    dotEnvPath: dotEnvStatus.path,
    dotEnvKeysLoaded: dotEnvStatus.count,
    checks,
  };
}
