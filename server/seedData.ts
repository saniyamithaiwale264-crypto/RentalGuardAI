import type { AgreementAnalysis, RulebookVersion } from '../src/types/rental.ts';

export const SAMPLE_AGREEMENT_ID = 'demo-agreement-oakridge-2026';

export const SAMPLE_AGREEMENT_TITLE = 'Sample Urban Apartment Lease — Oakridge Residences (Unit 4B)';

export const SAMPLE_AGREEMENT_TEXT = `RESIDENTIAL RENTAL AGREEMENT (SAMPLE DEMO DOCUMENT)

This Residential Rental Agreement ("Agreement") is entered into as of December 1, 2026, by and between Oakridge Property Holdings LLC ("Landlord") and Jordan Mercer ("Tenant") for the residential premises located at 742 Oakridge Avenue, Apartment 4B ("Premises").

1. TERM AND LOCK-IN PERIOD
The lease term shall commence on December 1, 2026 and continue for a fixed period of twelve (12) months ending November 30, 2027. The first nine (9) months of the lease shall constitute a mandatory Lock-in Period during which Tenant may not terminate this Agreement for any reason. If Tenant vacates or attempts to terminate during the Lock-in Period, Tenant shall immediately forfeit the entire Security Deposit and pay an additional liquidated early-exit penalty equal to two (2) months' Base Rent.

2. RENT AND ESCALATION
Tenant agrees to pay monthly Base Rent of $2,450.00 due on or before the 1st day of each calendar month. Landlord reserves the right to adjust monthly utilities surcharges and common-area assessment fees at Landlord's discretion upon 15 days' written notice.

3. LATE FEES AND PENALTIES
Any rent payment received after 5:00 PM on the 3rd day of the month shall incur an immediate flat late fee of $175.00, plus an additional compounding charge of $45.00 per day for each subsequent day rent remains unpaid. Returned or rejected electronic payments shall incur a $95.00 administrative fee.

4. SECURITY DEPOSIT AND DEDUCTIONS
Upon signing, Tenant shall pay a Security Deposit equal to four (4) months' Base Rent ($9,800.00). Of this amount, $650.00 is designated as a non-refundable administrative move-out and deep-cleaning fee regardless of the condition in which the Premises are returned. Landlord shall have up to sixty (60) days after lease termination to return any remaining balance without interest, and Landlord's itemized repair estimates shall be final and binding without requirement for third-party contractor receipts.

5. TERMINATION AND NOTICE
After the Lock-in Period expires, Tenant must provide at least sixty (60) days' prior written notice to terminate this Agreement at the end of a billing cycle. Landlord, however, may terminate this Agreement without cause at any time upon fifteen (15) days' written notice to Tenant, including for planned renovations or sale of the property.

6. MAINTENANCE AND REPAIRS
Tenant accepts the Premises "as-is" and shall be solely responsible for all interior repairs, appliance servicing, plumbing blockages, HVAC filter and compressor maintenance, and electrical fixture replacements up to $500 per incident, even where wear arises from normal aging of building systems. Landlord shall only be responsible for structural roof and exterior foundation repairs exceeding $1,500 per occurrence.

7. ENTRY AND EVICTION
Landlord or Landlord's agents may enter the Premises at any time with 4 hours' verbal or text notice for inspections, showings to prospective buyers, or maintenance. In the event of any alleged breach of house rules or late payment exceeding five (5) days, Landlord may deactivate smart-lock access credentials and initiate expedited summary repossession without prior cure period.

8. AUTOMATIC RENEWAL AND HOLDOVER
Unless Tenant delivers written non-renewal notice at least sixty (60) days prior to the expiration date, this Agreement shall automatically renew for an additional twelve (12) month term at a mandatory 12% Base Rent increase. If Tenant holds over past the expiration date without a signed renewal, Tenant shall owe holdover rent equal to 200% of the prior monthly Base Rent, calculated on a full-month basis even for partial-month occupancy.

9. UTILITIES AND GUEST POLICY
Tenant shall pay all electricity, gas, water, sewer, trash, and mandatory smart-building internet package fees ($110/month). Overnight guests staying longer than three (3) consecutive nights require Landlord's prior written approval and a $35/night guest surcharge.`;

