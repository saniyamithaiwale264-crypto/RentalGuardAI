import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import path from 'path';
import { PDFParse } from 'pdf-parse';
import { createServer as createViteServer } from 'vite';
import {
  addRuleToVersion,
  createRulebookVersion,
  deleteAnalysis,
  deleteRuleFromVersion,
  findAnalysisForAgreementAndVersion,
  getAnalyses,
  getAnalysisById,
  getRulebookById,
  getRulebooks,
  saveAnalysis,
  saveAnalysisTranslation,
  updateRuleInVersion,
} from './server/store.ts';
import {
  analyzeAgreementWithGemini,
  chatAboutAgreementWithGemini,
  computeVersionComparison,
  scanAgreementPagesWithGemini,
  synthesizeSpeechWithGemini,
  translateAnalysisWithGemini,
  translateUiStringsWithGemini,
} from './server/geminiService.ts';
import {
  SAMPLE_AGREEMENT_ID,
  SAMPLE_AGREEMENT_TEXT,
  SAMPLE_AGREEMENT_TITLE,
  SEED_SAMPLE_ANALYSIS,
} from './server/seedData.ts';
import type { ExtractedDocumentResponse } from './src/types/rental.ts';

const PORT = Number(process.env.PORT) || 3000;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
});

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'RentalGuard AI' });
  });

  // Dashboard summary
  app.get('/api/dashboard', (_req, res) => {
    const analyses = getAnalyses();
    const rulebooks = getRulebooks();

    const totals = analyses.reduce(
      (acc, item) => {
        acc.high += item.riskCounts.high;
        acc.medium += item.riskCounts.medium;
        acc.low += item.riskCounts.low;
        return acc;
      },
      { high: 0, medium: 0, low: 0 }
    );

    res.json({
      totalAgreementsAnalyzed: analyses.length,
      riskTotals: totals,
      analyses,
      rulebooks,
    });
  });

  // Demo agreement + sample analysis
  app.get('/api/demo', (_req, res) => {
    res.json({
      agreementId: SAMPLE_AGREEMENT_ID,
      title: SAMPLE_AGREEMENT_TITLE,
      fileName: 'sample-oakridge-lease-2026.txt',
      text: SAMPLE_AGREEMENT_TEXT,
      sampleAnalysis: SEED_SAMPLE_ANALYSIS,
    });
  });

  // Extract text from uploaded PDF or TXT file
  app.post('/api/agreements/extract', upload.single('file'), async (req, res) => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: 'No file was uploaded. Please choose a PDF or TXT document.' });
        return;
      }

      const lowerName = file.originalname.toLowerCase();
      const isPdf = lowerName.endsWith('.pdf') || file.mimetype === 'application/pdf';
      const isTxt = lowerName.endsWith('.txt') || file.mimetype.startsWith('text/plain');

      if (!isPdf && !isTxt) {
        res.status(400).json({
          error: 'Unsupported file format. RentalGuard AI currently supports PDF (.pdf) and plain text (.txt) files.',
        });
        return;
      }

      if (isTxt) {
        const text = file.buffer.toString('utf-8').replace(/\r\n/g, '\n').trim();
        const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0;

        if (text.length < 30) {
          const payload: ExtractedDocumentResponse = {
            fileName: file.originalname,
            sourceType: 'txt',
            extractedText: text,
            characterCount: text.length,
            wordCount,
            isScannedOrUnreadable: true,
            warningMessage:
              'The uploaded text file contains very little readable content. Verify the file or paste the agreement text manually.',
          };
          res.json(payload);
          return;
        }

        const payload: ExtractedDocumentResponse = {
          fileName: file.originalname,
          sourceType: 'txt',
          extractedText: text,
          characterCount: text.length,
          wordCount,
          isScannedOrUnreadable: false,
        };
        res.json(payload);
        return;
      }

      // PDF extraction using pdf-parse v2
      let parser: PDFParse | null = null;
      try {
        parser = new PDFParse({ data: file.buffer });
        const parsed = await parser.getText();
        const rawText = (parsed.text || '')
          .replace(/^--\s*\d+\s+of\s+\d+\s*--$/gm, '')
          .replace(/\r\n/g, '\n')
          .replace(/[ \t]+\n/g, '\n')
          .replace(/\n{3,}/g, '\n\n')
          .trim();

        const wordCount = rawText ? rawText.split(/\s+/).filter(Boolean).length : 0;
        const totalPages = parsed.total || 1;
        const looksScanned = rawText.length < 60 || wordCount < 12;

        const payload: ExtractedDocumentResponse = {
          fileName: file.originalname,
          sourceType: 'pdf',
          extractedText: rawText,
          pageCount: totalPages,
          characterCount: rawText.length,
          wordCount,
          isScannedOrUnreadable: looksScanned,
          warningMessage: looksScanned
            ? `This PDF (${totalPages} page${totalPages === 1 ? '' : 's'}) appears to be a scanned image or lacks a selectable text layer. Paste the agreement text below or upload a text-based PDF/TXT file.`
            : undefined,
        };
        res.json(payload);
      } catch (pdfErr) {
        const msg = pdfErr instanceof Error ? pdfErr.message : 'PDF parsing error';
        res.status(422).json({
          error: `Unable to read this PDF file (${msg}). It may be password-protected, corrupted, or a scanned image PDF without embedded text.`,
          isScannedOrUnreadable: true,
        });
      } finally {
        if (parser) {
          await parser.destroy().catch(() => undefined);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unexpected extraction error';
      res.status(500).json({ error: msg });
    }
  });

  // Smart Agreement Scanner: AI Vision OCR for camera photos, images, and scanned PDFs
  app.post('/api/agreements/scan', upload.array('files', 6), async (req, res) => {
    try {
      const uploaded = (req.files as Express.Multer.File[]) || [];
      if (uploaded.length === 0) {
        res.status(400).json({
          error: 'Please upload or capture at least one lease photo (PNG/JPG/WEBP) or scanned PDF.',
        });
        return;
      }

      const supportedFiles: Array<{ buffer: Buffer; mimeType: string; fileName: string }> = [];
      for (const file of uploaded) {
        const lower = file.originalname.toLowerCase();
        let mimeType = file.mimetype;
        if (!mimeType || mimeType === 'application/octet-stream') {
          if (lower.endsWith('.png')) mimeType = 'image/png';
          else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) mimeType = 'image/jpeg';
          else if (lower.endsWith('.webp')) mimeType = 'image/webp';
          else if (lower.endsWith('.pdf')) mimeType = 'application/pdf';
        }
        const allowed = new Set([
          'image/png',
          'image/jpeg',
          'image/jpg',
          'image/webp',
          'application/pdf',
        ]);
        if (!allowed.has(mimeType)) {
          res.status(400).json({
            error: `Unsupported scan file "${file.originalname}". Upload PNG, JPG, WEBP images or PDF files.`,
          });
          return;
        }
        supportedFiles.push({
          buffer: file.buffer,
          mimeType: mimeType === 'image/jpg' ? 'image/jpeg' : mimeType,
          fileName: file.originalname,
        });
      }

      const scan = await scanAgreementPagesWithGemini(supportedFiles);
      const wordCount = scan.extractedText.split(/\s+/).filter(Boolean).length;

      res.json({
        fileName:
          supportedFiles.length === 1
            ? supportedFiles[0].fileName
            : `${supportedFiles.length}-scanned-pages.pdf`,
        sourceType: supportedFiles[0].mimeType === 'application/pdf' ? 'pdf' : 'pasted',
        pageCount: supportedFiles.length,
        characterCount: scan.extractedText.length,
        wordCount,
        extractedText: scan.extractedText,
        detectedLanguage: scan.detectedLanguage,
        suggestedTitle: scan.suggestedTitle,
        scanQualityNote: scan.scanQualityNote,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Smart scanner failed to read document';
      const status = msg.includes('GEMINI_API_KEY') ? 503 : 500;
      res.status(status).json({ error: msg });
    }
  });

  // Analyze rental agreement using Gemini on the server
  app.post('/api/analyze', async (req, res) => {
    try {
      const {
        agreementId,
        title,
        text,
        fileName,
        sourceType,
        isDemo,
        pageCount,
        rulebookVersionId,
        language,
      } = req.body as {
        agreementId?: string;
        title?: string;
        text?: string;
        fileName?: string;
        sourceType?: 'pdf' | 'txt' | 'pasted' | 'demo';
        isDemo?: boolean;
        pageCount?: number;
        rulebookVersionId?: string;
        language?: string;
      };

      const cleanedText = (text || '').trim();
      if (cleanedText.length < 50) {
        res.status(400).json({
          error: 'Agreement text is too short to analyze. Please provide at least 50 characters of lease text.',
        });
        return;
      }

      const rulebooks = getRulebooks();
      const targetRulebook =
        (rulebookVersionId ? getRulebookById(rulebookVersionId) : undefined) || rulebooks[0];

      if (!targetRulebook) {
        res.status(400).json({ error: 'No active rulebook version found.' });
        return;
      }

      const enabledCount = targetRulebook.rules.filter((r) => r.enabled).length;
      if (enabledCount === 0) {
        res.status(400).json({
          error: `Rulebook ${targetRulebook.versionLabel} has no enabled rules. Enable at least one rule before running analysis.`,
        });
        return;
      }

      const resolvedAgreementId =
        agreementId || `agr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      const analysis = await analyzeAgreementWithGemini({
        agreementId: resolvedAgreementId,
        title: (title || fileName || 'Untitled Rental Agreement').trim(),
        fileName: (fileName || 'pasted-agreement.txt').trim(),
        sourceType: sourceType || 'pasted',
        isDemo: Boolean(isDemo),
        extractedText: cleanedText,
        pageCount,
        rulebook: targetRulebook,
        language,
      });

      saveAnalysis(analysis);
      res.json(analysis);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to analyze agreement';
      const status = msg.includes('GEMINI_API_KEY') ? 503 : 500;
      res.status(status).json({ error: msg });
    }
  });

  // List & inspect analyses
  app.get('/api/analyses', (_req, res) => {
    res.json(getAnalyses());
  });

  app.get('/api/analyses/:id', (req, res) => {
    const analysis = getAnalysisById(req.params.id);
    if (!analysis) {
      res.status(404).json({ error: 'Analysis not found.' });
      return;
    }
    res.json(analysis);
  });

  app.delete('/api/analyses/:id', (req, res) => {
    const removed = deleteAnalysis(req.params.id);
    if (!removed) {
      res.status(404).json({ error: 'Analysis not found.' });
      return;
    }
    res.json({ deleted: true });
  });

  // Rulebook & version management
  app.get('/api/rulebooks', (_req, res) => {
    res.json(getRulebooks());
  });

  app.post('/api/rulebooks/versions', (req, res) => {
    const { versionLabel, name, description, cloneFromVersionId } = req.body as {
      versionLabel?: string;
      name?: string;
      description?: string;
      cloneFromVersionId?: string;
    };

    if (!versionLabel?.trim() || !name?.trim()) {
      res.status(400).json({ error: 'Version label (e.g., v1.2) and name are required.' });
      return;
    }

    const created = createRulebookVersion({
      versionLabel,
      name,
      description: description || 'Custom tenant review rulebook version.',
      cloneFromVersionId,
    });
    res.status(201).json(created);
  });

  app.post('/api/rulebooks/versions/:id/rules', (req, res) => {
    const {
      title,
      category,
      description,
      jurisdiction,
      sourceReference,
      severityHint,
      verificationStatus,
      enabled,
    } = req.body;

    if (!title?.trim() || !description?.trim()) {
      res.status(400).json({ error: 'Rule title and description are required.' });
      return;
    }

    const updated = addRuleToVersion(req.params.id, {
      title: title.trim(),
      category: category || 'Utilities & Other Terms',
      description: description.trim(),
      jurisdiction: (jurisdiction || 'General / Illustrative').trim(),
      sourceReference: (
        sourceReference || 'Illustrative user-defined rule — verify local applicability'
      ).trim(),
      severityHint: severityHint === 'HIGH' || severityHint === 'LOW' ? severityHint : 'MEDIUM',
      verificationStatus:
        verificationStatus === 'VERIFIED_REFERENCE' ? 'VERIFIED_REFERENCE' : 'ILLUSTRATIVE',
      enabled: enabled !== false,
    });

    if (!updated) {
      res.status(404).json({ error: 'Rulebook version not found.' });
      return;
    }
    res.status(201).json(updated);
  });

  app.put('/api/rulebooks/versions/:id/rules/:ruleId', (req, res) => {
    const updated = updateRuleInVersion(req.params.id, req.params.ruleId, req.body);
    if (!updated) {
      res.status(404).json({ error: 'Rulebook version or rule not found.' });
      return;
    }
    res.json(updated);
  });

  app.delete('/api/rulebooks/versions/:id/rules/:ruleId', (req, res) => {
    const updated = deleteRuleFromVersion(req.params.id, req.params.ruleId);
    if (!updated) {
      res.status(404).json({ error: 'Rulebook version not found.' });
      return;
    }
    res.json(updated);
  });

  // Rulebook Version Comparison: reanalyze same agreement against target rulebook version & diff
  app.post('/api/compare', async (req, res) => {
    try {
      const { baselineAnalysisId, targetRulebookVersionId, forceReanalyze } = req.body as {
        baselineAnalysisId?: string;
        targetRulebookVersionId?: string;
        forceReanalyze?: boolean;
      };

      if (!baselineAnalysisId || !targetRulebookVersionId) {
        res.status(400).json({
          error: 'Both baselineAnalysisId and targetRulebookVersionId are required.',
        });
        return;
      }

      const baseline = getAnalysisById(baselineAnalysisId);
      if (!baseline) {
        res.status(404).json({ error: 'Baseline analysis not found.' });
        return;
      }

      const targetRulebook = getRulebookById(targetRulebookVersionId);
      if (!targetRulebook) {
        res.status(404).json({ error: 'Target rulebook version not found.' });
        return;
      }

      let updated = !forceReanalyze
        ? findAnalysisForAgreementAndVersion(baseline.agreementId, targetRulebook.id)
        : undefined;

      if (!updated) {
        updated = await analyzeAgreementWithGemini({
          agreementId: baseline.agreementId,
          title: baseline.title,
          fileName: baseline.fileName,
          sourceType: baseline.sourceType,
          isDemo: baseline.isDemo,
          extractedText: baseline.extractedText,
          pageCount: baseline.pageCount,
          rulebook: targetRulebook,
        });
        saveAnalysis(updated);
      }

      const comparison = computeVersionComparison(baseline, updated);
      res.json(comparison);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to compare rulebook versions';
      const status = msg.includes('GEMINI_API_KEY') ? 503 : 500;
      res.status(status).json({ error: msg });
    }
  });

  // Translate an existing analysis report into any target language
  app.post('/api/analyses/:id/translate', async (req, res) => {
    try {
      const { targetLanguage } = req.body as { targetLanguage?: string };
      const cleanLang = (targetLanguage || '').trim();
      if (!cleanLang) {
        res.status(400).json({ error: 'targetLanguage is required.' });
        return;
      }

      const analysis = getAnalysisById(req.params.id);
      if (!analysis) {
        res.status(404).json({ error: 'Analysis not found.' });
        return;
      }

      const cached = analysis.translations?.[cleanLang];
      if (cached) {
        res.json({ analysis, translation: cached });
        return;
      }

      const translation = await translateAnalysisWithGemini({
        analysis,
        targetLanguage: cleanLang,
      });

      const updated = saveAnalysisTranslation(analysis.id, cleanLang, translation) || analysis;
      res.json({ analysis: updated, translation });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to translate analysis report';
      const status = msg.includes('GEMINI_API_KEY') ? 503 : 500;
      res.status(status).json({ error: msg });
    }
  });

  // Translate UI strings dynamically for any language in the world
  app.post('/api/translate-ui', async (req, res) => {
    try {
      const { targetLanguage, strings } = req.body as {
        targetLanguage?: string;
        strings?: Record<string, string>;
      };
      const cleanLang = (targetLanguage || '').trim();
      if (!cleanLang || !strings || typeof strings !== 'object') {
        res.status(400).json({ error: 'targetLanguage and strings are required.' });
        return;
      }

      const translations = await translateUiStringsWithGemini({
        targetLanguage: cleanLang,
        strings,
      });
      res.json({ translations });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to translate UI strings';
      const status = msg.includes('GEMINI_API_KEY') ? 503 : 500;
      res.status(status).json({ error: msg });
    }
  });

  // Text-to-Speech synthesis using Gemini on the server
  app.post('/api/tts', async (req, res) => {
    try {
      const { text, language, voiceName } = req.body as {
        text?: string;
        language?: string;
        voiceName?: string;
      };
      const cleanText = (text || '').trim();
      if (!cleanText) {
        res.status(400).json({ error: 'Text is required for Read Aloud audio.' });
        return;
      }

      const audio = await synthesizeSpeechWithGemini({
        text: cleanText,
        language,
        voiceName,
      });
      res.json(audio);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to synthesize speech';
      const status = msg.includes('GEMINI_API_KEY') ? 503 : 500;
      res.status(status).json({ error: msg });
    }
  });

  // Grounded AI Chat Assistant endpoint
  app.post('/api/chat', async (req, res) => {
    try {
      const { analysisId, message, history, language } = req.body as {
        analysisId?: string;
        message?: string;
        history?: Array<{ role: 'user' | 'assistant'; content: string }>;
        language?: string;
      };

      const trimmedMessage = (message || '').trim();
      if (!analysisId || !trimmedMessage) {
        res.status(400).json({ error: 'Both analysisId and a question message are required.' });
        return;
      }

      const analysis = getAnalysisById(analysisId);
      if (!analysis) {
        res.status(404).json({ error: 'Selected agreement analysis was not found.' });
        return;
      }

      const reply = await chatAboutAgreementWithGemini({
        analysis,
        message: trimmedMessage,
        history: Array.isArray(history) ? history : [],
        language,
      });

      res.json(reply);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to answer question';
      const status = msg.includes('GEMINI_API_KEY') ? 503 : 500;
      res.status(status).json({ error: msg });
    }
  });

  // Ensure API errors (including Multer upload size/type errors & malformed JSON) return JSON
  app.use(
    (
      err: unknown,
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      if (!req.path.startsWith('/api')) {
        next(err);
        return;
      }
      if (err instanceof multer.MulterError) {
        const msg =
          err.code === 'LIMIT_FILE_SIZE'
            ? 'File exceeds the 10 MB upload limit.'
            : err.message;
        res.status(400).json({ error: msg });
        return;
      }
      const msg = err instanceof Error ? err.message : 'Unexpected server error';
      res.status(500).json({ error: msg });
    }
  );

  // Serve frontend (Vite middleware in development, static dist in production)
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`RentalGuard AI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
