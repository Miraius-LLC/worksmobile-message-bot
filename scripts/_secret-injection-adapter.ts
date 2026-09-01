import { mergeEnvContent } from './_env-merge'
import { formatCheckLines, parseTemplateReferences, resolveSecretsToEnv } from './_op-secrets'

export const SECRET_INJECTION_SCENARIO_IDS = [
  'merge-preserves-unmanaged',
  'merge-quotes-values',
  'resolve-env-wins',
  'resolve-ignore-env',
  'read-inherits-stdin',
  'resolve-signin-short-circuit',
  'resolve-bounded-concurrency',
  'resolve-transient-retry',
  'check-deterministic-output',
  'check-redacts-values',
  'check-read-only',
  'inject-no-write-on-read-failure',
  'scripts-canonical-entrypoints',
  'key-drift',
  'write-owner-only',
  'write-repairs-loose-mode',
  'write-atomic-preserves-existing',
  'write-rejects-symlink',
] as const

export const SECRET_INJECTION_ADAPTER = {
  contractVersion: 4,
  kind: 'template',
  targets: [
    {
      name: 'default',
      templatePath: '.env.tpl',
      outputPath: '.env',
    },
  ],
  scenarioIds: SECRET_INJECTION_SCENARIO_IDS,
  mergeEnvContent,
  parseTemplateReferences,
  resolveSecretsToEnv,
  formatCheckLines,
} as const
