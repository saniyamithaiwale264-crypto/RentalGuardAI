import fs from 'fs';
import path from 'path';
import type {
  AgreementAnalysis,
  RulebookRule,
  RulebookVersion,
  TranslatedAnalysisPayload,
} from '../src/types/rental.ts';
import { computeRiskScore } from '../src/utils/riskScore.ts';
import { SEED_RULEBOOKS, SEED_SAMPLE_ANALYSIS } from './seedData.ts';

interface StoreSchema {
  rulebooks: RulebookVersion[];
  analyses: AgreementAnalysis[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'rentalguard-store.json');

function ensureStoreFile(): StoreSchema {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(STORE_PATH)) {
    const initial: StoreSchema = {
      rulebooks: structuredClone(SEED_RULEBOOKS),
      analyses: [structuredClone(SEED_SAMPLE_ANALYSIS)],
    };
    fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as StoreSchema;
    if (!Array.isArray(parsed.rulebooks) || !Array.isArray(parsed.analyses)) {
      throw new Error('Invalid store schema');
    }
    parsed.analyses = parsed.analyses.map((a) => ({
      ...a,
      riskScore:
        typeof a.riskScore === 'number' ? a.riskScore : computeRiskScore(a.riskCounts),
      recommendedActions:
        Array.isArray(a.recommendedActions) && a.recommendedActions.length > 0
          ? a.recommendedActions
          : a.clauses
              .filter((c) => c.riskLevel === 'HIGH' || c.riskLevel === 'MEDIUM')
              .slice(0, 5)
              .map((c) => c.recommendation)
              .filter(Boolean),
    }));
    return parsed;
  } catch {
    const fallback: StoreSchema = {
      rulebooks: structuredClone(SEED_RULEBOOKS),
      analyses: [structuredClone(SEED_SAMPLE_ANALYSIS)],
    };
    fs.writeFileSync(STORE_PATH, JSON.stringify(fallback, null, 2), 'utf-8');
    return fallback;
  }
}

function writeStore(data: StoreSchema): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

export function getRulebooks(): RulebookVersion[] {
  return ensureStoreFile().rulebooks;
}

export function getRulebookById(id: string): RulebookVersion | undefined {
  return ensureStoreFile().rulebooks.find((rb) => rb.id === id);
}

export function createRulebookVersion(input: {
  versionLabel: string;
  name: string;
  description: string;
  cloneFromVersionId?: string;
}): RulebookVersion {
  const store = ensureStoreFile();
  const source = input.cloneFromVersionId
    ? store.rulebooks.find((rb) => rb.id === input.cloneFromVersionId)
    : undefined;

  const now = new Date().toISOString();
  const id = `rb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const clonedRules: RulebookRule[] = source
    ? source.rules.map((r) => ({
        ...r,
        version: input.versionLabel,
        updatedAt: now,
      }))
    : [];

  const newVersion: RulebookVersion = {
    id,
    versionLabel: input.versionLabel.trim(),
    name: input.name.trim(),
    description: input.description.trim(),
    createdAt: now,
    parentVersionId: source?.id,
    rules: clonedRules,
  };

  store.rulebooks.push(newVersion);
  writeStore(store);
  return newVersion;
}

export function addRuleToVersion(
  versionId: string,
  rule: Omit<RulebookRule, 'id' | 'version' | 'updatedAt'>
): RulebookVersion | null {
  const store = ensureStoreFile();
  const version = store.rulebooks.find((rb) => rb.id === versionId);
  if (!version) return null;

  const newRule: RulebookRule = {
    ...rule,
    id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    version: version.versionLabel,
    updatedAt: new Date().toISOString(),
  };

  version.rules.unshift(newRule);
  writeStore(store);
  return version;
}

export function updateRuleInVersion(
  versionId: string,
  ruleId: string,
  updates: Partial<Omit<RulebookRule, 'id' | 'version'>>
): RulebookVersion | null {
  const store = ensureStoreFile();
  const version = store.rulebooks.find((rb) => rb.id === versionId);
  if (!version) return null;

  const idx = version.rules.findIndex((r) => r.id === ruleId);
  if (idx === -1) return null;

  version.rules[idx] = {
    ...version.rules[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  writeStore(store);
  return version;
}

export function deleteRuleFromVersion(versionId: string, ruleId: string): RulebookVersion | null {
  const store = ensureStoreFile();
  const version = store.rulebooks.find((rb) => rb.id === versionId);
  if (!version) return null;

  version.rules = version.rules.filter((r) => r.id !== ruleId);
  writeStore(store);
  return version;
}

export function getAnalyses(): AgreementAnalysis[] {
  const store = ensureStoreFile();
  return [...store.analyses].sort(
    (a, b) => new Date(b.analyzedAt).getTime() - new Date(a.analyzedAt).getTime()
  );
}

export function getAnalysisById(id: string): AgreementAnalysis | undefined {
  return ensureStoreFile().analyses.find((a) => a.id === id);
}

export function findAnalysisForAgreementAndVersion(
  agreementId: string,
  rulebookVersionId: string
): AgreementAnalysis | undefined {
  return ensureStoreFile().analyses.find(
    (a) => a.agreementId === agreementId && a.rulebookVersionId === rulebookVersionId
  );
}

export function saveAnalysis(analysis: AgreementAnalysis): AgreementAnalysis {
  const store = ensureStoreFile();
  store.analyses = [analysis, ...store.analyses.filter((a) => a.id !== analysis.id)];
  writeStore(store);
  return analysis;
}

export function saveAnalysisTranslation(
  analysisId: string,
  targetLanguage: string,
  translation: TranslatedAnalysisPayload
): AgreementAnalysis | undefined {
  const store = ensureStoreFile();
  const idx = store.analyses.findIndex((a) => a.id === analysisId);
  if (idx === -1) return undefined;

  const current = store.analyses[idx];
  const key = targetLanguage.trim();
  const updated: AgreementAnalysis = {
    ...current,
    translations: {
      ...(current.translations || {}),
      [key]: translation,
    },
  };
  store.analyses[idx] = updated;
  writeStore(store);
  return updated;
}

export function deleteAnalysis(id: string): boolean {
  const store = ensureStoreFile();
  const prevLen = store.analyses.length;
  store.analyses = store.analyses.filter((a) => a.id !== id);
  if (store.analyses.length !== prevLen) {
    writeStore(store);
    return true;
  }
  return false;
}
