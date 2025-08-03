import React, { useEffect, useRef } from 'react';

interface LogBoxProps {
  logs: string[];
}

const LogBox: React.FC<LogBoxProps> = ({ logs }) => {
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="w-full lg:w-1/2 flex flex-col" style={{ fontFamily: "'Roboto', sans-serif" }}>
      <div className="border-b-2 border-black pb-1 mb-2 flex justify-between items-baseline">
        <h2 
          className="text-xl font-bold text-black" 
          style={{ fontFamily: "'VT323', monospace" }}
        >
          Generation Log
        </h2>
      </div>
      <div 
        ref={logContainerRef}
        className="flex-grow bg-gray-100 border-2 border-black p-3 text-sm overflow-y-auto h-96 lg:h-[calc(640px+4rem)] text-black rounded-md shadow-inner"
      >
        {logs.length === 0 ? (
          <p className="text-gray-500 h-full flex items-center justify-center">Logs will appear here...</p>
        ) : (
          logs.map((log, index) => (
            <p key={index} className={`whitespace-pre-wrap font-mono text-xs leading-relaxed border-b border-gray-200 py-1 ${log.includes('ERROR') ? 'text-red-600' : log.includes('Warning') ? 'text-yellow-700' : 'text-gray-800'}`}>
              {log}
            </p>
          ))
        )}
      </div>
    </div>
  );
};

export default LogBox;