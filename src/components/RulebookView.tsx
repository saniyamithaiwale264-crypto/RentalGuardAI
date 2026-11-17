import { useEffect, useState } from 'react';
import {
  BookOpen,
  Check,
  Edit3,
  Info,
  Plus,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import type {
  ClauseCategory,
  RiskLevel,
  RulebookRule,
  RulebookVersion,
  VerificationStatus,
} from '../types/rental.ts';
import {
  addRuleApi,
  createRulebookVersionApi,
  deleteRuleApi,
  updateRuleApi,
} from '../services/api.ts';
import { useLanguage } from '../context/LanguageContext.tsx';
import { RiskBadge } from './RiskBadge.tsx';

interface RulebookViewProps {
  rulebooks: RulebookVersion[];
  onRulebooksChanged: (updated: RulebookVersion[]) => void;
  onGoToCompareWithVersion: (versionId: string) => void;
}

const CATEGORIES: ClauseCategory[] = [
  'Rent & Escalation',
  'Security Deposit',
  'Lock-in Period',
  'Termination & Notice',
  'Eviction & Entry',
  'Maintenance & Repairs',
  'Penalties & Late Fees',
  'Renewal & Holdover',
  'Utilities & Other Terms',
];

export function RulebookView({
  rulebooks,
  onRulebooksChanged,
  onGoToCompareWithVersion,
}: RulebookViewProps) {
  const { t } = useLanguage();
  const [selectedVersionId, setSelectedVersionId] = useState<string>(rulebooks[0]?.id || '');
  const [showNewVersionForm, setShowNewVersionForm] = useState(false);
  const [showAddRuleForm, setShowAddRuleForm] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // New version form state
  const [newVerLabel, setNewVerLabel] = useState('v1.2');
  const [newVerName, setNewVerName] = useState('');
  const [newVerDesc, setNewVerDesc] = useState('');
  const [cloneFromId, setCloneFromId] = useState(rulebooks[0]?.id || '');

  // New/Edit rule form state
  const [ruleTitle, setRuleTitle] = useState('');
  const [ruleCategory, setRuleCategory] = useState<string>('Security Deposit');
  const [ruleSeverity, setRuleSeverity] = useState<RiskLevel>('HIGH');
  const [ruleJurisdiction, setRuleJurisdiction] = useState('General / Illustrative Baseline');
  const [ruleSourceRef, setRuleSourceRef] = useState(
    'Illustrative user-defined rule — verify local applicability'
  );
  const [ruleVerification, setRuleVerification] =
    useState<VerificationStatus>('ILLUSTRATIVE');
  const [ruleDesc, setRuleDesc] = useState('');

  useEffect(() => {
    if (!selectedVersionId && rulebooks.length > 0) {
      setSelectedVersionId(rulebooks[0].id);
    }
    if (!cloneFromId && rulebooks.length > 0) {
      setCloneFromId(rulebooks[0].id);
    }
  }, [rulebooks, selectedVersionId, cloneFromId]);

  const activeVersion = rulebooks.find((rb) => rb.id === selectedVersionId) || rulebooks[0];

  function resetRuleForm() {
    setRuleTitle('');
    setRuleCategory('Security Deposit');
    setRuleSeverity('HIGH');
    setRuleJurisdiction('General / Illustrative Baseline');
    setRuleSourceRef('Illustrative user-defined rule — verify local applicability');
    setRuleVerification('ILLUSTRATIVE');
    setRuleDesc('');
    setEditingRuleId(null);
  }

  function startEditRule(rule: RulebookRule) {
    setEditingRuleId(rule.id);
    setRuleTitle(rule.title);
    setRuleCategory(rule.category);
    setRuleSeverity(rule.severityHint);
    setRuleJurisdiction(rule.jurisdiction);
    setRuleSourceRef(rule.sourceReference);
    setRuleVerification(rule.verificationStatus);
    setRuleDesc(rule.description);
    setShowAddRuleForm(true);
  }

  async function handleCreateVersion(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    if (!newVerLabel.trim() || !newVerName.trim()) {
      setErrorMsg('Please enter both a version label (e.g., v1.2) and a name.');
      return;
    }

    setBusy(true);
    try {
      const created = await createRulebookVersionApi({
        versionLabel: newVerLabel.trim(),
        name: newVerName.trim(),
        description: newVerDesc.trim() || 'Custom editable rulebook version.',
        cloneFromVersionId: cloneFromId || undefined,
      });
      const updatedList = [...rulebooks, created];
      onRulebooksChanged(updatedList);
      setSelectedVersionId(created.id);
      setShowNewVersionForm(false);
      setNewVerName('');
      setNewVerDesc('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create rulebook version.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveRule(e: React.FormEvent) {
    e.preventDefault();
    if (!activeVersion) return;
    setErrorMsg(null);

    if (!ruleTitle.trim() || !ruleDesc.trim()) {
      setErrorMsg('Rule title and description are required.');
      return;
    }

    setBusy(true);
    try {
      let updatedVersion: RulebookVersion;
      if (editingRuleId) {
        updatedVersion = await updateRuleApi(activeVersion.id, editingRuleId, {
          title: ruleTitle.trim(),
          category: ruleCategory,
          severityHint: ruleSeverity,
          jurisdiction: ruleJurisdiction.trim(),
          sourceReference: ruleSourceRef.trim(),
          verificationStatus: ruleVerification,
          description: ruleDesc.trim(),
        });
      } else {
        updatedVersion = await addRuleApi(activeVersion.id, {
          title: ruleTitle.trim(),
          category: ruleCategory,
          severityHint: ruleSeverity,
          jurisdiction: ruleJurisdiction.trim(),
          sourceReference: ruleSourceRef.trim(),
          verificationStatus: ruleVerification,
          description: ruleDesc.trim(),
          enabled: true,
        });
      }

      onRulebooksChanged(
        rulebooks.map((rb) => (rb.id === updatedVersion.id ? updatedVersion : rb))
      );
      setShowAddRuleForm(false);
      resetRuleForm();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save rule.');
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleRule(rule: RulebookRule) {
    if (!activeVersion) return;
    setErrorMsg(null);
    try {
      const updatedVersion = await updateRuleApi(activeVersion.id, rule.id, {
        enabled: !rule.enabled,
      });
      onRulebooksChanged(
        rulebooks.map((rb) => (rb.id === updatedVersion.id ? updatedVersion : rb))
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update rule.');
    }
  }

  async function handleDeleteRule(ruleId: string) {
    if (!activeVersion) return;
    setErrorMsg(null);
    try {
      const updatedVersion = await deleteRuleApi(activeVersion.id, ruleId);
      onRulebooksChanged(
        rulebooks.map((rb) => (rb.id === updatedVersion.id ? updatedVersion : rb))
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to delete rule.');
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-white">
            {t('rulebookHeading')}
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Configure custom inspection rules, track jurisdictions and source references, and publish new rulebook versions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              setNewVerLabel(`v1.${rulebooks.length}`);
              setCloneFromId(activeVersion?.id || '');
              setShowNewVersionForm((v) => !v);
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-white/[0.12] bg-white/[0.04] px-3.5 py-2 text-xs font-medium text-zinc-100 transition-colors hover:bg-white/[0.08] whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5 text-violet-400" aria-hidden="true" />
            <span>New Version</span>
          </button>

          <button
            type="button"
            onClick={() => {
              resetRuleForm();
              setShowAddRuleForm((v) => !v);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-violet-500 whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Add Rule</span>
          </button>
        </div>
      </div>

      {/* Illustrative Rules Disclosure */}
      <div className="flex items-start gap-3 rounded-xl border border-orange-500/25 bg-orange-500/[0.07] px-4 py-3 text-xs text-orange-100">
        <Info className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" aria-hidden="true" />
        <p className="leading-relaxed">
          <span className="font-semibold text-orange-300">Sample Rules Are Illustrative Until Verified:</span>{' '}
          Default checklist rules are educational tenant-review heuristics and do not assert statutory illegality. When adding local housing rules, attach a verified source reference and jurisdiction.
        </p>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-200"
        >
          {errorMsg}
        </div>
      )}

      {/* Create New Version Panel */}
      {showNewVersionForm && (
        <form
          onSubmit={handleCreateVersion}
          className="rounded-xl border border-violet-500/35 bg-[#0D0D16] p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold text-white">
              Create New Rulebook Version
            </h2>
            <button
              type="button"
              onClick={() => setShowNewVersionForm(false)}
              className="text-zinc-400 hover:text-white"
              aria-label="Close new version form"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Version Label
              </label>
              <input
                type="text"
                value={newVerLabel}
                onChange={(e) => setNewVerLabel(e.target.value)}
                placeholder="e.g., v1.2 or v2.0"
                className="w-full rounded-lg border border-white/[0.1] bg-[#07070C] px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Profile Name
              </label>
              <input
                type="text"
                value={newVerName}
                onChange={(e) => setNewVerName(e.target.value)}
                placeholder="e.g., Student Housing Strict Rules"
                className="w-full rounded-lg border border-white/[0.1] bg-[#07070C] px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Clone Rules From
              </label>
              <select
                value={cloneFromId}
                onChange={(e) => setCloneFromId(e.target.value)}
                className="w-full rounded-lg border border-white/[0.1] bg-[#07070C] px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
              >
                <option value="">Start with blank rulebook</option>
                {rulebooks.map((rb) => (
                  <option key={rb.id} value={rb.id}>
                    {rb.versionLabel} — {rb.name} ({rb.rules.length} rules)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Version Description
            </label>
            <input
              type="text"
              value={newVerDesc}
              onChange={(e) => setNewVerDesc(e.target.value)}
              placeholder="Describe what changed in this rulebook version..."
              className="w-full rounded-lg border border-white/[0.1] bg-[#07070C] px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowNewVersionForm(false)}
              className="rounded-lg border border-white/[0.1] px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-white/[0.05]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
            >
              {busy ? 'Creating...' : 'Create Version'}
            </button>
          </div>
        </form>
      )}

      {/* Version Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
        <div className="flex flex-wrap items-center gap-2">
          {rulebooks.map((rb) => {
            const active = activeVersion?.id === rb.id;
            return (
              <button
                key={rb.id}
                type="button"
                onClick={() => setSelectedVersionId(rb.id)}
                className={`rounded-lg border px-3.5 py-2 text-left transition-colors ${
                  active
                    ? 'border-violet-500/50 bg-violet-600/15 text-white'
                    : 'border-white/[0.08] bg-[#0C0C14] text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <span className="font-mono text-violet-300">{rb.versionLabel}</span>
                  <span>{rb.name}</span>
                </div>
                <div className="mt-0.5 font-mono text-[11px] text-zinc-500 tabular-nums">
                  {rb.rules.filter((r) => r.enabled).length} / {rb.rules.length} active rules
                </div>
              </button>
            );
          })}
        </div>

        {activeVersion && (
          <button
            type="button"
            onClick={() => onGoToCompareWithVersion(activeVersion.id)}
            className="text-xs font-medium text-violet-300 hover:text-violet-200 underline underline-offset-4 whitespace-nowrap"
          >
            Test {activeVersion.versionLabel} in Version Compare →
          </button>
        )}
      </div>

      {/* Add / Edit Rule Form */}
      {showAddRuleForm && activeVersion && (
        <form
          onSubmit={handleSaveRule}
          className="rounded-xl border border-violet-500/35 bg-[#0D0D16] p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold text-white">
              {editingRuleId
                ? `Edit Rule in ${activeVersion.versionLabel}`
                : `Add New Rule to ${activeVersion.versionLabel}`}
            </h2>
            <button
              type="button"
              onClick={() => {
                setShowAddRuleForm(false);
                resetRuleForm();
              }}
              className="text-zinc-400 hover:text-white"
              aria-label="Close rule form"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Rule Title
              </label>
              <input
                type="text"
                value={ruleTitle}
                onChange={(e) => setRuleTitle(e.target.value)}
                placeholder="e.g., Deposit Exceeding 2 Months Rent"
                className="w-full rounded-lg border border-white/[0.1] bg-[#07070C] px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Clause Category
              </label>
              <select
                value={ruleCategory}
                onChange={(e) => setRuleCategory(e.target.value)}
                className="w-full rounded-lg border border-white/[0.1] bg-[#07070C] px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Severity Hint
              </label>
              <select
                value={ruleSeverity}
                onChange={(e) => setRuleSeverity(e.target.value as RiskLevel)}
                className="w-full rounded-lg border border-white/[0.1] bg-[#07070C] px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
              >
                <option value="HIGH">HIGH</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="LOW">LOW</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Jurisdiction
              </label>
              <input
                type="text"
                value={ruleJurisdiction}
                onChange={(e) => setRuleJurisdiction(e.target.value)}
                placeholder="e.g., General / City Housing Guidance"
                className="w-full rounded-lg border border-white/[0.1] bg-[#07070C] px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Source Reference
              </label>
              <input
                type="text"
                value={ruleSourceRef}
                onChange={(e) => setRuleSourceRef(e.target.value)}
                placeholder="Link, guide, or 'Illustrative heuristic'"
                className="w-full rounded-lg border border-white/[0.1] bg-[#07070C] px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Verification Status
              </label>
              <select
                value={ruleVerification}
                onChange={(e) =>
                  setRuleVerification(e.target.value as VerificationStatus)
                }
                className="w-full rounded-lg border border-white/[0.1] bg-[#07070C] px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
              >
                <option value="ILLUSTRATIVE">Illustrative Sample (Unverified)</option>
                <option value="VERIFIED_REFERENCE">Verified User Reference</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Rule Description &amp; Flagging Criteria
            </label>
            <textarea
              rows={3}
              value={ruleDesc}
              onChange={(e) => setRuleDesc(e.target.value)}
              placeholder="Explain what clause language or numeric thresholds should trigger this rule..."
              className="w-full rounded-lg border border-white/[0.1] bg-[#07070C] p-3 text-sm text-white focus:border-violet-500 focus:outline-none"
              required
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowAddRuleForm(false);
                resetRuleForm();
              }}
              className="rounded-lg border border-white/[0.1] px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-white/[0.05]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{busy ? 'Saving...' : editingRuleId ? 'Update Rule' : 'Add Rule'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Rules List */}
      {activeVersion && (
        <div className="rounded-xl border border-white/[0.08] bg-[#0C0C14]">
          <div className="border-b border-white/[0.07] px-5 py-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-violet-400" aria-hidden="true" />
              <h2 className="font-display text-sm font-semibold text-white">
                {activeVersion.versionLabel} — {activeVersion.name}
              </h2>
            </div>
            <span className="text-xs text-zinc-400">{activeVersion.description}</span>
          </div>

          {activeVersion.rules.length === 0 ? (
            <div className="p-10 text-center text-sm text-zinc-400">
              No rules in this version yet. Click “Add Rule” above to define inspection criteria.
            </div>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {activeVersion.rules.map((rule) => (
                <div
                  key={rule.id}
                  className={`p-5 transition-colors ${
                    rule.enabled ? 'hover:bg-white/[0.015]' : 'opacity-55 bg-black/20'
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                        <span className="font-medium text-violet-300">{rule.category}</span>
                        <span aria-hidden="true">·</span>
                        <span>{rule.jurisdiction}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">v{(rule.version || '1.0').replace(/^v/, '')}</span>
                        <span aria-hidden="true">·</span>
                        {rule.verificationStatus === 'VERIFIED_REFERENCE' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400">
                            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Verified Reference</span>
                          </span>
                        ) : (
                          <span className="text-orange-300">Illustrative Sample (Unverified)</span>
                        )}
                      </div>

                      <h3 className="font-display text-base font-semibold text-white">
                        {rule.title}
                      </h3>

                      <p className="text-sm text-zinc-300 leading-relaxed max-w-4xl">
                        {rule.description}
                      </p>

                      <div className="text-xs text-zinc-500">
                        Source: <span className="text-zinc-400">{rule.sourceReference}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <RiskBadge level={rule.severityHint} compact />

                      <button
                        type="button"
                        onClick={() => handleToggleRule(rule)}
                        className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                          rule.enabled
                            ? 'border-white/[0.12] bg-white/[0.04] text-zinc-200 hover:bg-white/[0.08]'
                            : 'border-white/[0.08] bg-transparent text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {rule.enabled ? 'Enabled' : 'Disabled'}
                      </button>

                      <button
                        type="button"
                        onClick={() => startEditRule(rule)}
                        title="Edit rule"
                        aria-label={`Edit ${rule.title}`}
                        className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/[0.06] hover:text-white"
                      >
                        <Edit3 className="h-4 w-4" aria-hidden="true" />
                      </button>

                      {confirmDeleteId === rule.id ? (
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmDeleteId(null);
                              void handleDeleteRule(rule.id);
                            }}
                            className="rounded-md bg-red-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-red-500 whitespace-nowrap"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="rounded-md border border-white/[0.1] px-2 py-1 text-[11px] text-zinc-300 hover:bg-white/[0.06] whitespace-nowrap"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(rule.id)}
                          title="Delete rule"
                          aria-label={`Delete ${rule.title}`}
                          className="rounded-lg p-1.5 text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
