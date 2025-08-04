import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NewsItem } from '../types';
import NewsCard from './NewsCard';
import NewsDetail from './NewsDetail';
import LogBox from './LogBox';
import { Play, Loader, Video, RefreshCw, Film, AlertTriangle } from 'lucide-react';
import { fetchRawArticles } from '../services/newsdataService';
import { processNews } from '../services/geminiService';
import { generateAudio } from '../services/geminiTtsService';

interface VideoPlayerProps {
  isRecordMode?: boolean;
}

const placeholderNews: NewsItem[] = [
  {
    id: "ph1",
    headline: "গোপালগঞ্জে সহিংসতায়গুরুতরমানবাধিকারলঙ্ঘন",
    description: "মুকসুদপুরেআওয়ামীলীগেরঅভ্যন্তরীণকোন্দলেরজেরেব্যাপকমানবাধিকারলঙ্ঘনেরঘটন ঘটেছে, যাস্থানীয়সম্প্রদায়েরমধ্যেগভীরউদ্বেগসৃষ্টিকরেছে।",
    image: "https://res.cloudinary.com/dho5purny/image/upload/v1754091924/paka_kotha_gen_1_r7mq2y.png",
    audioSrc: null,
  },
  {
    id: "ph2",
    headline: "নতুনশিল্পনীতিতেঅর্থনৈতিকপ্রবৃদ্ধিরআশা",
    description: "সরকারনতুনশিল্পনীতিঘোষণাকরেছে, যারলক্ষ্যদেশেবিনিয়োগআকর্ষণএবংকর্মসংস্থানসৃষ্টিকরা।",
    image: "https://res.cloudinary.com/dho5purny/image/upload/v1754091924/paka_kotha_gen_2_x0z5g2.png",
    audioSrc: null,
  },
  {
    id: "ph3",
    headline: "নদীভাঙ্গনেবিলীনহচ্ছেগ্রামেরপরগ্রাম",
    description: "বর্ষামৌসুমনদীরজলস্তরবাড়ায়বিভিন্নজেলায়নদীভাঙ্গনতীব্রআকারধারণকরেছে, হাজারহাজারমানুষগৃহহীনহয়েপড়েছে।",
    image: "https://res.cloudinary.com/dho5purny/image/upload/v1754091925/paka_kotha_gen_3_yp9cqv.png",
    audioSrc: null,
  },
  {
    id: "ph4",
    headline: "তরুণদেরমধ্যেবাড়ছেফ্রিল্যান্সিংয়েরজনপ্রিয়তা",
    description: "ডিজিটালযুগেতরুণপ্রজন্মपारंपरिकচাকরিরপরিবর্তেফ্রিল্যান্সিংকেপেশাহিসেবেবেছেনিচ্ছে, যাদেশেরঅর্থনীতিতেনতুনসম্ভাবনতৈরিকরছে।",
    image: "https://res.cloudinary.com/dho5purny/image/upload/v1754091924/paka_kotha_gen_4_m6xhtv.png",
    audioSrc: null,
  },
  {
    id: "ph5",
    headline: "ঐতিহাসিকস্থাপনাসংরক্ষশেনতুনউদ্যোগগ্রহণ",
    description: "দেশেরপ্রত্নতাত্ত্বিকঐতিহ্যরক্ষাকরতেসরকারএবংবেসরকারিসংস্থাগুলোএকত্রিতহয়েঐতিহাসিকস্থাপনাসংরক্ষশেনতুনপ্রকল্পহাতেনিয়েছে।",
    image: "https://res.cloudinary.com/dho5purny/image/upload/v1754091926/paka_kotha_gen_5_q9yicx.png",
    audioSrc: null,
  }
];

const BGM_CHOICES = [
  'https://res.cloudinary.com/dho5purny/video/upload/v1754022296/Untitled_lngxhv.mp3',
  'https://res.cloudinary.com/dho5purny/video/upload/v1754022521/Untitled_1_k29dkn.mp3',
  'https://res.cloudinary.com/dho5purny/video/upload/v1754022536/Untitled_2_lat2xt.mp3'
];

