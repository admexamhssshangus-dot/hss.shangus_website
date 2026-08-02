import React, { useEffect, useState } from 'react';

// Slideshow supports three ways to provide slides:
// 1. `images` prop: an array of image URLs (legacy/simple usage).
// 2. `configUrl` prop: a public URL to a text or JSON file that describes slides.
//    - If `configUrl` points to a `.json` file, it should be an array of objects
//      [{ image: '1.jpg', title: 'Header', caption: 'subtext' }, ...]
//    - If `configUrl` points to a plain text file, each non-empty line maps to a slide.
//      By default the parser will split the line by the first comma into `title,caption`.
//      The corresponding image will be taken from `imageFolder` as `1.jpg`, `2.jpg`, ...
// 3. If a text file line includes the image filename as the first value (contains a dot),
//    it will be used directly: `image.jpg,Header,Caption`.
// Usage (place files under `public/slides/`):
// - public/slides/1.jpg
// - public/slides/2.jpg
// - public/slides/slides.txt    (each line: `Header,Caption`)
// Then in your page: <Slideshow configUrl="/slides/slides.txt" imageFolder="/slides/" />

export default function Slideshow({ slides: customSlides = null, images = [], interval = 6000, configUrl = null, imageFolder = '/slides/', imageExt = '.jpg' }) {
  const [index, setIndex] = useState(0);
  const [slides, setSlides] = useState([]); // array of { image, title, caption }
  const [loadedIndices, setLoadedIndices] = useState(new Set([0]));

  // Reset loaded indices if slides list changes
  useEffect(() => {
    setLoadedIndices(new Set([0]));
  }, [slides]);

  // Track loaded indices to lazy load images (current and next slide)
  useEffect(() => {
    if (slides && slides.length > 0) {
      setLoadedIndices((prev) => {
        const nextSet = new Set(prev);
        nextSet.add(index);
        nextSet.add((index + 1) % slides.length);
        return nextSet.size === prev.size ? prev : nextSet;
      });
    }
  }, [index, slides]);

  // Build slides from customSlides if provided
  useEffect(() => {
    if (customSlides && customSlides.length > 0) {
      setSlides(customSlides);
    }
  }, [customSlides]);

  // Build slides from images prop if provided
  useEffect(() => {
    if (images && images.length > 0 && !configUrl && (!customSlides || customSlides.length === 0)) {
      setSlides(images.map((src) => ({ image: src, title: '', caption: '' })));
    }
  }, [images, configUrl, customSlides]);

  // Load slides from configUrl when provided
  useEffect(() => {
    if (!configUrl || (customSlides && customSlides.length > 0)) return;

    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(configUrl, { cache: 'no-cache' });
        if (!res.ok) throw new Error('Failed to fetch slides config');
        const text = await res.text();

        // Try JSON first
        try {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) {
            const mapped = parsed.map((s) => {
              const image = s.image || s.src || '';
              const imageUrl = (image.startsWith('http://') || image.startsWith('https://') || image.startsWith('data:'))
                ? image
                : (image.startsWith('/') ? image : imageFolder + image);
              return { image: imageUrl, title: s.title || '', caption: s.caption || '' };
            });
            if (!cancelled) setSlides(mapped);
            return;
          }
        } catch (e) {
          // not JSON, fall through to text parsing
        }

        // Plain text parsing: one slide per line
        const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        const mapped = lines.map((line, idx) => {
          const parts = line.split(',');
          // If first part looks like a filename (contains dot), use it
          if (parts[0] && parts[0].includes('.')) {
            const image = parts[0].trim();
            const title = (parts[1] || '').trim();
            const caption = (parts.slice(2).join(',') || '').trim();
            const imageUrl = (image.startsWith('http://') || image.startsWith('https://') || image.startsWith('data:'))
              ? image
              : (image.startsWith('/') ? image : imageFolder + image);
            return { image: imageUrl, title, caption };
          }
          // Otherwise, treat line as `title,caption` and image as numbered file
          const title = (parts[0] || '').trim();
          const caption = (parts.slice(1).join(',') || '').trim();
          const image = `${imageFolder}${idx + 1}${imageExt}`;
          return { image, title, caption };
        });

        if (!cancelled) setSlides(mapped);
      } catch (err) {
        // on error, fallback to empty slides
        console.error('Slideshow: failed to load config', err);
        if (!cancelled) setSlides([]);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [configUrl, imageFolder, imageExt, customSlides]);

  // autoplay index rotation
  useEffect(() => {
    if (!slides || slides.length <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % slides.length), interval);
    return () => clearInterval(id);
  }, [slides, interval]);

  if (!slides || slides.length === 0) return null;

  return (
    <div className="absolute inset-0 overflow-hidden">
      {slides.map((s, i) => {
        const isLoaded = loadedIndices.has(i);
        return (
          <div
            key={i}
            role="img"
            aria-label={`slide-${i}`}
            className={`absolute inset-0 bg-cover bg-center transition-opacity duration-700 ease-out ${i === index ? 'opacity-100 z-0' : 'opacity-0 z-0'}`}
            style={isLoaded ? { backgroundImage: `url(${s.image})` } : {}}
          >
            {i === 0 && isLoaded && (
              <img
                src={s.image}
                alt={s.title || "Govt HSS Shangus"}
                fetchpriority="high"
                decoding="async"
                className="w-full h-full object-cover opacity-0 pointer-events-none"
              />
            )}
          </div>
        );
      })}

      {/* dark overlay above slides but below page content */}
      <div className="absolute inset-0 bg-black/45 z-10 pointer-events-none" />

      {/* Controls */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="flex items-center gap-1.5 absolute bottom-3 right-3 sm:right-auto sm:left-1/2 sm:-translate-x-1/2 sm:bottom-8 pointer-events-auto z-20">
          <button
            aria-label="previous"
            onClick={() => setIndex((i) => (i - 1 + slides.length) % slides.length)}
            className="bg-black/60 text-white rounded-full border border-white shadow-lg hover:bg-black/70 text-[13px] sm:text-[18px] flex items-center justify-center w-[20px] h-[20px] sm:w-[26px] sm:h-[26px]"
          >
            ‹
          </button>
          <button
            aria-label="next"
            onClick={() => setIndex((i) => (i + 1) % slides.length)}
            className="bg-black/60 text-white rounded-full border border-white shadow-lg hover:bg-black/70 text-[13px] sm:text-[18px] flex items-center justify-center w-[20px] h-[20px] sm:w-[26px] sm:h-[26px]"
          >
            ›
          </button>
        </div>
      </div>

      {/* Left caption (matches screenshot) */}
      <div className="absolute left-3 right-auto bottom-3 sm:bottom-6 sm:left-6 text-left text-white z-20 pointer-events-none max-w-[calc(100%-92px)] sm:max-w-[60%] flex flex-col items-start gap-[1px] sm:gap-1">
        {slides[index].title && (
          <h3 className="text-[10px] sm:text-sm font-bold text-teal-300 leading-none m-0 p-0 drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.85)] pl-0.5">{slides[index].title}</h3>
        )}
        {slides[index].caption && (
          <div className="-skew-x-12 bg-black/45 px-1 py-[1.5px] sm:px-2 sm:py-0.5 rounded-sm backdrop-blur-sm">
            <span className="skew-x-12 block text-[9.5px] sm:text-xs italic text-white/90 leading-none m-0 p-0">{slides[index].caption}</span>
          </div>
        )}
      </div>
    </div>
  );
}
