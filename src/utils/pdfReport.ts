import { jsPDF } from 'jspdf';
import type { AgreementAnalysis } from '../types/rental.ts';
import { computeRiskScore, getRiskScoreBand } from './riskScore.ts';

function sanitizeFileName(title: string): string {
  return (title || 'rental-agreement')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function hasNonLatin1(text: string): boolean {
  return /[^\u0000-\u00ff]/.test(text);
}

function printUnicodeReport(analysis: AgreementAnalysis): void {
  const score =
    typeof analysis.riskScore === 'number'
      ? analysis.riskScore
      : computeRiskScore(analysis.riskCounts);
  const band = getRiskScoreBand(score);
  const actions =
    analysis.recommendedActions && analysis.recommendedActions.length > 0
      ? analysis.recommendedActions
      : analysis.clauses
          .filter((c) => c.riskLevel === 'HIGH' || c.riskLevel === 'MEDIUM')
          .slice(0, 5)
          .map((c) => c.recommendation)
          .filter(Boolean);

  const printHost = document.createElement('div');
  printHost.id = 'rentalguard-unicode-print';
  printHost.style.position = 'fixed';
  printHost.style.inset = '0';
  printHost.style.zIndex = '99999';
  printHost.style.background = '#ffffff';
  printHost.style.color = '#0f172a';
  printHost.style.padding = '32px';
  printHost.style.overflow = 'auto';
  printHost.style.fontFamily = 'system-ui, -apple-system, sans-serif';

  printHost.innerHTML = `
    <style>
      @media print {
        body > *:not(#rentalguard-unicode-print) { display: none !important; }
        #rentalguard-unicode-print { position: static !important; padding: 0 !important; }
      }
    </style>
    <div style="max-width:760px;margin:0 auto;">
      <div style="border-bottom:2px solid #7c3aed;padding-bottom:12px;margin-bottom:16px;">
        <h1 style="margin:0;font-size:22px;">RentalGuard AI — ${escapeHtml(analysis.title)}</h1>
        <p style="margin:6px 0 0;font-size:12px;color:#475569;">
          ${escapeHtml(analysis.language || 'English')} · ${escapeHtml(analysis.rulebookVersionLabel)} · ${escapeHtml(analysis.fileName)}
        </p>
      </div>
      <p style="background:#f5f3ff;border:1px solid #ddd6fe;padding:10px 12px;border-radius:6px;font-size:12px;color:#4c1d95;">
        ${escapeHtml(analysis.informationalDisclaimer)}
      </p>
      <p style="font-size:14px;font-weight:700;margin:14px 0;">
        Risk Score: ${score}/100 (${escapeHtml(band.label)}) — High: ${analysis.riskCounts.high}, Medium: ${analysis.riskCounts.medium}, Low: ${analysis.riskCounts.low}
      </p>
      <h2 style="font-size:15px;margin-top:18px;">Executive Summary</h2>
      <p style="font-size:13px;line-height:1.55;">${escapeHtml(analysis.executiveSummary)}</p>
      ${
        actions.length > 0
          ? `<h2 style="font-size:15px;margin-top:18px;">Recommended Actions</h2><ol style="font-size:13px;line-height:1.5;">${actions
              .map((a) => `<li>${escapeHtml(a)}</li>`)
              .join('')}</ol>`
          : ''
      }
      <h2 style="font-size:15px;margin-top:20px;">Clause Findings (${analysis.clauses.length})</h2>
      ${analysis.clauses
        .map(
          (c, i) => `
        <div style="border-top:1px solid #e2e8f0;padding:12px 0;">
          <div style="font-weight:700;font-size:13px;">[${c.riskLevel}] ${i + 1}. ${escapeHtml(c.clauseTitle)} (${escapeHtml(c.category)})</div>
          <p style="font-size:12.5px;margin:6px 0;">${escapeHtml(c.plainEnglish)}</p>
          <p style="font-size:12.5px;margin:6px 0;color:#334155;">${escapeHtml(c.whyItMatters)}</p>
          <blockquote style="background:#f8fafc;border-left:3px solid #cbd5e1;padding:6px 10px;margin:6px 0;font-family:monospace;font-size:11.5px;">“${escapeHtml(c.exactSourceText)}”</blockquote>
          <p style="font-size:12px;margin:4px 0;"><strong>Questions:</strong> ${c.questionsToAsk.map(escapeHtml).join(' | ')}</p>
          <p style="font-size:12px;margin:4px 0;color:#5b21b6;"><strong>Recommendation:</strong> ${escapeHtml(c.recommendation)}</p>
        </div>`
        )
        .join('')}
    </div>
  `;

  document.body.appendChild(printHost);
  const cleanup = () => {
    printHost.remove();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
  setTimeout(() => {
    if (document.body.contains(printHost)) {
      printHost.remove();
    }
  }, 1500);
}

export function generateAgreementPdfReport(analysis: AgreementAnalysis): void {
  const combinedSample = [
    analysis.title,
    analysis.executiveSummary,
    analysis.clauses.map((c) => c.plainEnglish + c.clauseTitle).join(' '),
  ].join(' ');

  if (hasNonLatin1(combinedSample)) {
    printUnicodeReport(analysis);
    return;
  }

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 44;
  const maxWidth = pageWidth - margin * 2;
  let y = 48;

  const score =
    typeof analysis.riskScore === 'number'
      ? analysis.riskScore
      : computeRiskScore(analysis.riskCounts);
  const band = getRiskScoreBand(score);

  const ensureSpace = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - 54) {
      doc.addPage();
      y = 48;
    }
  };

  const addWrappedText = (
    text: string,
    x: number,
    width: number,
    lineHeight: number,
    fontSize: number,
    color: [number, number, number] = [39, 39, 42],
    fontStyle: 'normal' | 'bold' = 'normal'
  ) => {
    doc.setFont('helvetica', fontStyle);
    doc.setFontSize(fontSize);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(text || '', width) as string[];
    for (const line of lines) {
      ensureSpace(lineHeight + 4);
      doc.text(line, x, y);
      y += lineHeight;
    }
  };

  // Header Banner
  doc.setFillColor(18, 14, 34);
  doc.rect(0, 0, pageWidth, 88, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(255, 255, 255);
  doc.text('RentalGuard AI — Lease Risk Report', margin, 36);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(196, 181, 253);
  doc.text(
    `Understand Before You Sign · ${
      analysis.isSampleResult ? 'Sample Demo Data' : 'AI Clause Analysis'
    } · Rulebook ${analysis.rulebookVersionLabel}`,
    margin,
    56
  );

  doc.setFontSize(9);
  doc.setTextColor(161, 161, 170);
  doc.text(
    `File: ${analysis.fileName} · Analyzed: ${new Date(analysis.analyzedAt).toLocaleDateString()}`,
    margin,
    72
  );

  y = 112;

  // Agreement Title
  addWrappedText(analysis.title, margin, maxWidth, 18, 14, [15, 23, 42], 'bold');
  y += 6;

  // Disclaimer Box
  const disclaimerText = `Informational Assistance Only (Not Legal Advice): ${analysis.informationalDisclaimer}`;
  const discLines = doc.splitTextToSize(disclaimerText, maxWidth - 20) as string[];
  const discHeight = discLines.length * 12 + 16;
  ensureSpace(discHeight);
  doc.setFillColor(245, 243, 255);
  doc.setDrawColor(196, 181, 253);
  doc.roundedRect(margin, y, maxWidth, discHeight, 4, 4, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(76, 29, 149);
  doc.text(discLines, margin + 10, y + 14);
  y += discHeight + 14;

  // Smart Risk Score & Counts Strip
  ensureSpace(64);
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, maxWidth, 56, 4, 4, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text('OVERALL RISK SCORE', margin + 14, y + 20);

  doc.setFontSize(18);
  const scoreColor: [number, number, number] =
    band.tone === 'high' ? [220, 38, 38] : band.tone === 'medium' ? [234, 88, 12] : [22, 163, 74];
  doc.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2]);
  doc.text(`${score} / 100`, margin + 14, y + 42);

  doc.setFontSize(10);
  doc.text(band.label, margin + 110, y + 41);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(220, 38, 38);
  doc.text(`High: ${analysis.riskCounts.high}`, margin + 295, y + 34);
  doc.setTextColor(234, 88, 12);
  doc.text(`Medium: ${analysis.riskCounts.medium}`, margin + 365, y + 34);
  doc.setTextColor(22, 163, 74);
  doc.text(`Low: ${analysis.riskCounts.low}`, margin + 448, y + 34);

  y += 74;

  // Executive Summary
  addWrappedText('Executive Summary', margin, maxWidth, 15, 12, [15, 23, 42], 'bold');
  y += 2;
  addWrappedText(analysis.executiveSummary, margin, maxWidth, 14, 10, [51, 65, 85], 'normal');
  y += 10;

  // Key Lease Terms
  addWrappedText('Key Extracted Terms', margin, maxWidth, 15, 12, [15, 23, 42], 'bold');
  y += 2;
  const terms: Array<[string, string]> = [
    ['Monthly Rent', analysis.keyTerms.monthlyRent],
    ['Security Deposit', analysis.keyTerms.securityDeposit],
    ['Lease Duration', analysis.keyTerms.leaseDuration],
    ['Lock-in Period', analysis.keyTerms.lockInPeriod],
    ['Notice Period', analysis.keyTerms.noticePeriod],
    ['Late Fee Policy', analysis.keyTerms.lateFeePolicy],
  ];
  for (const [k, v] of terms) {
    addWrappedText(`${k}: ${v}`, margin + 8, maxWidth - 8, 13, 9.5, [51, 65, 85], 'normal');
  }
  y += 10;

  // Recommended Actions
  const actions =
    analysis.recommendedActions && analysis.recommendedActions.length > 0
      ? analysis.recommendedActions
      : analysis.clauses
          .filter((c) => c.riskLevel === 'HIGH' || c.riskLevel === 'MEDIUM')
          .slice(0, 5)
          .map((c) => c.recommendation)
          .filter(Boolean);

  if (actions.length > 0) {
    addWrappedText('Recommended Tenant Actions', margin, maxWidth, 15, 12, [15, 23, 42], 'bold');
    y += 2;
    actions.forEach((act, idx) => {
      addWrappedText(`${idx + 1}. ${act}`, margin + 8, maxWidth - 8, 13, 9.5, [51, 65, 85], 'normal');
    });
    y += 12;
  }

  // Flagged Clauses
  addWrappedText(
    `Clause-by-Clause Findings (${analysis.clauses.length})`,
    margin,
    maxWidth,
    16,
    12.5,
    [15, 23, 42],
    'bold'
  );
  y += 6;

  analysis.clauses.forEach((clause, idx) => {
    ensureSpace(120);

    // Divider line
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, pageWidth - margin, y);
    y += 14;

    const badgeColor: [number, number, number] =
      clause.riskLevel === 'HIGH'
        ? [220, 38, 38]
        : clause.riskLevel === 'MEDIUM'
        ? [234, 88, 12]
        : [22, 163, 74];

    addWrappedText(
      `[${clause.riskLevel} RISK]  ${idx + 1}. ${clause.clauseTitle} (${clause.category})`,
      margin,
      maxWidth,
      14,
      10.5,
      badgeColor,
      'bold'
    );
    y += 2;

    addWrappedText('In Simple English:', margin, maxWidth, 12, 9.5, [15, 23, 42], 'bold');
    addWrappedText(clause.plainEnglish, margin + 8, maxWidth - 8, 13, 9.5, [51, 65, 85], 'normal');
    y += 3;

    addWrappedText('Why This Deserves Attention:', margin, maxWidth, 12, 9.5, [15, 23, 42], 'bold');
    addWrappedText(clause.whyItMatters, margin + 8, maxWidth - 8, 13, 9.5, [51, 65, 85], 'normal');
    y += 3;

    addWrappedText('Exact Source Clause Evidence:', margin, maxWidth, 12, 9.5, [15, 23, 42], 'bold');
    addWrappedText(
      `"${clause.exactSourceText}"`,
      margin + 10,
      maxWidth - 14,
      12,
      8.5,
      [71, 85, 105],
      'normal'
    );
    y += 4;

    if (clause.questionsToAsk.length > 0) {
      addWrappedText('Questions to Ask Landlord:', margin, maxWidth, 12, 9.5, [15, 23, 42], 'bold');
      clause.questionsToAsk.forEach((q) => {
        addWrappedText(`- ${q}`, margin + 8, maxWidth - 8, 12.5, 9, [51, 65, 85], 'normal');
      });
    }

    if (clause.recommendation) {
      addWrappedText(
        `Recommendation: ${clause.recommendation}`,
        margin,
        maxWidth,
        12.5,
        9,
        [88, 28, 135],
        'normal'
      );
    }
    y += 8;
  });

  // Footer on every page
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 130);
    doc.text(
      'RentalGuard AI — Informational review only, not legal advice.',
      margin,
      pageHeight - 24
    );
    doc.text(`Page ${p} of ${totalPages}`, pageWidth - margin - 52, pageHeight - 24);
  }

  const filename = `RentalGuard-Report-${sanitizeFileName(analysis.title)}.pdf`;
  doc.save(filename);
}
