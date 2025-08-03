import React from 'react';
import { NewsItem } from '../types';
import { useTypingEffect } from '../hooks/useTypingEffect';

interface NewsDetailProps {
  newsItem: NewsItem;
  isActive: boolean;
}

const NewsDetail: React.FC<NewsDetailProps> = ({ newsItem, isActive }) => {
  const typedDescription = useTypingEffect(newsItem.description, 50, isActive);

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Content Container */}
      <div className="absolute inset-0 p-6 flex flex-col justify-end">
        <div 
          className={`w-full transition-all duration-700 ease-out ${isActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
          style={{ transitionDelay: isActive ? '300ms' : '0ms' }}
        >
          {/* Image Box */}
          <div className="w-full h-48 mb-4 rounded-lg overflow-hidden border-2 border-white/40 shadow-xl mx-auto">
            <img 
              src={newsItem.image} 
              alt={newsItem.headline} 
              className="w-full h-full object-cover"
            />
          </div>

          {/* Headline */}
          <div className="bg-yellow-400/10 border-l-4 border-yellow-400 p-3 mb-4 backdrop-blur-sm rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold text-white" style={{ textShadow: '1px 1px 3px rgba(0,0,0,0.5)' }}>
              {newsItem.headline}
            </h2>
          </div>
          
          {/* Description */}
          <div className="bg-black/50 p-4 rounded-lg backdrop-blur-sm min-h-[120px] shadow-lg">
            <p className="text-white/90 text-lg font-normal leading-relaxed">
              {typedDescription}
              {isActive && typedDescription.length < newsItem.description.length ? <span className="animate-pulse">|</span> : ''}
            </p>
          </div>
        </div>
        
        {/* Spacer for bottom logo overlay */}
        <div className="h-32 flex-shrink-0"></div>
      </div>
    </div>
  );
};

export default NewsDetail;