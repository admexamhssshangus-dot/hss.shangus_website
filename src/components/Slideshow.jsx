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

export default function Slideshow({ images = [], interval = 6000, configUrl = null, imageFolder = '/slides/', imageExt = '.jpg' }) {
  const [index, setIndex] = useState(0);
  const [slides, setSlides] = useState([]); // array of { image, title, caption }

  // Build slides from images prop if provided
  useEffect(() => {
    if (images && images.length > 0 && !configUrl) {
      setSlides(images.map((src) => ({ image: src, title: '', caption: '' })));
    }
  }, [images, configUrl]);

  // Load slides from configUrl when provided
  useEffect(() => {
    if (!configUrl) return;

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
            const mapped = parsed.map((s) => ({ image: (s.image || s.src), title: s.title || '', caption: s.caption || '' }));
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
            return { image: imageFolder + image, title, caption };
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
  }, [configUrl, imageFolder, imageExt]);

  // autoplay index rotation
  useEffect(() => {
    if (!slides || slides.length <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % slides.length), interval);
    return () => clearInterval(id);
  }, [slides, interval]);

  if (!slides || slides.length === 0) return null;

  return (
    <div className="absolute inset-0 overflow-hidden">
      {slides.map((s, i) => (
        <div
          key={i}
          role="img"
          aria-label={`slide-${i}`}
          className={`absolute inset-0 bg-cover bg-center transition-opacity duration-700 ease-out ${i === index ? 'opacity-100 z-0' : 'opacity-0 z-0'}`}
          style={{ backgroundImage: `url(${s.image})` }}
        />
      ))}

      {/* dark overlay above slides but below page content */}
      <div className="absolute inset-0 bg-black/45 z-10 pointer-events-none" />

      {/* Controls */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="flex items-center gap-3 absolute bottom-3 sm:bottom-8 pointer-events-auto">
          <button
            aria-label="previous"
            onClick={() => setIndex((i) => (i - 1 + slides.length) % slides.length)}
            className="bg-black/50 text-white rounded-full p-2 hover:bg-black/60 shadow"
          >
            ‹
          </button>
          <button
            aria-label="next"
            onClick={() => setIndex((i) => (i + 1) % slides.length)}
            className="bg-black/50 text-white rounded-full p-2 hover:bg-black/60 shadow"
          >
            ›
          </button>
        </div>
      </div>

      {/* Left caption (matches screenshot) */}
      <div className="absolute left-6 right-6 sm:right-auto bottom-14 sm:bottom-6 text-left text-white z-30 pointer-events-none sm:max-w-[60%]">
        <div className="bg-black/40 px-2 py-1 rounded-md backdrop-blur-sm inline-flex items-center gap-2 whitespace-nowrap overflow-hidden w-full">
          <h3 className="text-[11px] sm:text-sm font-bold text-teal-300">{slides[index].title || 'School'}</h3>
          <span className="text-[11px] sm:text-xs italic text-white/90">{slides[index].caption || 'the beacon of knowledge'}</span>
        </div>
      </div>
    </div>
  );
}
