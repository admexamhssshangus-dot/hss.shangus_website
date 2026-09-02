import React, { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Slideshow supports three ways to provide slides:
// 1. `images` prop: an array of image URLs (legacy/simple usage).
// 2. `configUrl` prop: a public URL to a text or JSON file that describes slides.
// 3. `slides` prop: an array of slide objects [{ image, title, caption, fit, animation }]

export default function Slideshow({
  slides: customSlides = null,
  images = [],
  interval = 6000,
  configUrl = null,
  imageFolder = '/slides/',
  imageExt = '.jpg'
}) {
  const [index, setIndex] = useState(0);
  const [slides, setSlides] = useState([]); // array of { image, title, caption, fit, animation }
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
      setSlides(images.map((src) => ({ image: src, title: '', caption: '', fit: 'ambient', animation: 'kenburns' })));
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
              return {
                image: imageUrl,
                title: s.title || '',
                caption: s.caption || '',
                fit: s.fit || 'ambient',
                animation: s.animation || 'kenburns'
              };
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
            return { image: imageUrl, title, caption, fit: 'ambient', animation: 'kenburns' };
          }
          // Otherwise, treat line as `title,caption` and image as numbered file
          const title = (parts[0] || '').trim();
          const caption = (parts.slice(1).join(',') || '').trim();
          const image = `${imageFolder}${idx + 1}${imageExt}`;
          return { image, title, caption, fit: 'ambient', animation: 'kenburns' };
        });

        if (!cancelled) setSlides(mapped);
      } catch (err) {
        console.error('Slideshow: failed to load config', err);
        if (!cancelled) setSlides([]);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [configUrl, imageFolder, imageExt, customSlides]);

  // Next / Prev slide handlers
  const handlePrev = useCallback(() => {
    setIndex((i) => (i - 1 + slides.length) % slides.length);
  }, [slides.length]);

  const handleNext = useCallback(() => {
    setIndex((i) => (i + 1) % slides.length);
  }, [slides.length]);

  // Autoplay index rotation (advances every interval ms automatically)
  useEffect(() => {
    if (!slides || slides.length <= 1) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, interval);
    return () => clearInterval(id);
  }, [slides, interval]);

  if (!slides || slides.length === 0) return null;

  return (
    <div className="absolute inset-0 overflow-hidden select-none">
      {slides.map((s, i) => {
        const isLoaded = loadedIndices.has(i);
        const isActive = i === index;
        const fitMode = s.fit || 'ambient'; // 'ambient' | 'cover' | 'contain'
        const animMode = s.animation || 'kenburns'; // 'kenburns' | 'fade' | 'zoom' | 'pan'

        // Determine animation class
        let animClass = '';
        if (isActive) {
          if (animMode === 'kenburns') animClass = 'animate-slide-kenburns';
          else if (animMode === 'zoom') animClass = 'animate-slide-zoom';
          else if (animMode === 'pan') animClass = 'animate-slide-pan';
        }

        return (
          <div
            key={i}
            role="img"
            aria-label={s.title || `Slide ${i + 1}`}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              isActive ? 'opacity-100 z-0 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'
            }`}
          >
            {isLoaded && (
              <>
                {/* 1. AMBIENT GLOW MODE: Full uncropped photo + ambient blurred background */}
                {fitMode === 'ambient' && (
                  <>
                    {/* Ambient backdrop */}
                    <div
                      className="absolute inset-0 bg-cover bg-center filter blur-2xl scale-125 opacity-60 brightness-75 transform-gpu"
                      style={{ backgroundImage: `url(${s.image})` }}
                    />
                    {/* Foreground uncropped full photo with animation (padded to stay within clear visible area) */}
                    <div className="absolute inset-0 flex items-center justify-center p-2 sm:p-4 md:p-6 pt-3 sm:pt-4 md:pt-6 pb-16 sm:pb-20 md:pb-24">
                      <img
                        src={s.image}
                        alt={s.title || "Govt HSS Shangus"}
                        fetchPriority={i === 0 ? "high" : "auto"}
                        decoding="async"
                        className={`max-w-full max-h-full object-contain rounded-md sm:rounded-lg shadow-[0_15px_40px_rgba(0,0,0,0.85)] drop-shadow-2xl border border-white/10 ${animClass}`}
                      />
                    </div>
                  </>
                )}

                {/* 2. COVER MODE: Widescreen filled banner */}
                {fitMode === 'cover' && (
                  <div
                    className={`absolute inset-0 bg-cover bg-center ${animClass}`}
                    style={{ backgroundImage: `url(${s.image})` }}
                  >
                    {i === 0 && (
                      <img
                        src={s.image}
                        alt={s.title || "Govt HSS Shangus"}
                        fetchPriority="high"
                        decoding="async"
                        className="w-full h-full object-cover opacity-0 pointer-events-none"
                      />
                    )}
                  </div>
                )}

                {/* 3. CONTAIN MODE: Centered uncropped with dark backdrop */}
                {fitMode === 'contain' && (
                  <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center p-2 sm:p-4 md:p-6 pt-3 sm:pt-4 md:pt-6 pb-16 sm:pb-20 md:pb-24">
                    <img
                      src={s.image}
                      alt={s.title || "Govt HSS Shangus"}
                      fetchPriority={i === 0 ? "high" : "auto"}
                      decoding="async"
                      className={`max-w-full max-h-full object-contain rounded-md shadow-2xl ${animClass}`}
                    />
                  </div>
                )}

                {/* 4. STRETCH MODE: Stretch to fit full available space/sides */}
                {fitMode === 'stretch' && (
                  <div className="absolute inset-0 overflow-hidden">
                    <img
                      src={s.image}
                      alt={s.title || "Govt HSS Shangus"}
                      fetchPriority={i === 0 ? "high" : "auto"}
                      decoding="async"
                      className={`w-full h-full object-fill ${animClass}`}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}

      {/* Dark vignette & readability gradient overlay above slides but below text slogans */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-black/30 to-black/45 z-10 pointer-events-none" />

      {/* Interactive Controls & Slide Indicator Dots */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="flex items-center gap-2 sm:gap-3 absolute bottom-2.5 right-2 sm:right-auto sm:left-1/2 sm:-translate-x-1/2 sm:bottom-6 md:bottom-20 pointer-events-auto z-20 bg-slate-950/60 backdrop-blur-md px-2 sm:px-3 py-1 sm:py-1.5 rounded-full border border-white/15 shadow-xl">
          {/* Prev button */}
          <button
            type="button"
            aria-label="Previous slide"
            onClick={handlePrev}
            className="text-white/80 hover:text-white hover:bg-white/15 active:scale-90 rounded-full flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 transition-all duration-200 cursor-pointer"
            title="Previous slide"
          >
            <ChevronLeft size={14} className="stroke-[2.5]" />
          </button>

          {/* Indicator dots */}
          {slides.length > 1 && (
            <div className="flex items-center gap-1 sm:gap-1.5 px-0.5">
              {slides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Jump to slide ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                    i === index
                      ? 'w-5 sm:w-6 bg-teal-400 shadow-[0_0_10px_rgba(45,212,191,0.8)]'
                      : 'w-1.5 bg-white/40 hover:bg-white/70'
                  }`}
                  title={`Slide ${i + 1}`}
                />
              ))}
            </div>
          )}

          {/* Next button */}
          <button
            type="button"
            aria-label="Next slide"
            onClick={handleNext}
            className="text-white/80 hover:text-white hover:bg-white/15 active:scale-90 rounded-full flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 transition-all duration-200 cursor-pointer"
            title="Next slide"
          >
            <ChevronRight size={14} className="stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* Left caption badge with smooth animated entrance */}
      {(slides[index]?.title || slides[index]?.caption) && (
        <div
          key={`caption-${index}`}
          className="animate-badge-fade-up absolute left-2.5 sm:left-6 right-auto bottom-2.5 sm:bottom-6 md:bottom-20 text-left text-white z-20 pointer-events-none max-w-[calc(100%-140px)] sm:max-w-[55%] flex flex-col items-start gap-[2px] sm:gap-1"
        >
          {slides[index].title && (
            <h3 className="text-[11px] sm:text-sm md:text-base font-bold text-teal-300 leading-tight m-0 p-0 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] pl-0.5 tracking-wide">
              {slides[index].title}
            </h3>
          )}
          {slides[index].caption && (
            <div className="-skew-x-6 bg-black/60 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded backdrop-blur-md border border-white/15 shadow-lg">
              <span className="skew-x-6 block text-[9.5px] sm:text-xs font-medium text-slate-200 leading-tight m-0 p-0">
                {slides[index].caption}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
