import React, { useState } from 'react';

type Match = {
  source: string;
  url: string;
  percent: number;
  highlightedText: string;
};

type Result = {
  score: number;
  aiProbability: number;
  grammarErrors: number;
  matches: Match[];
  text: string;
};

function App() {
  const [text, setText] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [activeTab, setActiveTab] = useState<'matches' | 'grammar' | 'ai'>('matches');

  const handleCheck = () => {
    if (!text.trim()) return;
    setIsChecking(true);
    setResult(null);

    // Mocking an advanced API call for premium features
    setTimeout(() => {
      setResult({
        score: 24,
        aiProbability: 12, // 12% AI generated
        grammarErrors: 3,
        text: text,
        matches: [
          {
            source: 'Wikipedia - Artificial Intelligence',
            url: 'https://en.wikipedia.org/wiki/Artificial_intelligence',
            percent: 18,
            highlightedText: text.substring(0, Math.min(50, text.length)) + '...',
          },
          {
            source: 'Example Tech Blog',
            url: 'https://example.com/blog/ai-future',
            percent: 6,
            highlightedText: text.substring(Math.min(50, text.length), Math.min(100, text.length)) + '...',
          },
        ],
      });
      setIsChecking(false);
    }, 2500);
  };

  const handleDownloadReport = () => {
    alert("Downloading detailed PDF report... (This is a mock action)");
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
          <span className="bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
            Premium Trial
          </span>
        </header>

        <main className="bg-white rounded-xl shadow-md p-6 sm:p-8 mb-8 border border-gray-100">
          <div className="mb-6">
            <div className="flex justify-between items-end mb-2">
              <label htmlFor="content" className="block text-sm font-semibold text-gray-700">
                Text to Analyze
              </label>
              <div className="text-xs text-gray-500 font-medium">
                Deep Search Engine V2.0
              </div>
            </div>
            <textarea
              id="content"
              rows={8}
              className="w-full border border-gray-200 bg-gray-50 rounded-lg p-4 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-gray-800 shadow-inner"
              placeholder="Paste your text here or drop a file to check for plagiarism, AI-generated content, and grammar issues..."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-4">
                <button className="text-sm text-gray-600 hover:text-blue-600 font-medium flex items-center gap-1 transition">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
                  Upload File
                </button>
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
                  Analyzing Document...
                </>
              ) : (
                'Deep Check Plagiarism'
              )}
            </button>
          </div>
        </main>

        {result && (
          <section className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden animate-fade-in-up">
            <div className="p-6 sm:p-8 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Analysis Report</h2>
              <button onClick={handleDownloadReport} className="text-sm bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-2 px-4 rounded shadow-sm flex items-center gap-2 transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                Export PDF
              </button>
            </div>
            
            <div className="p-6 sm:p-8">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="col-span-1 bg-white rounded-xl p-6 flex flex-col items-center justify-center border-2 border-red-100 shadow-sm relative overflow-hidden group">
                  <div className="absolute inset-0 bg-red-50 opacity-0 group-hover:opacity-100 transition duration-300"></div>
                  <span className="text-5xl font-black text-red-600 relative z-10">{result.score}%</span>
                  <span className="text-red-800 font-bold mt-2 relative z-10 uppercase tracking-wide text-xs">Plagiarized</span>
                </div>
                <div className="col-span-1 bg-white rounded-xl p-6 flex flex-col items-center justify-center border-2 border-green-100 shadow-sm relative overflow-hidden group">
                  <div className="absolute inset-0 bg-green-50 opacity-0 group-hover:opacity-100 transition duration-300"></div>
                  <span className="text-5xl font-black text-green-600 relative z-10">{100 - result.score}%</span>
                  <span className="text-green-800 font-bold mt-2 relative z-10 uppercase tracking-wide text-xs">Unique</span>
                </div>
                <div className="col-span-1 bg-white rounded-xl p-6 flex flex-col items-center justify-center border-2 border-purple-100 shadow-sm relative overflow-hidden group">
                  <div className="absolute inset-0 bg-purple-50 opacity-0 group-hover:opacity-100 transition duration-300"></div>
                  <span className="text-5xl font-black text-purple-600 relative z-10">{result.aiProbability}%</span>
                  <span className="text-purple-800 font-bold mt-2 relative z-10 uppercase tracking-wide text-xs">AI Probability</span>
                </div>
                <div className="col-span-1 bg-white rounded-xl p-6 flex flex-col items-center justify-center border-2 border-yellow-100 shadow-sm relative overflow-hidden group">
                  <div className="absolute inset-0 bg-yellow-50 opacity-0 group-hover:opacity-100 transition duration-300"></div>
                  <span className="text-5xl font-black text-yellow-600 relative z-10">{result.grammarErrors}</span>
                  <span className="text-yellow-800 font-bold mt-2 relative z-10 uppercase tracking-wide text-xs">Grammar Issues</span>
                </div>
              </div>

              <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex space-x-8">
                  <button
                    onClick={() => setActiveTab('matches')}
                    className={`${activeTab === 'matches' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition`}
                  >
                    Matched Sources
                  </button>
                  <button
                    onClick={() => setActiveTab('grammar')}
                    className={`${activeTab === 'grammar' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition`}
                  >
                    Writing Enhancements
                  </button>
                  <button
                    onClick={() => setActiveTab('ai')}
                    className={`${activeTab === 'ai' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition`}
                  >
                    AI Detection Details
                  </button>
                </nav>
              </div>

              <div className="min-h-[200px]">
                {activeTab === 'matches' && (
                  <div className="space-y-5">
                    {result.matches.map((match, idx) => (
                      <div key={idx} className="bg-gray-50 border border-gray-200 rounded-xl p-5 hover:shadow-md transition">
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
                        <div className="bg-white p-4 rounded-lg border border-gray-100 text-gray-600 text-sm italic relative">
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-400 rounded-l-lg"></div>
                          "...{match.highlightedText}..."
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'grammar' && (
                  <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                    <svg className="w-12 h-12 text-yellow-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                    <h3 className="text-lg font-bold text-gray-800">Grammar & Style Check</h3>
                    <p className="text-gray-500 max-w-md mx-auto mt-2">We found {result.grammarErrors} minor issues. Connect a premium account to see detailed suggestions and rewrite options.</p>
                  </div>
                )}

                {activeTab === 'ai' && (
                  <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                    <svg className="w-12 h-12 text-purple-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                    <h3 className="text-lg font-bold text-gray-800">AI Content Detection</h3>
                    <p className="text-gray-500 max-w-md mx-auto mt-2">This text is {result.aiProbability}% likely to be generated by AI models like ChatGPT or Claude.</p>
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