export const SEED_RULEBOOKS: RulebookVersion[] = [
  {
    id: 'rb-v1-0',
    versionLabel: 'v1.0',
    name: 'Baseline Tenant Review Checklist',
    description:
      'Illustrative starter rulebook covering core lease terms such as deposits, lock-in clauses, asymmetric termination notice, maintenance shifting, and automatic renewals.',
    createdAt: '2026-11-10T09:00:00.000Z',
    rules: [
      {
        id: 'rule-deposit-1',
        title: 'High Security Deposit & Non-Refundable Deductions',
        category: 'Security Deposit',
        description:
          'Flag security deposits exceeding 2 months of rent, non-refundable cleaning/move-out fees, return windows longer than 30 days, or clauses stating landlord estimates are binding without receipts.',
        jurisdiction: 'General / Illustrative Baseline',
        sourceReference: 'Illustrative sample heuristic — verify local housing caps before relying',
        version: 'v1.0',
        severityHint: 'HIGH',
        verificationStatus: 'ILLUSTRATIVE',
        enabled: true,
        updatedAt: '2026-11-10T09:00:00.000Z',
      },
      {
        id: 'rule-lockin-1',
        title: 'Long Lock-in Period with Double Penalty',
        category: 'Lock-in Period',
        description:
          'Flag mandatory lock-in periods exceeding 6 months that combine deposit forfeiture with additional multi-month liquidated exit penalties.',
        jurisdiction: 'General / Illustrative Baseline',
        sourceReference: 'Illustrative sample heuristic — verify local enforceability standards',
        version: 'v1.0',
        severityHint: 'HIGH',
        verificationStatus: 'ILLUSTRATIVE',
        enabled: true,
        updatedAt: '2026-11-10T09:00:00.000Z',
      },
      {
        id: 'rule-termination-1',
        title: 'Asymmetric Termination Notice Periods',
        category: 'Termination & Notice',
        description:
          'Flag clauses requiring significantly longer notice from the tenant (e.g., 60 days) than from the landlord (e.g., 15 days without cause).',
        jurisdiction: 'General / Illustrative Baseline',
        sourceReference: 'Illustrative sample heuristic — check local notice parity rules',
        version: 'v1.0',
        severityHint: 'HIGH',
        verificationStatus: 'ILLUSTRATIVE',
        enabled: true,
        updatedAt: '2026-11-10T09:00:00.000Z',
      },
      {
        id: 'rule-eviction-1',
        title: 'Short Entry Notice or Self-Help Lockout Language',
        category: 'Eviction & Entry',
        description:
          'Flag landlord entry with less than 24 hours notice or clauses permitting smart-lock deactivation / lockout without formal cure period or court process.',
        jurisdiction: 'General / Illustrative Baseline',
        sourceReference: 'Illustrative sample heuristic — consult local tenant protection resources',
        version: 'v1.0',
        severityHint: 'HIGH',
        verificationStatus: 'ILLUSTRATIVE',
        enabled: true,
        updatedAt: '2026-11-10T09:00:00.000Z',
      },
      {
        id: 'rule-maintenance-1',
        title: 'Major Appliance or System Repair Burden on Tenant',
        category: 'Maintenance & Repairs',
        description:
          'Flag clauses shifting structural, HVAC, plumbing, or normal wear-and-tear repair costs onto the tenant (e.g., per-incident repair thresholds).',
        jurisdiction: 'General / Illustrative Baseline',
        sourceReference: 'Illustrative sample heuristic — check habitability & repair standards',
        version: 'v1.0',
        severityHint: 'MEDIUM',
        verificationStatus: 'ILLUSTRATIVE',
        enabled: true,
        updatedAt: '2026-11-10T09:00:00.000Z',
      },
      {
        id: 'rule-penalties-1',
        title: 'Compounding Daily Late Fees & Short Grace Period',
        category: 'Penalties & Late Fees',
        description:
          'Flag late fees exceeding 5% of monthly rent or daily compounding penalties after a grace period of 3 days or less.',
        jurisdiction: 'General / Illustrative Baseline',
        sourceReference: 'Illustrative sample heuristic — verify local late fee reasonableness rules',
        version: 'v1.0',
        severityHint: 'MEDIUM',
        verificationStatus: 'ILLUSTRATIVE',
        enabled: true,
        updatedAt: '2026-11-10T09:00:00.000Z',
      },
      {
        id: 'rule-renewal-1',
        title: 'Automatic Annual Renewal with Steep Rent Escalation',
        category: 'Renewal & Holdover',
        description:
          'Flag auto-renewal clauses locking in another full-year term with >=10% automatic rent escalation or 200% holdover charges.',
        jurisdiction: 'General / Illustrative Baseline',
        sourceReference: 'Illustrative sample heuristic — check local renewal notice requirements',
        version: 'v1.0',
        severityHint: 'MEDIUM',
        verificationStatus: 'ILLUSTRATIVE',
        enabled: true,
        updatedAt: '2026-11-10T09:00:00.000Z',
      },
      {
        id: 'rule-utilities-1',
        title: 'Mandatory Bundled Fees & Restrictive Guest Surcharges',
        category: 'Utilities & Other Terms',
        description:
          'Flag mandatory third-party internet/amenity packages or strict overnight guest limits with per-night surcharges.',
        jurisdiction: 'General / Illustrative Baseline',
        sourceReference: 'Illustrative sample heuristic — review before signing',
        version: 'v1.0',
        severityHint: 'LOW',
        verificationStatus: 'ILLUSTRATIVE',
        enabled: true,
        updatedAt: '2026-11-10T09:00:00.000Z',
      },
    ],
  },
  {
    id: 'rb-v1-1',
    versionLabel: 'v1.1',
    name: 'Stricter Tenant Protection Profile',
    description:
      'Updated illustrative rulebook escalating discretionary rent/utility surcharges, repair-shifting, and automatic renewal lock-ins to higher scrutiny.',
    createdAt: '2026-11-15T14:30:00.000Z',
    parentVersionId: 'rb-v1-0',
    rules: [
      {
        id: 'rule-deposit-1',
        title: 'High Security Deposit & Non-Refundable Deductions',
        category: 'Security Deposit',
        description:
          'Flag security deposits exceeding 2 months of rent, non-refundable cleaning/move-out fees, return windows longer than 30 days, or clauses stating landlord estimates are binding without receipts.',
        jurisdiction: 'General / Illustrative Baseline',
        sourceReference: 'Illustrative sample heuristic — verify local housing caps before relying',
        version: 'v1.1',
        severityHint: 'HIGH',
        verificationStatus: 'ILLUSTRATIVE',
        enabled: true,
        updatedAt: '2026-11-15T14:30:00.000Z',
      },
      {
        id: 'rule-lockin-1',
        title: 'Long Lock-in Period with Double Penalty',
        category: 'Lock-in Period',
        description:
          'Flag mandatory lock-in periods exceeding 6 months that combine deposit forfeiture with additional multi-month liquidated exit penalties.',
        jurisdiction: 'General / Illustrative Baseline',
        sourceReference: 'Illustrative sample heuristic — verify local enforceability standards',
        version: 'v1.1',
        severityHint: 'HIGH',
        verificationStatus: 'ILLUSTRATIVE',
        enabled: true,
        updatedAt: '2026-11-15T14:30:00.000Z',
      },
      {
        id: 'rule-termination-1',
        title: 'Asymmetric Termination Notice Periods',
        category: 'Termination & Notice',
        description:
          'Flag clauses requiring significantly longer notice from the tenant (e.g., 60 days) than from the landlord (e.g., 15 days without cause).',
        jurisdiction: 'General / Illustrative Baseline',
        sourceReference: 'Illustrative sample heuristic — check local notice parity rules',
        version: 'v1.1',
        severityHint: 'HIGH',
        verificationStatus: 'ILLUSTRATIVE',
        enabled: true,
        updatedAt: '2026-11-15T14:30:00.000Z',
      },
      {
        id: 'rule-eviction-1',
        title: 'Short Entry Notice or Self-Help Lockout Language',
        category: 'Eviction & Entry',
        description:
          'Flag landlord entry with less than 24 hours notice or clauses permitting smart-lock deactivation / lockout without formal cure period or court process.',
        jurisdiction: 'General / Illustrative Baseline',
        sourceReference: 'Illustrative sample heuristic — consult local tenant protection resources',
        version: 'v1.1',
        severityHint: 'HIGH',
        verificationStatus: 'ILLUSTRATIVE',
        enabled: true,
        updatedAt: '2026-11-15T14:30:00.000Z',
      },
      {
        id: 'rule-maintenance-1',
        title: 'Major Appliance or System Repair Burden on Tenant',
        category: 'Maintenance & Repairs',
        description:
          'Escalate to HIGH when tenant is required to pay up to $500 per incident for HVAC, plumbing, or normal aging of building systems.',
        jurisdiction: 'General / Illustrative Baseline',
        sourceReference: 'Illustrative sample heuristic — check habitability & repair standards',
        version: 'v1.1',
        severityHint: 'HIGH',
        verificationStatus: 'ILLUSTRATIVE',
        enabled: true,
        updatedAt: '2026-11-15T14:30:00.000Z',
      },
      {
        id: 'rule-penalties-1',
        title: 'Compounding Daily Late Fees & Short Grace Period',
        category: 'Penalties & Late Fees',
        description:
          'Escalate to HIGH when compounding daily late fees are combined with a flat penalty exceeding $100.',
        jurisdiction: 'General / Illustrative Baseline',
        sourceReference: 'Illustrative sample heuristic — verify local late fee reasonableness rules',
        version: 'v1.1',
        severityHint: 'HIGH',
        verificationStatus: 'ILLUSTRATIVE',
        enabled: true,
        updatedAt: '2026-11-15T14:30:00.000Z',
      },
      {
        id: 'rule-rent-discretion',
        title: 'Unilateral Mid-Lease Utility or Assessment Fee Increases',
        category: 'Rent & Escalation',
        description:
          'Flag any clause allowing the landlord to unilaterally adjust surcharges or common-area fees mid-lease without a cap or cost documentation.',
        jurisdiction: 'General / Illustrative Baseline',
        sourceReference: 'Illustrative sample heuristic — newly added in v1.1',
        version: 'v1.1',
        severityHint: 'MEDIUM',
        verificationStatus: 'ILLUSTRATIVE',
        enabled: true,
        updatedAt: '2026-11-15T14:30:00.000Z',
      },
      {
        id: 'rule-renewal-1',
        title: 'Automatic Annual Renewal with Steep Rent Escalation',
        category: 'Renewal & Holdover',
        description:
          'Flag auto-renewal clauses locking in another full-year term with >=10% automatic rent escalation or 200% holdover charges.',
        jurisdiction: 'General / Illustrative Baseline',
        sourceReference: 'Illustrative sample heuristic — check local renewal notice requirements',
        version: 'v1.1',
        severityHint: 'HIGH',
        verificationStatus: 'ILLUSTRATIVE',
        enabled: true,
        updatedAt: '2026-11-15T14:30:00.000Z',
      },
    ],
  },
];

