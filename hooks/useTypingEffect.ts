
import { useState, useEffect } from 'react';

/**
 * A custom hook for creating a typing effect on a string.
 * @param text The full text to be typed out.
 * @param speed The speed of typing in milliseconds per character.
 * @param start A boolean to start or pause the typing effect.
 * @returns The currently displayed portion of the text.
 */
export const useTypingEffect = (text: string, speed: number, start: boolean): string => {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    setDisplayedText(''); // Reset on text change or when restarting
    if (start && text) {
      let i = 0;
      const intervalId = setInterval(() => {
        setDisplayedText(text.substring(0, i + 1));
        i++;
        if (i >= text.length) {
          clearInterval(intervalId);
        }
      }, speed);

      return () => clearInterval(intervalId);
    }
  }, [text, speed, start]);

  return displayedText;
};
