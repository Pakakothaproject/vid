


import React from 'react';
import { NewsItem } from '../types';

interface NewsCardProps {
  newsItem: NewsItem;
  index: number;
  animate: boolean;
}

const NewsCard: React.FC<NewsCardProps> = ({ newsItem, index, animate }) => {
  return (
    <div 
        className={`flex items-center gap-4 w-full my-3 transition-all duration-500 ease-out ${animate ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
        style={{ transitionDelay: animate ? `${index * 100}ms` : '0ms' }}
    >
      <div className="w-32 h-24 flex-shrink-0 rounded-xl overflow-hidden border-2 border-white/50 shadow-md">
        <img src={newsItem.image} alt={newsItem.headline} className="w-full h-full object-cover" />
      </div>
      <div className="flex-grow bg-black/80 p-4 rounded-xl text-white text-lg font-semibold leading-tight shadow-lg border border-white/20 h-24 flex items-center">
        {newsItem.headline}
      </div>
    </div>
  );
};

export default NewsCard;
