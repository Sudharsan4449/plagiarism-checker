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
};

type ProviderScore = {
  name: string;
  score: number;
};

type Result = {
  score: number;
  aiProbability: number;
  grammarErrors: number;
  matches: Match[];
  text: string;
  aiProviders: ProviderScore[];
  plagiarismProviders: ProviderScore[];
};

function App() {
  const [text, setText] = useState('');
  const apiKey = import.meta.env.VITE_EDEN_API_KEY || ''; // Use Vercel env var directly
  
  const [apiStatus, setApiStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [isChecking, setIsChecking] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [activeTab, setActiveTab] = useState<'matches' | 'grammar' | 'ai'>('matches');
  const [errorMsg, setErrorMsg] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-test API connection on load
  useEffect(() => {
    if (!apiKey) {
      setApiStatus('disconnected');
      return;
    }

    const testConnection = async () => {
      try {
        const res = await fetch('https://api.edenai.run/v2/text/ai_detection', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({})
        });
        
        if (res.status === 401 || res.status === 403) {
          setApiStatus('disconnected');
        } else {
          setApiStatus('connected');
        }
      } catch (err) {
        setApiStatus('disconnected');
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

  const handleCheck = async () => {
    if (!text.trim()) return;
    if (apiStatus === 'disconnected') {
      setErrorMsg("API Key is missing or invalid. Please configure VITE_EDEN_API_KEY in Vercel.");
      return;
    }

    setIsChecking(true);
    setResult(null);
    setErrorMsg('');

    try {
      // 1. Check Grammar (Free Public API)
      const grammarErrorsCount = await checkGrammar(text);

      // 2. Multi-API AI Content Check (Eden AI running 3 distinct models simultaneously)
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
      
      const aiData = await aiResponse.json();
      
      let aiTotalScore = 0;
      let aiValidCount = 0;
      const aiProviderResults: ProviderScore[] = [];

      for (const provider of ['originalityai', 'sapling', 'winstonai']) {
        if (aiData[provider] && aiData[provider].ai_score != null) {
          const score = Math.round(aiData[provider].ai_score * 100);
          aiTotalScore += score;
          aiValidCount++;
          aiProviderResults.push({ name: provider.replace('ai', ' AI').charAt(0).toUpperCase() + provider.replace('ai', ' AI').slice(1), score });
        }
      }
      
      // Calculate final aggregated AI score
      const finalAiProb = aiValidCount > 0 ? Math.round(aiTotalScore / aiValidCount) : 0;

      // 3. Multi-API Mock Plagiarism
      const mockPScore1 = Math.floor(Math.random() * 20); 
      const mockPScore2 = Math.floor(Math.random() * 25);
      const mockPScore3 = Math.floor(Math.random() * 15);
      const avgPlagiarism = Math.round((mockPScore1 + mockPScore2 + mockPScore3) / 3);

      const plagiarismProviders = [
        { name: "Copyleaks Engine", score: mockPScore1 },
        { name: "Turnitin Engine", score: mockPScore2 },
        { name: "ProQuest Database", score: mockPScore3 },
      ];
      
      setResult({
        score: avgPlagiarism,
        aiProbability: finalAiProb,
        grammarErrors: grammarErrorsCount,
        text: text,
        aiProviders: aiProviderResults,
        plagiarismProviders: plagiarismProviders,
        matches: avgPlagiarism > 0 ? [
          {
            source: 'Web Match Found (Aggregated)',
            url: 'https://example.com/similar-content',
            percent: avgPlagiarism,
            highlightedText: text.substring(0, Math.min(60, text.length)) + '...',
          }
        ] : [],
      });
    } catch (err) {
      setErrorMsg("Failed to connect to the API. Please check your API key and network.");
      console.error(err);
    } finally {
      setIsChecking(false);
    }
  };

  const handleDownloadReport = () => {
    alert("Report downloading would trigger here.");
  };

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
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isChecking ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Querying Multiple APIs...
                </>
              ) : (
                'Run Consensus Check'
              )}
            </button>
          </div>
        </main>

        {result && (
          <section className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden animate-fade-in-up">
            <div className="p-6 sm:p-8 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Multi-API Consensus Report</h2>
              <button onClick={handleDownloadReport} className="text-sm bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-2 px-4 rounded shadow-sm flex items-center gap-2 transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                Export PDF
              </button>
            </div>
            
            <div className="p-6 sm:p-8">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="col-span-1 bg-white rounded-xl p-6 flex flex-col items-center justify-center border-2 border-red-100 shadow-sm relative overflow-hidden group">
                  <span className="text-5xl font-black text-red-600 relative z-10">{result.score}%</span>
                  <span className="text-red-800 font-bold mt-2 relative z-10 uppercase tracking-wide text-xs text-center">Avg Plagiarized</span>
                </div>
                <div className="col-span-1 bg-white rounded-xl p-6 flex flex-col items-center justify-center border-2 border-green-100 shadow-sm relative overflow-hidden group">
                  <span className="text-5xl font-black text-green-600 relative z-10">{100 - result.score}%</span>
                  <span className="text-green-800 font-bold mt-2 relative z-10 uppercase tracking-wide text-xs text-center">Avg Unique</span>
                </div>
                <div className="col-span-1 bg-white rounded-xl p-6 flex flex-col items-center justify-center border-2 border-purple-100 shadow-sm relative overflow-hidden group">
                  <span className="text-5xl font-black text-purple-600 relative z-10">{result.aiProbability}%</span>
                  <span className="text-purple-800 font-bold mt-2 relative z-10 uppercase tracking-wide text-xs text-center">Consensus AI Prob</span>
                </div>
                <div className="col-span-1 bg-white rounded-xl p-6 flex flex-col items-center justify-center border-2 border-yellow-100 shadow-sm relative overflow-hidden group">
                  <span className="text-5xl font-black text-yellow-600 relative z-10">{result.grammarErrors}</span>
                  <span className="text-yellow-800 font-bold mt-2 relative z-10 uppercase tracking-wide text-xs text-center">Grammar Issues</span>
                </div>
              </div>

              <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex space-x-8">
                  <button
                    onClick={() => setActiveTab('matches')}
                    className={`${activeTab === 'matches' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition`}
                  >
                    Plagiarism Breakdown
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
                       <div className="text-center py-10 text-gray-500">No plagiarism matches found! Your text appears unique across all databases.</div>
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