type AppStatus = 'idle' | 'generating' | 'preloading' | 'ready' | 'playing' | 'error' | 'finished';
type AnimationPhase = 'stopped' | 'overview' | 'detail' | 'logo';

const preloadWithTimeout = (promise: Promise<any>, timeout: number, assetUrl: string): Promise<any> => {
    return new Promise((resolve) => {
        const timer = setTimeout(() => {
            console.warn(`Preloading timed out after ${timeout / 1000}s for: ${assetUrl}`);
            resolve(null);
        }, timeout);

        promise
            .then(result => resolve(result))
            .catch((err) => {
                console.warn(`Preloading failed for: ${assetUrl}`, err);
                resolve(null);
            })
            .finally(() => clearTimeout(timer));
    });
};

const preloadAssets = async (
    items: NewsItem[],
    introAudio: string | null,
    bgm: string,
    logoUrl: string,
    bgUrl: string,
    overlayUrl: string
): Promise<{ loadedItems: NewsItem[], loadedUrls: Record<string, string> }> => {
    const assetPromises: Promise<any>[] = [];
    const PRELOAD_TIMEOUT = 20000;

    let loadedItems = [...items];
    const loadedUrls: Record<string, string> = {};

    const allImageSources = {
        ...items.reduce((acc, item, index) => ({ ...acc, [`item-${index}`]: item.image }), {}),
        logo: logoUrl,
        background: bgUrl,
        overlay: overlayUrl,
    };

    const imageKeys = Object.keys(allImageSources);
    const imagePromises = imageKeys.map(key => {
        const url = allImageSources[key];
        if (!url) return Promise.resolve();

        const imagePromise = new Promise<void>(async (resolve, reject) => {
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`Fetch failed with status ${response.status}`);
                const blob = await response.blob();
                const blobUrl = URL.createObjectURL(blob);
                
                if (key.startsWith('item-')) {
                    const index = parseInt(key.split('-')[1], 10);
                    loadedItems[index] = { ...loadedItems[index], image: blobUrl };
                } else {
                    loadedUrls[key] = blobUrl;
                }
                resolve();
            } catch (err) {
                console.warn(`Could not fetch image as blob for ${url}. Falling back.`, err);
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.src = url;
                img.onload = () => resolve();
                img.onerror = (e) => reject(new Error(`Fallback image load failed: ${e}`));
            }
        });
        return preloadWithTimeout(imagePromise, PRELOAD_TIMEOUT, url);
    });
    assetPromises.push(...imagePromises);

    const audioSources = [introAudio, bgm, ...items.map(i => i.audioSrc).filter(Boolean) as string[]];
    audioSources.forEach(src => {
        if (!src) return;
        const audioPromise = new Promise<void>((resolve, reject) => {
            const audio = new Audio();
            audio.src = src;
            audio.preload = 'auto';
            audio.addEventListener('canplaythrough', () => resolve(), { once: true });
            audio.addEventListener('error', (e) => reject(new Error(`Failed to load audio: ${src}; ${e}`)), { once: true });
            audio.load();
        });
        assetPromises.push(preloadWithTimeout(audioPromise, PRELOAD_TIMEOUT, src));
    });

    await Promise.all(assetPromises);
    
    return { loadedItems, loadedUrls };
};

