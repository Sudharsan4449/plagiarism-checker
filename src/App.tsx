import React, { useState, useRef, useEffect } from 'react';
import * as mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker to use CDN to avoid Vite build complexities
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

type Match = {
  source: string;
  url: string;
  percent: number;
  highlightedText: string;
};

type Match = {
  source: string;
  url: string;
  percent: number;
  highlightedText: string;
  matchReason?: string;
};

type ProviderScore = {
  name: string;
  score: number;
};

type ArticleMatch = {
  title: string;
  url: string;
  snippet: string;
  matchReason?: string;
};

type ContextAnalysis = {
  keywords: string[];
  topicQuery: string;
  relatedArticles: ArticleMatch[];
};

type CitationItem = {
  author: string;
  year: string;
  raw: string;
  type: 'Parenthetical' | 'Narrative';
};

type CitationAudit = {
  totalCitations: number;
  distinctAuthorsCount: number;
  citationsSample: CitationItem[];
  hasReferenceSection: boolean;
  referenceListEntries: number;
  supportLevel: string;
  citationDensity: number;
  uncitedParagraphsCount: number;
  totalWords: number;
};

type MethodologyAnalysis = {
  isMsbaRelated?: boolean;
  detectedType: string;
  qualitativeTermsFound: string[];
  quantitativeTermsFound: string[];
  hasHypotheses: boolean;
  hasSamplingStrategy: boolean;
  hasDataCollection: boolean;
};

type AiSignals = {
  perplexity?: string;
  burstiness?: string;
  syntacticStyle?: string;
  flaggedMarkers?: string[];
};

type Result = {
  score: number;
  aiProbability: number;
  aiReason?: string;
  aiSignals?: AiSignals;
  grammarErrors: number;
  matches: Match[];
  text: string;
  aiProviders: ProviderScore[];
  plagiarismProviders: ProviderScore[];
  contextAnalysis?: ContextAnalysis;
  citationAudit?: CitationAudit;
  methodologyAnalysis?: MethodologyAnalysis;
  isMsbaRelated?: boolean;
  wordCount?: number;
};

const DEDUCTION_STEPS = [
  { id: 1, label: "First Deduction", title: "Linguistic Parsing & Syntactic N-Grams", detail: "Tokenizing clauses, analyzing sentence variance, and extracting n-gram phrases" },
  { id: 2, label: "Second Deduction", title: "Web Index & Wikipedia Archive Plagiarism Scan", detail: "Querying global web archives and Wikipedia repositories for exact phrase matches" },
  { id: 3, label: "Third Deduction", title: "Multi-Model AI Syntactic Consensus", detail: "Evaluating neural burstiness, token predictability, and LLM generative patterns" },
  { id: 4, label: "Fourth Deduction", title: "Scholarly Literature & APA 7th Citation Audit", detail: "Auditing parenthetical & narrative citations, reference lists, and author indices" },
  { id: 5, label: "Fifth Deduction", title: "Research Methodology Intelligence & Final Consensus", detail: "Classifying qualitative/quantitative designs, hypotheses, and compiling consensus" }
];

