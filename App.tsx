import React from 'react';
import VideoPlayer from './components/VideoPlayer';

const App: React.FC = () => {
  return (
    <main 
      className="min-h-screen w-full flex items-center justify-center p-4 sm:p-8 bg-[#FDF0D5]"
      style={{ fontFamily: "'VT323', monospace" }}
    >
      <div className="w-full max-w-5xl bg-white border-4 border-black rounded-lg shadow-[8px_8px_0px_#000000]">
        <div className="border-b-4 border-black p-4">
            <h1 className="text-3xl font-bold text-center text-black">PAKA KOTHA</h1>
            <p className="text-center text-black">NEWS VIDEO GENERATOR</p>
        </div>
        <div className="p-4 sm:p-6">
            <VideoPlayer />
        </div>
      </div>
    </main>
  );
};

export default App;