const VideoPlayer: React.FC<VideoPlayerProps> = ({ isRecordMode = false }) => {
  const [news, setNews] = useState<NewsItem[]>(placeholderNews);
  const [appStatus, setAppStatus] = useState<AppStatus>('idle');
  const [animationPhase, setAnimationPhase] = useState<AnimationPhase>('stopped');
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  
  const generatedNewsRef = useRef<NewsItem[]>([]);
  const initialAudioUrlRef = useRef<string | null>(null);
  const bgmUrlRef = useRef<string | null>(null);
  const assetUrlsRef = useRef<Record<string, string>>({});
  
  const animationContainerRef = useRef<HTMLDivElement>(null);

  const audioRef = useRef<HTMLAudioElement>(null);
  const bgmRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  
  const narrationSourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const bgmSourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const bgmGainNodeRef = useRef<GainNode | null>(null);
  const isAudioInitialized = useRef<boolean>(false);

  // For audio recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedAudioChunksRef = useRef<Blob[]>([]);
  const streamDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);

  const addLog = useCallback((message: string) => {
      const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
      setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  }, []);

  const initializeAudioEngine = useCallback(() => {
    if (isAudioInitialized.current || !audioRef.current || !bgmRef.current) return;
    try {
        const context = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = context;
        narrationSourceNodeRef.current = context.createMediaElementSource(audioRef.current);
        bgmSourceNodeRef.current = context.createMediaElementSource(bgmRef.current);
        const gainNode = context.createGain();
        gainNode.gain.value = 0;
        bgmGainNodeRef.current = gainNode;
        bgmSourceNodeRef.current.connect(gainNode);
        
        // Connect to physical speakers for live playback
        narrationSourceNodeRef.current.connect(context.destination);
        bgmGainNodeRef.current.connect(context.destination);
        
        // In record mode, also connect to a stream destination for capture
        if (isRecordMode) {
            streamDestinationRef.current = context.createMediaStreamDestination();
            narrationSourceNodeRef.current.connect(streamDestinationRef.current);
            bgmGainNodeRef.current.connect(streamDestinationRef.current);
        }

        isAudioInitialized.current = true;
        addLog("Audio engine initialized.");
    } catch (e) {
        console.error("Failed to initialize AudioContext:", e);
        addLog("ERROR: Could not initialize audio engine. Playback may fail.");
        setError("Your browser does not support the necessary audio features.");
    }
  }, [addLog, isRecordMode]);

  const executeAnimationSequence = useCallback(async () => {
      const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

      const playAudioAndWait = (audioEl: HTMLAudioElement, src: string | null, fallbackDuration: number) => new Promise<void>(resolve => {
        if (!src) { 
            sleep(fallbackDuration).then(resolve);
            return; 
        }
        const onEnded = () => { audioEl.removeEventListener('ended', onEnded); resolve(); };
        audioEl.addEventListener('ended', onEnded);
        audioEl.src = src;
        audioEl.play().catch(e => { console.error("Audio playback error:", e); resolve(); });
      });

      if (bgmRef.current && bgmUrlRef.current) {
          bgmRef.current.src = bgmUrlRef.current;
          bgmRef.current.currentTime = 0;
          bgmRef.current.loop = true;
          bgmRef.current.play().catch(e => console.error("BGM play failed", e));
      }
      if (bgmGainNodeRef.current && audioContextRef.current) {
        bgmGainNodeRef.current.gain.setValueAtTime(0, audioContextRef.current.currentTime);
        bgmGainNodeRef.current.gain.linearRampToValueAtTime(0.08, audioContextRef.current.currentTime + 3);
      }
      
      setCurrentIndex(0);
      setAnimationPhase('overview');
      await sleep(500);
      await playAudioAndWait(audioRef.current!, initialAudioUrlRef.current, 4000);
      
      setAnimationPhase('detail');
      const newsItems = generatedNewsRef.current;
      for (let i = 0; i < newsItems.length; i++) {
          setCurrentIndex(i);
          await sleep(500);
          await playAudioAndWait(audioRef.current!, newsItems[i].audioSrc, 7000);
      }

      setAnimationPhase('logo');
      if (bgmGainNodeRef.current && audioContextRef.current) {
        bgmGainNodeRef.current.gain.linearRampToValueAtTime(0, audioContextRef.current.currentTime + 2.5);
      }
      await sleep(3000);

      setAnimationPhase('stopped');
      if(bgmRef.current) bgmRef.current.pause();

  }, []);
  
  const handleGenerate = async () => {
    if (appStatus === 'generating' || appStatus === 'preloading') return;
    
    setLogs([]);
    addLog('Starting story generation process...');
    setAppStatus('generating');
    setError(null);
    initializeAudioEngine();

    try {
        setLoadingMessage("Generating Intro...");
        addLog("Generating intro narration...");
        const introText = "এই হলো আজকের প্রধান খবর.";
        const introAudioUrl = await generateAudio(introText).catch(err => {
            console.warn("Failed to generate intro audio.", err);
            addLog("Warning: Failed to generate intro audio.");
            return null;
        });
        initialAudioUrlRef.current = introAudioUrl;
        addLog("Intro narration generated.");

        setLoadingMessage("Fetching Latest News...");
        addLog("Fetching latest news articles...");
        const { articles: rawArticles, stats } = await fetchRawArticles();
        addLog(`Fetched ${stats.totalFetched} articles in total.`);
        addLog(`${stats.withImages} articles had images and were passed to the AI for curation.`);
        
        setLoadingMessage("Curating Top 5 Stories...");
        addLog("Curating top 5 stories with AI...");
        const processedArticles = await processNews(rawArticles);
        addLog(`News curation complete. Received ${processedArticles.length} stories.`);
        if (processedArticles.length < 5) {
            addLog(`Warning: AI returned only ${processedArticles.length} stories. The system filled in the rest.`);
        }
        
        const newsWithAudioPromises = processedArticles.map(async (article, index) => {
            setLoadingMessage(`Generating Narration ${index + 1}/${processedArticles.length}...`);
            addLog(`Generating narration ${index + 1}/${processedArticles.length} for: "${article.headline.substring(0, 20)}..."`);
            const audioUrl = await generateAudio(article.description).catch(audioError => {
                console.warn(`Audio generation failed for headline: "${article.headline}".`, audioError);
                addLog(`Warning: Audio generation failed for "${article.headline.substring(0, 20)}..."`);
                setError("One or more audio narrations may have failed.");
                return null;
            });
            
            return {
                id: `news-${index}`, headline: article.headline, description: article.description,
                image: article.image_url, 
                audioSrc: audioUrl,
            };
        });
        const newsWithAudio = await Promise.all(newsWithAudioPromises);
        addLog("All narrations processed.");
        
        const randomBgm = BGM_CHOICES[Math.floor(Math.random() * BGM_CHOICES.length)];
        bgmUrlRef.current = randomBgm;

        setAppStatus('preloading');
        setLoadingMessage("Loading All Assets...");
        addLog("Preloading all images and audio...");
        const { loadedItems, loadedUrls } = await preloadAssets(
            newsWithAudio, introAudioUrl, randomBgm,
            "https://res.cloudinary.com/dho5purny/image/upload/v1754000603/Logo_nevggd.png",
            "https://res.cloudinary.com/dy80ftu9k/image/upload/v1754000569/Add_a_heading_x5yd2x.png",
            "https://res.cloudinary.com/dy80ftu9k/image/upload/v1753644798/Untitled-1_hxkjvt.png"
        );
        addLog("All assets preloaded successfully.");
        setNews(loadedItems);
        generatedNewsRef.current = loadedItems;
        assetUrlsRef.current = loadedUrls;
        
        setAppStatus('ready');
        addLog("Story ready for preview.");

    } catch (err) {
        const errorMessage = `Could not generate story. Error: ${err instanceof Error ? err.message : String(err)}`;
        console.error("Error during generation process:", err);
        setError(errorMessage);
        addLog(`ERROR: ${errorMessage}`);
        setNews(placeholderNews);
        setAppStatus('error');
    }
  };
  
  const handlePlay = async () => {
    if (appStatus !== 'ready' || !isAudioInitialized.current) return;
    
    // Resume audio context if it was suspended
    if(audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }

    if (isRecordMode && streamDestinationRef.current) {
        addLog("Starting audio recording...");
        recordedAudioChunksRef.current = [];
        mediaRecorderRef.current = new MediaRecorder(streamDestinationRef.current.stream, { mimeType: 'audio/webm' });
        
        mediaRecorderRef.current.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedAudioChunksRef.current.push(event.data);
            }
        };

        mediaRecorderRef.current.onstop = () => {
            addLog("Audio recording stopped. Processing...");
            const audioBlob = new Blob(recordedAudioChunksRef.current, { type: 'audio/webm' });
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = (reader.result as string).split(',')[1];
                (window as any).recordedAudioBase64 = base64;
                addLog("Audio data is ready for script retrieval.");
            };
            reader.readAsDataURL(audioBlob);
        };
        
        mediaRecorderRef.current.start();
    }

    setAppStatus('playing');
    addLog("Starting preview playback...");
    if(audioRef.current) audioRef.current.currentTime = 0;
    if(bgmRef.current) bgmRef.current.currentTime = 0;
    
    await executeAnimationSequence();

    if (isRecordMode && mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
    }

    addLog("Playback finished.");
    setAppStatus('finished');
  };

  const handleGenerateNew = () => {
    setError(null);
    setAppStatus('idle');
    setNews(placeholderNews);
    generatedNewsRef.current = [];
    setLogs([]);
  }

  const buttonStyle = "w-full bg-yellow-400 text-black border-2 border-black px-6 py-2 text-xl uppercase font-bold shadow-[4px_4px_0px_#000000] hover:shadow-[2px_2px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all flex items-center justify-center gap-2 disabled:bg-gray-400 disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0 disabled:cursor-not-allowed";

  const playerViewContainerClass = `relative rounded-lg shadow-2xl overflow-hidden border-2 border-gray-400/30 text-white bg-cover bg-center ${
    isRecordMode ? 'w-full h-full' : 'w-[360px] h-[640px]'
  }`;

  const PlayerView = (
    <div 
      ref={animationContainerRef}
      className={playerViewContainerClass}
      style={{ 
          fontFamily: "'Hind Siliguri', sans-serif",
          backgroundImage: `url('${assetUrlsRef.current.background || 'https://res.cloudinary.com/dy80ftu9k/image/upload/v1754000569/Add_a_heading_x5yd2x.png'}')`
      }}
    >
      <audio ref={audioRef} crossOrigin="anonymous" className="hidden"></audio>
      <audio ref={bgmRef} crossOrigin="anonymous" className="hidden"></audio>

      {(appStatus === 'idle' || appStatus === 'error' || appStatus === 'finished') && (
        <div className="w-full h-full flex flex-col items-center justify-center p-4">
          <Video className="w-24 h-24 text-white/80 mb-4 opacity-50" />
          <h1 className="text-2xl font-bold text-center drop-shadow-lg">Paka Kotha Video</h1>
          <p className="text-white/70 mt-2 text-center">
            {appStatus === 'finished' ? 'Playback complete.' : 'Click "Generate Story" to start.'}
          </p>
        </div>
      )}
      
      <div className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${animationPhase === 'overview' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <div className="pt-10 text-center">
            <h1 className="text-4xl font-bold" style={{textShadow: '2px 2px 4px rgba(0,0,0,0.5)'}}>আজকের প্রধান খবর:</h1>
            <p className="text-xl font-semibold opacity-80" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.5)'}}>সংবাদ সারসংক্ষেপ</p>
          </div>
          <div className="absolute top-36 left-0 right-0 px-4">
              {news.map((item, index) => <NewsCard key={item.id} newsItem={item} index={index} animate={animationPhase === 'overview'} />)}
          </div>
      </div>
      
      <div className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${animationPhase === 'detail' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <div className="relative w-full h-full">
              {news.map((item, index) => (
                  <div key={item.id} className={`absolute inset-0 w-full h-full transition-opacity duration-500 ease-in-out ${currentIndex === index ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                      <NewsDetail newsItem={item} isActive={animationPhase === 'detail' && currentIndex === index} />
                  </div>
              ))}
          </div>
      </div>
      
      <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-500 ease-in-out ${animationPhase === 'logo' ? 'opacity-100' : 'opacity-0'}`}>
          <img src={assetUrlsRef.current.logo || "https://res.cloudinary.com/dho5purny/image/upload/v1754000603/Logo_nevggd.png"} alt="Paka Kotha Logo" className={`transition-all duration-1000 ease-out ${animationPhase === 'logo' ? 'scale-50 opacity-100' : 'scale-40 opacity-0'}`}/>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-36 bg-cover bg-no-repeat bg-bottom z-10 pointer-events-none" style={{ backgroundImage: `url('${assetUrlsRef.current.overlay || 'https://res.cloudinary.com/dy80ftu9k/image/upload/v1753644798/Untitled-1_hxkjvt.png'}')` }}/>
      <div className={`absolute bottom-5 z-20 w-full flex justify-center pointer-events-none transition-opacity duration-300 ${animationPhase === 'logo' ? 'opacity-0' : 'opacity-100'}`}>
          <img src={assetUrlsRef.current.logo || "https://res.cloudinary.com/dho5purny/image/upload/v1754000603/Logo_nevggd.png"} alt="Paka Kotha Logo" className="h-16" />
      </div>
    </div>
  );

  const controlsWrapperClass = isRecordMode
      ? `absolute bottom-4 left-4 right-4 z-30 flex flex-col items-center gap-2 transition-opacity duration-500 ease-in-out ${appStatus === 'playing' || appStatus === 'finished' ? 'opacity-0 pointer-events-none' : 'opacity-100'}`
      : "w-full flex flex-col items-center justify-center gap-4 pt-4 max-w-sm";

  const Controls = (
      <div className={controlsWrapperClass}>
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 w-full rounded-md flex items-start gap-3" role="alert" style={{ fontFamily: "'Roboto', sans-serif" }}>
            <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0 mt-1" />
            <div>
                <p className="font-bold">An Error Occurred</p>
                <p className="text-sm">{error}</p>
            </div>
        </div>
      )}

      {(appStatus === 'idle' || appStatus === 'error') && (
        <button onClick={handleGenerate} className={buttonStyle} data-testid="generate-story-button">
          <Film size={20} /> <span>{appStatus === 'error' ? 'Try Again' : 'Generate Story'}</span>
        </button>
      )}

      {appStatus === 'generating' || appStatus === 'preloading' && (
         <button disabled className={buttonStyle}>
          <Loader className="animate-spin" size={20} /> <span>{loadingMessage}</span>
        </button>
      )}
      
      {(appStatus === 'ready' || appStatus === 'playing') && (
          <div className="flex flex-col sm:flex-row items-stretch w-full gap-4">
              <button onClick={handlePlay} disabled={appStatus === 'playing'} className={`${buttonStyle} bg-green-400 flex-1`} data-testid="play-preview-button">
                  {appStatus === 'playing' ? <Loader className="animate-spin" size={20}/> : <Play size={20} />} Play Preview
              </button>
               <button onClick={handleGenerateNew} disabled={appStatus === 'playing'} className={`${buttonStyle} bg-blue-400 flex-1`}>
                <RefreshCw size={20} /> Generate New
              </button>
          </div>
      )}
    </div>
  );

  if (isRecordMode) {
      return (
        <div className="w-screen h-screen relative bg-black">
            {PlayerView}
            {Controls}
        </div>
      )
  }

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      {/* Column 1: Player & Controls */}
      <div className="flex flex-col items-center gap-6 lg:w-1/2 lg:flex-shrink-0">
        {PlayerView}
        {Controls}
      </div>

      <LogBox logs={logs} />
    </div>
  );
};

export default VideoPlayer;