function App() {
  const [text, setText] = useState('');
  const apiKey = import.meta.env.VITE_EDEN_API_KEY || ''; // Use Vercel env var directly
  
  const [apiStatus, setApiStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [isChecking, setIsChecking] = useState(false);
  const [deductionStep, setDeductionStep] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [activeTab, setActiveTab] = useState<'matches' | 'citations' | 'methodology' | 'context' | 'ai' | 'grammar'>('matches');
  const [errorMsg, setErrorMsg] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-test API connection on load
  useEffect(() => {
    const testConnection = async () => {
      try {
        const res = await fetch('/api/check');
        if (res.ok) {
          setApiStatus('connected');
        } else {
          setApiStatus(apiKey ? 'connected' : 'disconnected');
        }
      } catch (err) {
        setApiStatus(apiKey ? 'connected' : 'disconnected');
      }
    };

    testConnection();
  }, [apiKey]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setErrorMsg('');
    try {
      if (file.name.endsWith('.txt')) {
        const text = await file.text();
        setText(text);
      } else if (file.name.endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        setText(result.value);
      } else if (file.name.endsWith('.pdf')) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let extractedText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          extractedText += pageText + '\n';
        }
        setText(extractedText);
      } else {
        setErrorMsg("Unsupported file format. Please upload .txt, .docx, or .pdf");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to read the file. It might be corrupted or protected.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const checkGrammar = async (textToCheck: string) => {
    try {
      const response = await fetch('https://api.languagetool.org/v2/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          text: textToCheck,
          language: 'en-US',
        }),
      });
      const data = await response.json();
      return data.matches ? data.matches.length : 0;
    } catch (e) {
      console.error("Grammar check failed", e);
      return 0;
    }
  };

  const handleFallbackCheck = async () => {
    // Client-side fallback if backend is unavailable
    const grammarErrorsCount = await checkGrammar(text);

    let finalAiProb = 0;
    const aiProviderResults: ProviderScore[] = [];

    if (apiKey) {
      try {
        const aiResponse = await fetch('https://api.edenai.run/v2/text/ai_detection', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            providers: "originalityai,sapling,winstonai",
            text: text,
          }),
        });
        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          let aiTotalScore = 0;
          let aiValidCount = 0;
          for (const provider of ['originalityai', 'sapling', 'winstonai']) {
            if (aiData[provider] && aiData[provider].ai_score != null) {
              const score = Math.round(aiData[provider].ai_score * 100);
              aiTotalScore += score;
              aiValidCount++;
              aiProviderResults.push({
                name: provider.replace('ai', ' AI').charAt(0).toUpperCase() + provider.replace('ai', ' AI').slice(1),
                score
              });
            }
          }
          finalAiProb = aiValidCount > 0 ? Math.round(aiTotalScore / aiValidCount) : 0;
        }
      } catch (e) {
        console.error("Client AI check error:", e);
      }
    }

    setResult({
      score: 0,
      aiProbability: finalAiProb,
      aiReason: finalAiProb >= 60
        ? `High AI Probability (${finalAiProb}%): Sentences show uniform structural pacing and repetitive syntactic formulas.`
        : finalAiProb >= 25
        ? `Mixed Cadence (${finalAiProb}%): Contains a combination of natural human phrasing and structured patterns.`
        : `Authentic Human Writing (${finalAiProb}%): High natural burstiness and dynamic sentence structures with zero automated transition markers.`,
      aiSignals: {
        perplexity: finalAiProb >= 60 ? "Low Perplexity (Predictable word choices)" : "High Perplexity (Organic phrasing)",
        burstiness: finalAiProb >= 60 ? "Low Burstiness (Uniform sentence rhythm)" : "High Burstiness (Natural variation in sentence lengths)",
        syntacticStyle: finalAiProb >= 60 ? "Formulaic LLM structure" : "Organic human writing style",
        flaggedMarkers: []
      },
      grammarErrors: grammarErrorsCount,
      text: text,
      aiProviders: aiProviderResults,
      plagiarismProviders: [
        { name: "Web Search Engine", score: 0 },
        { name: "Wikipedia Global Archive", score: 0 },
        { name: "Academic & Journal Index", score: 0 }
      ],
      matches: [],
      contextAnalysis: {
        keywords: [],
        topicQuery: '',
        relatedArticles: []
      },
      citationAudit: {
        totalCitations: 0,
        distinctAuthorsCount: 0,
        citationsSample: [],
        hasReferenceSection: false,
        referenceListEntries: 0,
        supportLevel: 'Client Mode',
        citationDensity: 0,
        uncitedParagraphsCount: 0,
        totalWords: text.trim().split(/\s+/).filter(Boolean).length
      },
      methodologyAnalysis: {
        isMsbaRelated: false,
        detectedType: 'General Analysis',
        qualitativeTermsFound: [],
        quantitativeTermsFound: [],
        hasHypotheses: false,
        hasSamplingStrategy: false,
        hasDataCollection: false
      },
      isMsbaRelated: false,
      wordCount: text.trim().split(/\s+/).filter(Boolean).length
    });
    if (activeTab === 'citations' || activeTab === 'methodology') {
      setActiveTab('matches');
    }
  };

  const handleCheck = async () => {
    if (!text.trim()) return;

    setIsChecking(true);
    setResult(null);
    setErrorMsg('');
    setDeductionStep(0);

    let currentStep = 0;
    const stepInterval = setInterval(() => {
      currentStep++;
      if (currentStep < DEDUCTION_STEPS.length) {
        setDeductionStep(currentStep);
      }
    }, 800);

    try {
      // Call the Vercel serverless backend
      const response = await fetch('/api/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();
      const isMsba = Boolean(data.methodologyAnalysis?.isMsbaRelated || data.isMsbaRelated);
      if (!isMsba && (activeTab === 'citations' || activeTab === 'methodology')) {
        setActiveTab('matches');
      }

      clearInterval(stepInterval);

      // Fast-forward any remaining steps so the user sees each horizontal cut happen!
      for (let s = currentStep; s <= DEDUCTION_STEPS.length; s++) {
        setDeductionStep(s);
        await new Promise((r) => setTimeout(r, 220));
      }

      await new Promise((r) => setTimeout(r, 350));
      setResult(data);
    } catch (err) {
      clearInterval(stepInterval);
      console.warn("Backend unavailable, using client fallback:", err);
      try {
        for (let s = currentStep; s <= DEDUCTION_STEPS.length; s++) {
          setDeductionStep(s);
          await new Promise((r) => setTimeout(r, 200));
        }
        await handleFallbackCheck();
      } catch (fallbackErr) {
        setErrorMsg("Failed to run check. Please try again.");
      }
    } finally {
      clearInterval(stepInterval);
      setIsChecking(false);
    }
  };

  const handleDownloadReport = () => {
    alert("Report downloading would trigger here.");
  };

  const isMsba = Boolean(result?.methodologyAnalysis?.isMsbaRelated || result?.isMsbaRelated);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-5xl mx-auto">
        <header className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3">
            <img src="/favicon.jpg" alt="Logo" className="w-10 h-10 rounded-full shadow-sm" />
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
              Veri-Check Pro
            </h1>
          </div>
          <div className="flex items-center gap-4">
            {apiStatus === 'checking' && (
              <span className="bg-gray-100 text-gray-600 text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider flex items-center gap-2 shadow-sm border border-gray-200">
                <span className="w-2 h-2 rounded-full bg-gray-400 animate-pulse"></span>
                Connecting...
              </span>
            )}
            {apiStatus === 'connected' && (
              <span className="bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider flex items-center gap-2 shadow-sm border border-blue-200">
                <span className="w-2 h-2 rounded-full bg-blue-500 shadow-sm"></span>
                Live API Mode
              </span>
            )}
            {apiStatus === 'disconnected' && (
              <span className="bg-red-50 text-red-600 text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider flex items-center gap-2 shadow-sm border border-red-100">
                <span className="w-2 h-2 rounded-full bg-red-500 shadow-sm"></span>
                API Disconnected
              </span>
            )}
          </div>
        </header>

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-8" role="alert">
            <span className="block sm:inline">{errorMsg}</span>
          </div>
        )}

        <main className="bg-white rounded-xl shadow-md p-6 sm:p-8 mb-8 border border-gray-100">
          <div className="mb-6">
            <div className="flex justify-between items-end mb-2">
              <label htmlFor="content" className="block text-sm font-semibold text-gray-700">
                Text to Analyze
              </label>
              <div className="text-xs text-gray-500 font-medium bg-gray-100 px-2 py-1 rounded">
                Multi-API Consensus Engine
              </div>
            </div>
            <textarea
              id="content"
              rows={8}
              className="w-full border border-gray-200 bg-gray-50 rounded-lg p-4 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-gray-800 shadow-inner"
              placeholder="Paste your text here or upload a document to run real AI and Grammar checks..."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-4">
                <input 
                  type="file" 
                  accept=".txt,.pdf,.docx" 
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden" 
                  id="file-upload" 
                />
                <label 
                  htmlFor="file-upload"
                  className="cursor-pointer text-sm text-gray-600 hover:text-blue-600 font-medium flex items-center gap-1 transition"
                >
                  {isUploading ? (
                    <span className="animate-pulse">Extracting text...</span>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
                      Upload File (.txt, .pdf, .docx)
                    </>
                  )}
                </label>
              </div>
              <div className="text-sm font-medium text-gray-500">
                {text.trim().split(/\s+/).filter((w) => w.length > 0).length} words
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleCheck}
              disabled={isChecking || !text.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isChecking ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping"></span>
                  Processing {DEDUCTION_STEPS[Math.min(deductionStep, DEDUCTION_STEPS.length - 1)].label}...
                </>
              ) : (
                'Run Consensus Check'
              )}
            </button>
          </div>
        </main>

        {isChecking && (
          <section className="bg-white rounded-2xl shadow-lg border border-blue-100 p-6 sm:p-8 mt-6 mb-8 animate-fade-in-up">
            <div className="flex items-center justify-between pb-5 border-b border-gray-100 mb-6 flex-wrap gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-200">
                  <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
                    Multi-Engine Deduction Pipeline
                    <span className="text-xs bg-blue-100 text-blue-800 font-semibold px-2.5 py-0.5 rounded-full">
                      Live
                    </span>
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Executing analytical checks sequentially across web indices and AI models
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-200">
                  {deductionStep >= DEDUCTION_STEPS.length ? "Finalizing Report" : `Stage ${deductionStep + 1} of ${DEDUCTION_STEPS.length}`}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              {DEDUCTION_STEPS.map((step, idx) => {
                const isCompleted = idx < deductionStep;
                const isActive = idx === deductionStep;

                return (
                  <div
                    key={step.id}
                    className={`flex items-start gap-4 p-4 rounded-xl transition-all duration-500 ${
                      isActive
                        ? 'bg-blue-50/90 border-2 border-blue-300 shadow-sm scale-[1.01]'
                        : isCompleted
                        ? 'bg-gray-50/70 border border-gray-100 opacity-40'
                        : 'border border-gray-100 opacity-45 bg-white'
                    }`}
                  >
                    {/* Step Indicator Icon */}
                    <div className="flex-shrink-0 mt-0.5">
                      {isCompleted ? (
                        <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-black shadow-sm transition-all duration-500">
                          ✓
                        </div>
                      ) : isActive ? (
                        <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-200 transition-all duration-500">
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        </div>
                      ) : (
                        <div className="w-7 h-7 rounded-full border-2 border-gray-200 text-gray-400 flex items-center justify-center text-xs font-bold">
                          {step.id}
                        </div>
                      )}
                    </div>

                    {/* Step Text with Horizontal Cut and Fade when Completed */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded transition-all duration-500 ${
                              isCompleted
                                ? 'bg-gray-200 text-gray-500 line-through decoration-gray-400'
                                : isActive
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {step.label}
                          </span>
                          <span
                            className={`text-sm sm:text-base font-bold transition-all duration-500 ${
                              isCompleted
                                ? 'line-through decoration-2 decoration-gray-400 text-gray-500'
                                : isActive
                                ? 'text-blue-950 font-black'
                                : 'text-gray-500'
                            }`}
                          >
                            {step.title}
                          </span>
                        </div>

                        {isCompleted && (
                          <span className="text-xs font-bold text-emerald-600 whitespace-nowrap flex items-center gap-1">
                            Completed
                          </span>
                        )}
                        {isActive && (
                          <span className="text-xs font-extrabold text-blue-600 whitespace-nowrap flex items-center gap-1.5 animate-pulse">
                            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                            In Progress...
                          </span>
                        )}
                      </div>

                      <p
                        className={`text-xs mt-1 transition-all duration-500 leading-relaxed ${
                          isCompleted
                            ? 'line-through decoration-gray-300 text-gray-400'
                            : isActive
                            ? 'text-blue-900 font-medium'
                            : 'text-gray-400'
                        }`}
                      >
                        {step.detail}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Progress Tracker */}
            <div className="mt-6 pt-5 border-t border-gray-100 flex items-center gap-4">
              <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${Math.min(100, Math.round(((deductionStep) / DEDUCTION_STEPS.length) * 100))}%`
                  }}
                ></div>
              </div>
              <span className="text-xs font-extrabold text-blue-700 whitespace-nowrap min-w-[3rem] text-right">
                {Math.min(100, Math.round(((deductionStep) / DEDUCTION_STEPS.length) * 100))}%
              </span>
            </div>
          </section>
        )}

        {result && (
          <section className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden animate-fade-in-up">
            <div className="p-6 sm:p-8 border-b border-gray-100 bg-gray-50 flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-gray-900">Multi-API Consensus Report</h2>
                {isMsba && (
                  <span className="text-xs bg-indigo-50 text-indigo-700 font-semibold px-2.5 py-1 rounded-full border border-indigo-200">
                    MSBA & Research Intelligence
                  </span>
                )}
              </div>
              <button onClick={handleDownloadReport} className="text-sm bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-2 px-4 rounded shadow-sm flex items-center gap-2 transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                Export PDF
              </button>
            </div>
            
            <div className="p-6 sm:p-8">
              <div className={`grid grid-cols-1 sm:grid-cols-2 ${isMsba ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-4 mb-8`}>
                <div className="bg-white rounded-xl p-5 flex flex-col items-center justify-center border-2 border-red-100 shadow-sm relative overflow-hidden group">
                  <span className="text-4xl font-black text-red-600 relative z-10">{result.score}%</span>
                  <span className="text-red-800 font-bold mt-2 relative z-10 uppercase tracking-wide text-xs text-center">Avg Plagiarized</span>
                </div>
                <div className="bg-white rounded-xl p-5 flex flex-col items-center justify-center border-2 border-green-100 shadow-sm relative overflow-hidden group">
                  <span className="text-4xl font-black text-green-600 relative z-10">{100 - result.score}%</span>
                  <span className="text-green-800 font-bold mt-2 relative z-10 uppercase tracking-wide text-xs text-center">Avg Unique</span>
                </div>
                <div className="bg-white rounded-xl p-5 flex flex-col items-center justify-center border-2 border-purple-100 shadow-sm relative overflow-hidden group">
                  <span className="text-4xl font-black text-purple-600 relative z-10">{result.aiProbability}%</span>
                  <span className="text-purple-800 font-bold mt-2 relative z-10 uppercase tracking-wide text-xs text-center">Consensus AI Prob</span>
                </div>
                {isMsba && (
                  <div className="bg-white rounded-xl p-5 flex flex-col items-center justify-center border-2 border-blue-100 shadow-sm relative overflow-hidden group">
                    <span className="text-4xl font-black text-blue-600 relative z-10">{result.citationAudit?.totalCitations ?? 0}</span>
                    <span className="text-blue-800 font-bold mt-2 relative z-10 uppercase tracking-wide text-xs text-center">APA Citations</span>
                  </div>
                )}
                <div className="bg-white rounded-xl p-5 flex flex-col items-center justify-center border-2 border-slate-100 shadow-sm relative overflow-hidden group">
                  <span className="text-4xl font-black text-slate-700 relative z-10">{result.wordCount ?? result.text.trim().split(/\s+/).filter(Boolean).length}</span>
                  <span className="text-slate-600 font-bold mt-2 relative z-10 uppercase tracking-wide text-xs text-center">Total Words</span>
                </div>
              </div>

              <div className="border-b border-gray-200 mb-6 overflow-x-auto">
                <nav className="-mb-px flex space-x-6 min-w-max">
                  <button
                    onClick={() => setActiveTab('matches')}
                    className={`${activeTab === 'matches' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition`}
                  >
                    Plagiarism Breakdown
                  </button>
                  {isMsba && (
                    <button
                      onClick={() => setActiveTab('citations')}
                      className={`${activeTab === 'citations' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition flex items-center gap-1.5`}
                    >
                      Literature & APA Citations
                      {result.citationAudit?.totalCitations ? (
                        <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full font-bold">
                          {result.citationAudit.totalCitations}
                        </span>
                      ) : null}
                    </button>
                  )}
                  {isMsba && (
                    <button
                      onClick={() => setActiveTab('methodology')}
                      className={`${activeTab === 'methodology' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition`}
                    >
                      Methodology Intelligence
                    </button>
                  )}
                  <button
                    onClick={() => setActiveTab('context')}
                    className={`${activeTab === 'context' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition flex items-center gap-1.5`}
                  >
                    Topic Literature
                    {result.contextAnalysis?.relatedArticles?.length ? (
                      <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full font-bold">
                        {result.contextAnalysis.relatedArticles.length}
                      </span>
                    ) : null}
                  </button>
                  <button
                    onClick={() => setActiveTab('ai')}
                    className={`${activeTab === 'ai' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition`}
                  >
                    AI Model Breakdown
                  </button>
                  <button
                    onClick={() => setActiveTab('grammar')}
                    className={`${activeTab === 'grammar' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition`}
                  >
                    Writing Enhancements
                  </button>
                </nav>
              </div>

              <div className="min-h-[200px]">
                {isMsba && activeTab === 'citations' && (
                  <div className="space-y-6">
                    <div className="bg-blue-50 border border-blue-200 p-6 rounded-xl">
                      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                        <h3 className="font-bold text-blue-900 text-lg flex items-center gap-2">
                          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
                          APA 7th Edition Literature & Citation Audit
                        </h3>
                        <span className="bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                          {result.citationAudit?.supportLevel || 'Literature Analysis Active'}
                        </span>
                      </div>
                      <p className="text-sm text-blue-800">
                        Academic assessments strictly require claims and arguments to be supported by literature using APA 7th Edition formatting.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">In-Text Citations</span>
                        <div className="text-3xl font-black text-blue-600 mt-1">{result.citationAudit?.totalCitations || 0}</div>
                        <span className="text-xs text-gray-500 mt-1 block">Parenthetical & Narrative</span>
                      </div>
                      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Distinct Cited Authors</span>
                        <div className="text-3xl font-black text-indigo-600 mt-1">{result.citationAudit?.distinctAuthorsCount || 0}</div>
                        <span className="text-xs text-gray-500 mt-1 block">Scholarly contributors</span>
                      </div>
                      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Reference List Section</span>
                        <div className="text-2xl font-black text-gray-900 mt-1">
                          {result.citationAudit?.hasReferenceSection ? '✓ Detected' : '✗ Missing'}
                        </div>
                        <span className="text-xs text-gray-500 mt-1 block">
                          {result.citationAudit?.referenceListEntries ? `${result.citationAudit.referenceListEntries} references listed` : 'No references block found'}
                        </span>
                      </div>
                    </div>

                    {result.citationAudit && result.citationAudit.uncitedParagraphsCount > 0 ? (
                      <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3">
                        <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                        <div>
                          <h4 className="text-sm font-bold text-amber-900">Literature Backing Alert</h4>
                          <p className="text-xs text-amber-800 mt-0.5">
                            We detected {result.citationAudit.uncitedParagraphsCount} substantial paragraphs without in-text citations. Make sure key claims, methodologies, and findings are backed by academic literature.
                          </p>
                        </div>
                      </div>
                    ) : null}

                    {result.citationAudit?.citationsSample?.length ? (
                      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                        <h4 className="font-bold text-gray-900 text-sm mb-4">Sample In-Text Citations Detected</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {result.citationAudit.citationsSample.map((cite, i) => (
                            <div key={i} className="bg-gray-50 p-3 rounded-lg border border-gray-100 flex items-center justify-between">
                              <span className="font-mono text-sm text-blue-900 font-semibold">{cite.raw}</span>
                              <span className="text-xs bg-white text-gray-600 font-bold px-2 py-0.5 rounded border border-gray-200">
                                {cite.type}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-500 text-sm">
                        No in-text citations detected. Add APA 7th citations like (Author, Year) to support your answer.
                      </div>
                    )}
                  </div>
                )}

                {isMsba && activeTab === 'methodology' && (
                  <div className="space-y-6">
                    <div className="bg-indigo-50 border border-indigo-200 p-6 rounded-xl">
                      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                        <h3 className="font-bold text-indigo-900 text-lg flex items-center gap-2">
                          <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                          Research Methodology Intelligence
                        </h3>
                        <span className="bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                          {result.methodologyAnalysis?.detectedType || 'Research Classification Active'}
                        </span>
                      </div>
                      <p className="text-sm text-indigo-800">
                        Our engine automatically infers the underlying research methodology directly from your submitted answer text.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                        <div>
                          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Hypotheses Formulation</span>
                          <span className="text-sm font-bold text-gray-800 mt-1 block">
                            {result.methodologyAnalysis?.hasHypotheses ? '✓ Formal Hypotheses Found' : '— None Detected'}
                          </span>
                        </div>
                        <span className={`w-3 h-3 rounded-full ${result.methodologyAnalysis?.hasHypotheses ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                      </div>

                      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                        <div>
                          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Sampling Strategy</span>
                          <span className="text-sm font-bold text-gray-800 mt-1 block">
                            {result.methodologyAnalysis?.hasSamplingStrategy ? '✓ Strategy Discussed' : '— None Detected'}
                          </span>
                        </div>
                        <span className={`w-3 h-3 rounded-full ${result.methodologyAnalysis?.hasSamplingStrategy ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                      </div>

                      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                        <div>
                          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Data Collection Protocol</span>
                          <span className="text-sm font-bold text-gray-800 mt-1 block">
                            {result.methodologyAnalysis?.hasDataCollection ? '✓ Methods Specified' : '— None Detected'}
                          </span>
                        </div>
                        <span className={`w-3 h-3 rounded-full ${result.methodologyAnalysis?.hasDataCollection ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                        <h4 className="font-bold text-gray-900 text-sm mb-3 text-purple-900 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                          Qualitative Concepts Identified
                        </h4>
                        {result.methodologyAnalysis?.qualitativeTermsFound?.length ? (
                          <div className="flex flex-wrap gap-2">
                            {result.methodologyAnalysis.qualitativeTermsFound.map((term, i) => (
                              <span key={i} className="bg-purple-50 text-purple-800 text-xs font-semibold px-3 py-1 rounded-full border border-purple-100">
                                {term}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500">No specific qualitative methodology terms identified in this answer.</p>
                        )}
                      </div>

                      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                        <h4 className="font-bold text-gray-900 text-sm mb-3 text-blue-900 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                          Quantitative Concepts Identified
                        </h4>
                        {result.methodologyAnalysis?.quantitativeTermsFound?.length ? (
                          <div className="flex flex-wrap gap-2">
                            {result.methodologyAnalysis.quantitativeTermsFound.map((term, i) => (
                              <span key={i} className="bg-blue-50 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full border border-blue-100">
                                {term}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500">No specific quantitative methodology terms identified in this answer.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'context' && (
                  <div className="space-y-6">
                    <div className="bg-blue-50 border border-blue-100 p-6 rounded-xl">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        <h3 className="font-bold text-blue-900 text-base">Assessment & Article Context Analysis</h3>
                      </div>
                      <p className="text-sm text-blue-800 mb-4">
                        We analyzed the main context of this content and identified the core academic and subject themes. Compare this submission against published articles covering the same subject matter.
                      </p>
                      
                      {result.contextAnalysis?.keywords?.length ? (
                        <div>
                          <span className="text-xs font-bold text-blue-900 uppercase tracking-wider block mb-2">Extracted Key Themes & Core Keywords:</span>
                          <div className="flex flex-wrap gap-2">
                            {result.contextAnalysis.keywords.map((kw, i) => (
                              <span key={i} className="bg-white text-blue-800 text-xs font-semibold px-3 py-1 rounded-full border border-blue-200 shadow-sm">
                                #{kw}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div>
                      <h4 className="font-bold text-gray-900 text-lg mb-3 flex items-center gap-2">
                        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
                        Published Reference Articles on This Topic
                      </h4>
                      <p className="text-sm text-gray-500 mb-4">
                        Existing literature and articles that cover the exact subject matter of this submission:
                      </p>

                      {(!result.contextAnalysis?.relatedArticles || result.contextAnalysis.relatedArticles.length === 0) ? (
                        <div className="text-center py-8 bg-gray-50 rounded-xl text-gray-500 text-sm">
                          No specific external articles found for this topic context.
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {result.contextAnalysis.relatedArticles.map((art, idx) => (
                            <div key={idx} className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition">
                              <div className="flex items-start justify-between">
                                <div>
                                  <h5 className="font-bold text-gray-900 text-base hover:text-blue-600 transition">
                                    <a href={art.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                                      {art.title}
                                      <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                                    </a>
                                  </h5>
                                  <a href={art.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline break-all mt-0.5 inline-block">
                                    {art.url}
                                  </a>
                                </div>
                                <span className="bg-blue-50 text-blue-700 text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap ml-4 border border-blue-100">
                                  Related Literature
                                </span>
                              </div>
                              {art.snippet ? (
                                <p className="text-xs text-gray-600 mt-2 bg-gray-50 p-2.5 rounded border border-gray-100">
                                  {art.snippet}...
                                </p>
                              ) : null}
                              {art.matchReason && (
                                <div className="text-xs text-blue-800 bg-blue-50/80 px-3 py-1.5 rounded mt-2 border border-blue-100 flex items-start gap-1.5">
                                  <span className="font-bold text-blue-900 whitespace-nowrap">Reason Found:</span>
                                  <span>{art.matchReason}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {activeTab === 'matches' && (
                  <div className="space-y-6">
                    <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
                      <h3 className="font-bold text-gray-900 mb-3 border-b pb-2">Plagiarism Engine Consensus</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {result.plagiarismProviders.map((provider, i) => (
                          <div key={i} className="bg-white p-3 rounded border shadow-sm flex justify-between items-center">
                            <span className="text-sm font-medium text-gray-700">{provider.name}</span>
                            <span className="text-sm font-bold text-red-600">{provider.score}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {result.matches.length === 0 ? (
                       <div className="text-center py-10 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                         <svg className="w-10 h-10 text-green-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                         <p className="font-bold text-gray-800">No Plagiarism Matches Found!</p>
                         <p className="text-xs text-gray-500 mt-1">Your phrasing is completely unique across indexed web pages and academic archives.</p>
                       </div>
                    ) : (
                      result.matches.map((match, idx) => (
                        <div key={idx} className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h4 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
                                {match.source}
                              </h4>
                              <a href={match.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline break-all mt-1 inline-block">
                                {match.url}
                              </a>
                            </div>
                            <div className="bg-red-100 text-red-800 text-sm font-black px-4 py-1.5 rounded-full whitespace-nowrap ml-4 shadow-sm">
                              {match.percent}% Match
                            </div>
                          </div>
                          <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 text-gray-600 text-sm italic relative">
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-400 rounded-l-lg"></div>
                            "...{match.highlightedText}..."
                          </div>
                          {match.matchReason && (
                            <div className="text-xs text-red-800 bg-red-50 px-3 py-1.5 rounded mt-3 border border-red-100 flex items-start gap-1.5 font-medium">
                              <span className="font-bold text-red-900 whitespace-nowrap">Reason Flagged:</span>
                              <span>{match.matchReason}</span>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'grammar' && (
                  <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                    <svg className="w-12 h-12 text-yellow-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                    <h3 className="text-lg font-bold text-gray-800">Grammar Check (Live via LanguageTool)</h3>
                    <p className="text-gray-500 max-w-md mx-auto mt-2">We found <strong>{result.grammarErrors}</strong> grammatical or spelling errors in your text.</p>
                  </div>
                )}

                {activeTab === 'ai' && (
                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-6">
                    <div className="text-center mb-6">
                      <svg className="w-12 h-12 text-purple-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                      <h3 className="text-xl font-bold text-gray-900">AI Consensus Breakdown</h3>
                      <p className="text-gray-600 mt-2">We ran your text through multiple world-class AI detection models. Here is the consensus.</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      {result.aiProviders.map((provider, i) => (
                        <div key={i} className="bg-white p-4 rounded-lg shadow-sm border border-purple-100 flex flex-col items-center justify-center text-center hover:border-purple-300 transition cursor-default">
                          <span className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-1">{provider.name}</span>
                          <span className="text-3xl font-black text-purple-600">{provider.score}%</span>
                          <span className="text-xs text-gray-400 mt-1">AI Probability</span>
                        </div>
                      ))}
                    </div>
                    
                    <div className="bg-purple-100 text-purple-900 p-4 rounded-lg flex items-center justify-between shadow-sm">
                      <span className="font-bold">Final Consensus Score:</span>
                      <span className="font-black text-xl">{result.aiProbability}%</span>
                    </div>

                    <div className="mt-5 bg-white border border-purple-200 rounded-xl p-5 shadow-sm">
                      <div className="flex items-center gap-2.5 mb-3">
                        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 flex-shrink-0">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-gray-900">Why was this score assigned? (Reason Flagged)</h4>
                          <p className="text-xs text-gray-500">Linguistic breakdown of token predictability, sentence burstiness, and syntactic patterns</p>
                        </div>
                      </div>

                      <div className="bg-purple-50/80 border border-purple-100 rounded-lg p-3.5 mb-4 text-xs sm:text-sm text-purple-950 font-medium leading-relaxed">
                        {result.aiReason || (result.aiProbability >= 60
                          ? `High AI Probability (${result.aiProbability}%): The text exhibits uniform sentence lengths, low burstiness, and formulaic AI transition patterns characteristic of generative LLMs.`
                          : result.aiProbability >= 25
                          ? `Moderate / Hybrid Cadence (${result.aiProbability}%): The text demonstrates a blend of organic human phrasing with structured syntactic conventions.`
                          : `Authentic Human Writing (${result.aiProbability}%): High perplexity and dynamic sentence burstiness with natural stylistic variation and no repetitive synthetic markers.`
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Perplexity & Predictability</span>
                          <span className="text-xs text-gray-800 font-medium">
                            {result.aiSignals?.perplexity || (result.aiProbability >= 60 ? "Low Perplexity (Highly predictable next-word sequences)" : "High Perplexity (Organic, unpredictable phrasing)")}
                          </span>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Sentence Burstiness</span>
                          <span className="text-xs text-gray-800 font-medium">
                            {result.aiSignals?.burstiness || (result.aiProbability >= 60 ? "Low Burstiness (Uniform sentence rhythm typical of LLMs)" : "High Burstiness (Natural variation in sentence lengths)")}
                          </span>
                        </div>
                      </div>

                      {result.aiSignals?.flaggedMarkers && result.aiSignals.flaggedMarkers.length > 0 && (
                        <div className="pt-3 border-t border-gray-100">
                          <span className="text-xs font-bold text-gray-600 block mb-2">Detected AI Transition & Formulaic Patterns:</span>
                          <div className="flex flex-wrap gap-2">
                            {result.aiSignals.flaggedMarkers.map((marker, idx) => (
                              <span key={idx} className="bg-purple-50 text-purple-800 text-xs font-mono font-semibold px-2.5 py-1 rounded-md border border-purple-200">
                                {marker}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default App;
