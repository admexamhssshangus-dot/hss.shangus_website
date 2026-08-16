import React, { useState, useEffect } from 'react';
import * as LucideIcons from 'lucide-react';
import SEO from './SEO';

// Helper to render Lucide Icons dynamically
const DynamicIcon = ({ name, className = '', size = 24 }) => {
  const IconComponent = LucideIcons[name] || LucideIcons.HelpCircle;
  return <IconComponent className={className} size={size} />;
};

export default function DynamicPageRenderer({ pageData, pageId }) {
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [lightboxImages, setLightboxImages] = useState([]);
  
  const blocks = pageData?.blocks || [];
  const title = pageData?.title || 'Govt HSS Shangus';
  const seoTitle = pageData?.seoTitle || `${title} | Govt. HSS Shangus`;
  const seoDescription = pageData?.seoDescription || `Explore pages and details about Govt. Higher Secondary School Shangus.`;

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (lightboxIndex === null) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowRight') {
        setLightboxIndex((prev) => (prev + 1) % lightboxImages.length);
      }
      if (e.key === 'ArrowLeft') {
        setLightboxIndex((prev) => (prev - 1 + lightboxImages.length) % lightboxImages.length);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxIndex, lightboxImages]);

  const openLightbox = (images, index) => {
    setLightboxImages(images);
    setLightboxIndex(index);
  };

  return (
    <div className="w-full mb-20">
      <SEO title={seoTitle} description={seoDescription} />
      
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'hero': {
            const bgUrl = block.bgImage || '/slides/aboutus.jpg';
            const bgOpacity = block.bgOpacity !== undefined ? block.bgOpacity : 30;
            const heightClass = block.height === 'large' ? 'h-[400px] sm:h-[500px]' : 'h-[300px] sm:h-[380px]';
            
            return (
              <div 
                key={index} 
                className={`relative w-full bg-slate-900 flex items-center justify-center text-center overflow-hidden ${heightClass}`}
              >
                <div 
                  className="absolute inset-0 bg-cover bg-center transition-all duration-700 hover:scale-105"
                  style={{ 
                    backgroundImage: `url(${bgUrl})`,
                    opacity: bgOpacity / 100 
                  }}
                ></div>
                <div className="absolute inset-0 bg-black/50"></div>
                <div className="relative z-10 px-4 max-w-4xl mx-auto">
                  <h2 className="text-2xl sm:text-3xl md:text-5xl font-extrabold text-white mb-3 tracking-tight drop-shadow-md">
                    {block.title || pageData.title}
                  </h2>
                  {block.subtitle && (
                    <p className="text-base sm:text-xl font-medium text-slate-200 drop-shadow-sm max-w-2xl mx-auto">
                      {block.subtitle}
                    </p>
                  )}
                </div>
              </div>
            );
          }

          case 'text_section': {
            const paragraphs = (block.content || '')
              .split('\n\n')
              .filter(p => p.trim() !== '');

            return (
              <div key={index} className="max-w-4xl mx-auto px-4 py-12">
                {(block.heading || block.subheading) && (
                  <div className="mb-6">
                    {block.heading && (
                      <h3 className="text-2xl sm:text-3xl font-bold text-teal-800 tracking-tight">
                        {block.heading}
                      </h3>
                    )}
                    {block.subheading && (
                      <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mt-1">
                        {block.subheading}
                      </p>
                    )}
                    <div className="h-1 w-16 bg-teal-600 rounded mt-3"></div>
                  </div>
                )}
                <div className="space-y-4 text-slate-700 leading-relaxed text-sm sm:text-base">
                  {paragraphs.map((p, pIdx) => (
                    <p key={pIdx} className="whitespace-pre-wrap">{p}</p>
                  ))}
                </div>
              </div>
            );
          }

          case 'photo_gallery': {
            const galleryImages = block.images || [];
            
            return (
              <div key={index} className="max-w-6xl mx-auto px-4 py-12">
                {block.title && (
                  <div className="mb-8 text-center">
                    <h3 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
                      {block.title}
                    </h3>
                    <div className="h-1 w-12 bg-teal-600 mx-auto mt-2 rounded"></div>
                  </div>
                )}
                
                {galleryImages.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-sm border border-dashed rounded-lg">
                    No images in gallery yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                    {galleryImages.map((img, imgIdx) => (
                      <div 
                        key={imgIdx} 
                        onClick={() => openLightbox(galleryImages, imgIdx)}
                        className="bg-white rounded-xl shadow-md overflow-hidden border border-slate-200 cursor-pointer group hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
                      >
                        <div className="relative aspect-video overflow-hidden bg-slate-100">
                          <img 
                            src={img.url} 
                            alt={img.caption || 'Gallery item'} 
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                        </div>
                        {img.caption && (
                          <div className="p-3.5 border-t border-slate-100 bg-slate-50/50">
                            <p className="text-xs sm:text-sm text-slate-700 font-medium line-clamp-2">
                              {img.caption}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          case 'info_cards': {
            const cards = block.cards || [];
            const colClass = block.columns === 4 
              ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' 
              : block.columns === 2 
                ? 'grid-cols-1 sm:grid-cols-2' 
                : 'grid-cols-1 md:grid-cols-3';

            return (
              <div key={index} className="max-w-6xl mx-auto px-4 py-12">
                {block.title && (
                  <div className="mb-8 text-center">
                    <h3 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
                      {block.title}
                    </h3>
                    <div className="h-1 w-12 bg-teal-600 mx-auto mt-2 rounded"></div>
                  </div>
                )}
                
                <div className={`grid gap-8 ${colClass}`}>
                  {cards.map((card, cIdx) => (
                    <div 
                      key={cIdx}
                      className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group"
                    >
                      {/* Decorative Background Icon */}
                      {card.iconName && (
                        <div className="absolute -right-4 -bottom-4 text-slate-200/30 group-hover:scale-110 transition-transform duration-500">
                          <DynamicIcon name={card.iconName} size={80} />
                        </div>
                      )}
                      
                      <div className="flex flex-col items-start gap-4">
                        {card.iconName && (
                          <div className="p-3 rounded-xl bg-teal-600 text-white shadow-md shadow-teal-600/10 group-hover:rotate-3 transition-transform duration-300">
                            <DynamicIcon name={card.iconName} size={20} />
                          </div>
                        )}
                        <div className="space-y-2 relative z-10">
                          <h4 className="text-lg font-bold text-slate-900 leading-snug">
                            {card.title}
                          </h4>
                          <p className="text-slate-600 text-sm leading-relaxed">
                            {card.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          }

          case 'accordion': {
            const accordionItems = block.items || [];
            return (
              <div key={index} className="max-w-4xl mx-auto px-4 py-12">
                {block.title && (
                  <div className="mb-6">
                    <h3 className="text-xl sm:text-2xl font-bold text-slate-800">
                      {block.title}
                    </h3>
                    <div className="h-1 w-12 bg-teal-600 mt-2 rounded"></div>
                  </div>
                )}
                
                <div className="space-y-3.5">
                  {accordionItems.map((item, itemIdx) => (
                    <AccordionRow key={itemIdx} title={item.title} content={item.content} />
                  ))}
                </div>
              </div>
            );
          }

          default:
            return null;
        }
      })}

      {/* Lightbox Modal */}
      {lightboxIndex !== null && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setLightboxIndex(null)}
        >
          <button 
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
            onClick={() => setLightboxIndex(null)}
          >
            <LucideIcons.X size={28} />
          </button>

          <div className="relative max-w-5xl w-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            {lightboxImages.length > 1 && (
              <button 
                className="absolute left-2 sm:left-4 z-10 text-white/70 hover:text-white p-2 rounded-full hover:bg-white/10 bg-black/35 transition-colors"
                onClick={() => setLightboxIndex((prev) => (prev - 1 + lightboxImages.length) % lightboxImages.length)}
              >
                <LucideIcons.ChevronLeft size={32} />
              </button>
            )}

            <div className="flex flex-col items-center max-h-[80vh] overflow-hidden select-none">
              <img 
                src={lightboxImages[lightboxIndex].url} 
                alt={lightboxImages[lightboxIndex].caption || 'Lightbox View'} 
                className="max-h-[72vh] max-w-full object-contain rounded shadow-2xl animate-fade-in"
              />
              {lightboxImages[lightboxIndex].caption && (
                <p className="text-white text-center text-sm md:text-base mt-4 font-medium px-4 py-1.5 bg-black/40 rounded max-w-2xl leading-normal">
                  {lightboxImages[lightboxIndex].caption}
                </p>
              )}
            </div>

            {lightboxImages.length > 1 && (
              <button 
                className="absolute right-2 sm:right-4 z-10 text-white/70 hover:text-white p-2 rounded-full hover:bg-white/10 bg-black/35 transition-colors"
                onClick={() => setLightboxIndex((prev) => (prev + 1) % lightboxImages.length)}
              >
                <LucideIcons.ChevronRight size={32} />
              </button>
            )}
          </div>
          
          <div className="text-white/60 text-xs mt-4 select-none">
            {lightboxIndex + 1} / {lightboxImages.length}
          </div>
        </div>
      )}
    </div>
  );
}

function AccordionRow({ title, content }) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="border border-slate-200 bg-white rounded-xl shadow-sm overflow-hidden transition-all duration-300">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 text-left font-semibold text-slate-800 hover:bg-slate-50 transition-colors"
      >
        <span className="text-sm sm:text-base pr-4 leading-normal">{title}</span>
        <div className={`text-teal-600 transition-transform duration-300 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}>
          <LucideIcons.ChevronDown size={20} />
        </div>
      </button>
      <div 
        className={`transition-all duration-300 overflow-hidden ${
          isOpen ? 'max-h-[1000px] border-t border-slate-100' : 'max-h-0'
        }`}
      >
        <div className="p-4 text-slate-600 text-sm sm:text-base leading-relaxed whitespace-pre-wrap">
          {content}
        </div>
      </div>
    </div>
  );
}
