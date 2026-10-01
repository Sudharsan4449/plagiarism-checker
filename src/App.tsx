import React, { useState } from 'react';

type Match = {
  source: string;
  url: string;
  percent: number;
};

type Result = {
  score: number;
  matches: Match[];
  text: string;
};

function App() {
  const [text, setText] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const handleCheck = () => {
    if (!text.trim()) return;
    setIsChecking(true);
    setResult(null);

    // Mocking an API call
    setTimeout(() => {
      setResult({
        score: 24,
        text: text,
        matches: [
          {
            source: 'Wikipedia - Artificial Intelligence',
            url: 'https://en.wikipedia.org/wiki/Artificial_intelligence',
            percent: 18,
          },
          {
            source: 'Example Tech Blog',
            url: 'https://example.com/blog/ai-future',
            percent: 6,
          },
        ],
      });
      setIsChecking(false);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-10">
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">
            Plagiarism Checker
          </h1>
          <p className="mt-2 text-lg text-gray-600">
            Ensure your text is original. Paste it below to check.
          </p>
        </header>

        <main className="bg-white rounded-xl shadow-md p-6 sm:p-8">
          <div className="mb-6">
            <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-2">
              Text to check
            </label>
            <textarea
              id="content"
              rows={8}
              className="w-full border border-gray-300 rounded-lg p-4 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              placeholder="Paste your text here (minimum 50 words recommended)..."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              {text.trim().split(/\s+/).filter((w) => w.length > 0).length} words
            </div>
            <button
              onClick={handleCheck}
              disabled={isChecking || !text.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isChecking ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Checking...
                </>
              ) : (
                'Check Plagiarism'
              )}
            </button>
          </div>
        </main>

        {result && (
          <section className="mt-8 bg-white rounded-xl shadow-md p-6 sm:p-8 animate-fade-in-up">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 border-b pb-4">Results</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="col-span-1 bg-red-50 rounded-lg p-6 flex flex-col items-center justify-center border border-red-100">
                <span className="text-5xl font-extrabold text-red-600">{result.score}%</span>
                <span className="text-red-800 font-medium mt-2">Plagiarized</span>
              </div>
              <div className="col-span-1 bg-green-50 rounded-lg p-6 flex flex-col items-center justify-center border border-green-100">
                <span className="text-5xl font-extrabold text-green-600">{100 - result.score}%</span>
                <span className="text-green-800 font-medium mt-2">Unique</span>
              </div>
              <div className="col-span-1 bg-gray-50 rounded-lg p-6 flex flex-col items-center justify-center border border-gray-200">
                <span className="text-3xl font-bold text-gray-700">{result.matches.length}</span>
                <span className="text-gray-600 font-medium mt-2">Sources Found</span>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Matched Sources</h3>
              <div className="space-y-4">
                {result.matches.map((match, idx) => (
                  <div key={idx} className="flex items-start justify-between p-4 border rounded-lg hover:bg-gray-50 transition">
                    <div>
                      <h4 className="font-medium text-gray-900">{match.source}</h4>
                      <a href={match.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline break-all">
                        {match.url}
                      </a>
                    </div>
                    <div className="bg-red-100 text-red-800 text-sm font-semibold px-3 py-1 rounded-full whitespace-nowrap ml-4">
                      {match.percent}% match
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default App;