export const SEED_SAMPLE_ANALYSIS: AgreementAnalysis = {
  id: 'sample-analysis-oakridge-v1-0',
  agreementId: SAMPLE_AGREEMENT_ID,
  title: SAMPLE_AGREEMENT_TITLE,
  fileName: 'sample-oakridge-lease-2026.txt',
  sourceType: 'demo',
  isDemo: true,
  isSampleResult: true,
  extractedText: SAMPLE_AGREEMENT_TEXT,
  pageCount: 2,
  wordCount: 534,
  rulebookVersionId: 'rb-v1-0',
  rulebookVersionLabel: 'v1.0',
  rulebookName: 'Baseline Tenant Review Checklist',
  analyzedAt: '2026-11-16T15:20:00.000Z',
  executiveSummary:
    'This sample residential lease contains several heavily landlord-favored financial and termination provisions, including a 4-month security deposit ($9,800) with a non-refundable fee, a 9-month lock-in carrying a double exit penalty, asymmetric termination notice (60 days tenant vs. 15 days landlord), and smart-lock deactivation language without a cure window.',
  informationalDisclaimer:
    'Informational review only — not legal advice. Findings reflect the illustrative rules in v1.0 and require verification against your local housing regulations or consultation with a qualified attorney.',
  keyTerms: {
    monthlyRent: '$2,450.00 / month',
    securityDeposit: '$9,800.00 (4 months; $650 non-refundable)',
    leaseDuration: '12 months (Dec 1, 2026 – Nov 30, 2027)',
    lockInPeriod: '9 months (deposit forfeiture + 2 months rent penalty)',
    noticePeriod: 'Tenant: 60 days · Landlord: 15 days',
    lateFeePolicy: '$175 flat after 3 days + $45/day compounding',
  },
  riskScore: 85,
  riskCounts: {
    high: 4,
    medium: 3,
    low: 2,
    total: 9,
  },
  recommendedActions: [
    'Request lowering the 4-month ($9,800) security deposit and removing the $650 non-refundable move-out fee.',
    'Negotiate a lease-break replacement clause to cap the 9-month lock-in exit exposure.',
    'Ask for mutual termination notice parity (30 or 60 days) and remove the landlord without-cause 15-day exit.',
    'Require at least 24 hours written notice for non-emergency entry and remove smart-lock deactivation language.',
    'Convert automatic 12% annual renewal into month-to-month unless both parties sign a renewal addendum.',
  ],
  clauses: [
    {
      id: 'sample-clause-1',
      category: 'Security Deposit',
      clauseTitle: 'Four-Month Deposit, Non-Refundable Fee & Binding Estimates',
      riskLevel: 'HIGH',
      plainEnglish:
        'You must pay $9,800 upfront (4 months of rent). $650 is automatically kept even if you leave the apartment spotless, the landlord gets 60 days to refund the rest without interest, and they do not have to show contractor receipts for deductions.',
      whyItMatters:
        'High upfront deposits tie up substantial cash, non-refundable fees reduce what you get back regardless of care, and waiving receipt requirements makes it difficult to verify deduction amounts.',
      exactSourceText:
        'Upon signing, Tenant shall pay a Security Deposit equal to four (4) months\' Base Rent ($9,800.00). Of this amount, $650.00 is designated as a non-refundable administrative move-out and deep-cleaning fee regardless of the condition in which the Premises are returned. Landlord shall have up to sixty (60) days after lease termination to return any remaining balance without interest, and Landlord\'s itemized repair estimates shall be final and binding without requirement for third-party contractor receipts.',
      matchedRuleIds: ['rule-deposit-1'],
      matchedRuleTitles: ['High Security Deposit & Non-Refundable Deductions'],
      questionsToAsk: [
        'Can the security deposit be reduced to 1 or 2 months of rent?',
        'Can we remove the $650 non-refundable fee if the unit is returned in move-in clean condition?',
        'Will you agree to provide itemized invoices or receipts for any repair deductions within 21–30 days?',
      ],
      recommendation:
        'Request reducing the deposit multiple, removing the blanket non-refundable fee, shortening the return timeline, and requiring itemized receipts for deductions.',
    },
    {
      id: 'sample-clause-2',
      category: 'Lock-in Period',
      clauseTitle: 'Nine-Month Lock-in with Deposit Forfeiture Plus Two Months Penalty',
      riskLevel: 'HIGH',
      plainEnglish:
        'You cannot end the lease during the first 9 months for any reason. Leaving early costs your entire $9,800 deposit plus an extra $4,900 penalty—six months of rent total.',
      whyItMatters:
        'Combining full deposit forfeiture with an extra two-month liquidated penalty creates a severe financial exit barrier ($14,700 total exposure) if job relocation, medical needs, or property issues arise.',
      exactSourceText:
        'The first nine (9) months of the lease shall constitute a mandatory Lock-in Period during which Tenant may not terminate this Agreement for any reason. If Tenant vacates or attempts to terminate during the Lock-in Period, Tenant shall immediately forfeit the entire Security Deposit and pay an additional liquidated early-exit penalty equal to two (2) months\' Base Rent.',
      matchedRuleIds: ['rule-lockin-1'],
      matchedRuleTitles: ['Long Lock-in Period with Double Penalty'],
      questionsToAsk: [
        'If I find a qualified replacement tenant approved by management, can the early-exit penalty be waived?',
        'Can the lock-in penalty be capped at a fixed 1-month fee rather than forfeiting the full deposit plus 2 months rent?',
      ],
      recommendation:
        'Negotiate a lease-break clause allowing assignment/re-letting to a qualified replacement tenant or capping early-termination fees without forfeiting the entire security deposit.',
    },
    {
      id: 'sample-clause-3',
      category: 'Termination & Notice',
      clauseTitle: 'Asymmetric Termination Notice (60 Days Tenant vs. 15 Days Landlord)',
      riskLevel: 'HIGH',
      plainEnglish:
        'After the lock-in period, you must give 60 days written notice to leave, while the landlord can end your lease without cause with only 15 days notice.',
      whyItMatters:
        'Fifteen days is an extremely short window to locate a new home, secure moving logistics, and fund a new deposit, whereas you are held to a 60-day notice obligation.',
      exactSourceText:
        'After the Lock-in Period expires, Tenant must provide at least sixty (60) days\' prior written notice to terminate this Agreement at the end of a billing cycle. Landlord, however, may terminate this Agreement without cause at any time upon fifteen (15) days\' written notice to Tenant, including for planned renovations or sale of the property.',
      matchedRuleIds: ['rule-termination-1'],
      matchedRuleTitles: ['Asymmetric Termination Notice Periods'],
      questionsToAsk: [
        'Can termination notice periods be made mutual at 30 or 60 days for both parties?',
        'During the fixed 12-month term, can the landlord remove the "without cause" early termination right?',
      ],
      recommendation:
        'Ask for mutual notice parity (e.g., 30 or 60 days on both sides) and clarify that fixed-term leases cannot be terminated without cause mid-term.',
    },
    {
      id: 'sample-clause-4',
      category: 'Eviction & Entry',
      clauseTitle: 'Four-Hour Entry Notice & Smart-Lock Deactivation Without Cure Window',
      riskLevel: 'HIGH',
      plainEnglish:
        'The landlord can enter your apartment with only 4 hours text notice and can disable your smart lock if rent is 5 days late or for any alleged rule violation, without giving you time to fix the issue.',
      whyItMatters:
        'Four hours notice provides minimal privacy protection, and unilateral smart-lock deactivation clauses raise serious lockout and due-process concerns.',
      exactSourceText:
        'Landlord or Landlord\'s agents may enter the Premises at any time with 4 hours\' verbal or text notice for inspections, showings to prospective buyers, or maintenance. In the event of any alleged breach of house rules or late payment exceeding five (5) days, Landlord may deactivate smart-lock access credentials and initiate expedited summary repossession without prior cure period.',
      matchedRuleIds: ['rule-eviction-1'],
      matchedRuleTitles: ['Short Entry Notice or Self-Help Lockout Language'],
      questionsToAsk: [
        'Can non-emergency entry notice be updated to at least 24 or 48 hours written notice?',
        'Will you remove the smart-lock deactivation language and include a standard written cure notice before any default action?',
      ],
      recommendation:
        'Request 24–48 hours advance written notice for non-emergency entry and removal of any lock-deactivation / summary lockout language.',
    },
    {
      id: 'sample-clause-5',
      category: 'Maintenance & Repairs',
      clauseTitle: 'Tenant Responsible for System & Appliance Repairs Up to $500/Incident',
      riskLevel: 'MEDIUM',
      plainEnglish:
        'You accept the unit "as-is" and must pay up to $500 per incident for plumbing, HVAC, electrical, and appliance repairs—even when parts break simply from old age.',
      whyItMatters:
        'Shifting aging-system repairs (such as HVAC compressors or plumbing lines) onto tenants can result in repeated $500 bills for infrastructure you do not own.',
      exactSourceText:
        'Tenant accepts the Premises "as-is" and shall be solely responsible for all interior repairs, appliance servicing, plumbing blockages, HVAC filter and compressor maintenance, and electrical fixture replacements up to $500 per incident, even where wear arises from normal aging of building systems.',
      matchedRuleIds: ['rule-maintenance-1'],
      matchedRuleTitles: ['Major Appliance or System Repair Burden on Tenant'],
      questionsToAsk: [
        'Can normal wear-and-tear and major system failures (HVAC, plumbing, appliances) remain the landlord\'s responsibility?',
        'Can we complete a documented move-in inspection checklist before the "as-is" acceptance takes effect?',
      ],
      recommendation:
        'Limit tenant repair obligations strictly to damage caused by tenant negligence or minor consumables (lightbulbs/air filters), excluding aging building systems.',
    },
    {
      id: 'sample-clause-6',
      category: 'Penalties & Late Fees',
      clauseTitle: '$175 Flat Late Fee After 3 Days Plus $45/Day Compounding Charge',
      riskLevel: 'MEDIUM',
      plainEnglish:
        'If rent arrives after 5:00 PM on the 3rd, you owe $175 immediately plus $45 every day afterward—meaning a 10-day delay adds $490 in fees.',
      whyItMatters:
        'A short 3-day grace window paired with both a 7.1% flat fee and steep daily compounding charges escalates minor payment timing issues quickly.',
      exactSourceText:
        'Any rent payment received after 5:00 PM on the 3rd day of the month shall incur an immediate flat late fee of $175.00, plus an additional compounding charge of $45.00 per day for each subsequent day rent remains unpaid.',
      matchedRuleIds: ['rule-penalties-1'],
      matchedRuleTitles: ['Compounding Daily Late Fees & Short Grace Period'],
      questionsToAsk: [
        'Can the grace period be extended to the 5th of the month and the daily compounding charge removed?',
        'Is there a fee-free ACH payment portal option so bank processing delays do not trigger the $95 rejected-payment fee?',
      ],
      recommendation:
        'Ask for a 5-day grace period and a single capped late fee rather than open-ended daily compounding fees.',
    },
    {
      id: 'sample-clause-7',
      category: 'Renewal & Holdover',
      clauseTitle: 'Automatic 12-Month Renewal with 12% Escalation & 200% Holdover',
      riskLevel: 'MEDIUM',
      plainEnglish:
        'If you forget to send written notice at least 60 days before the lease ends, your lease automatically locks in for another full year at $2,744/month (12% higher). Staying past the end date costs double rent for the entire month.',
      whyItMatters:
        'Silent auto-renewal into another 12-month commitment with a 12% increase can trap tenants who expected month-to-month flexibility or a chance to negotiate renewal terms.',
      exactSourceText:
        'Unless Tenant delivers written non-renewal notice at least sixty (60) days prior to the expiration date, this Agreement shall automatically renew for an additional twelve (12) month term at a mandatory 12% Base Rent increase. If Tenant holds over past the expiration date without a signed renewal, Tenant shall owe holdover rent equal to 200% of the prior monthly Base Rent, calculated on a full-month basis even for partial-month occupancy.',
      matchedRuleIds: ['rule-renewal-1'],
      matchedRuleTitles: ['Automatic Annual Renewal with Steep Rent Escalation'],
      questionsToAsk: [
        'Can the lease default to month-to-month after the initial 12 months instead of auto-renewing for a full year?',
        'Can holdover rent be prorated daily rather than charged for a full month on partial occupancy?',
      ],
      recommendation:
        'Request converting automatic renewal to month-to-month unless both parties sign a renewal addendum, and prorate any holdover rent daily.',
    },
    {
      id: 'sample-clause-8',
      category: 'Utilities & Other Terms',
      clauseTitle: 'Mandatory $110/Month Internet Package & Overnight Guest Surcharge',
      riskLevel: 'LOW',
      plainEnglish:
        'You must pay $110/month for building internet in addition to all utilities, and any guest staying more than 3 consecutive nights requires written approval and a $35/night fee.',
      whyItMatters:
        'While less severe than deposit or eviction terms, mandatory utility bundles raise your true monthly housing cost to at least $2,560+ and strict guest surcharges may affect visiting family.',
      exactSourceText:
        'Tenant shall pay all electricity, gas, water, sewer, trash, and mandatory smart-building internet package fees ($110/month). Overnight guests staying longer than three (3) consecutive nights require Landlord\'s prior written approval and a $35/night guest surcharge.',
      matchedRuleIds: ['rule-utilities-1'],
      matchedRuleTitles: ['Mandatory Bundled Fees & Restrictive Guest Surcharges'],
      questionsToAsk: [
        'Can the overnight guest threshold be extended to 7–14 days per visit without a nightly surcharge for family?',
        'What internet speed and equipment are included in the mandatory $110/month package?',
      ],
      recommendation:
        'Factor the mandatory $110/month into your monthly budget and clarify guest exceptions for visiting family members.',
    },
    {
      id: 'sample-clause-9',
      category: 'Rent & Escalation',
      clauseTitle: 'Discretionary Mid-Lease Utility & Common-Area Assessment Adjustments',
      riskLevel: 'LOW',
      plainEnglish:
        'Base rent is $2,450/month on the 1st, but the landlord can raise utility surcharges and common-area fees mid-lease with 15 days written notice.',
      whyItMatters:
        'Open-ended "at Landlord\'s discretion" fee adjustments reduce monthly cost predictability during your fixed term.',
      exactSourceText:
        'Tenant agrees to pay monthly Base Rent of $2,450.00 due on or before the 1st day of each calendar month. Landlord reserves the right to adjust monthly utilities surcharges and common-area assessment fees at Landlord\'s discretion upon 15 days\' written notice.',
      matchedRuleIds: [],
      matchedRuleTitles: ['General Lease Review'],
      questionsToAsk: [
        'What are the current monthly common-area assessment fees, and can they be capped for the 12-month term?',
      ],
      recommendation:
        'Ask to list all recurring fees in writing and cap any mid-lease assessment adjustments to documented third-party utility rate changes.',
    },
  ],
};
