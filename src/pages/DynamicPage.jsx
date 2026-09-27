import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import DynamicPageRenderer from '../components/DynamicPageRenderer';
import { FileQuestion, Home } from 'lucide-react';
import PublicPageSkeleton from '../components/PublicPageSkeleton';

export default function DynamicPage() {
  const { pageId } = useParams();
  const [pageData, setPageData] = useState(() => {
    try {
      const raw = sessionStorage.getItem(`site_page_${pageId}`) || localStorage.getItem(`site_page_${pageId}`);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return null;
  });
  const [loading, setLoading] = useState(() => {
    try {
      return !(sessionStorage.getItem(`site_page_${pageId}`) || localStorage.getItem(`site_page_${pageId}`));
    } catch (_) {
      return true;
    }
  });
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setNotFound(false);

    async function fetchPage() {
      const pageTsKey = `site_page_${pageId}_ts`;
      const lastTs = Number(sessionStorage.getItem(pageTsKey) || localStorage.getItem(pageTsKey) || 0);
      const isFresh = (Date.now() - lastTs) < 30 * 60 * 1000;
      if (isFresh && pageData) {
        setLoading(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'site', `page_${pageId}`));
        if (!active) return;
        
        if (snap.exists()) {
          const data = snap.data();
          if (data.isActive !== false) {
            setPageData(data);
            try {
              sessionStorage.setItem(`site_page_${pageId}`, JSON.stringify(data));
              sessionStorage.setItem(`site_page_${pageId}_ts`, Date.now().toString());
              localStorage.setItem(`site_page_${pageId}`, JSON.stringify(data));
              localStorage.setItem(`site_page_${pageId}_ts`, Date.now().toString());
            } catch (_) {}
          } else {
            setNotFound(true);
          }
        } else {
          setNotFound(true);
        }
      } catch (err) {
        console.error("Error loading dynamic page:", err);
        if (active) setNotFound(true);
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchPage();
    return () => {
      active = false;
    };
  }, [pageId]);

  if (loading) {
    return <PublicPageSkeleton label="Loading page content…" />;
  }

  if (notFound) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 py-20 text-center bg-slate-50">
        <div className="p-4 bg-teal-50 text-teal-600 rounded-full mb-6 ring-8 ring-teal-100/50">
          <FileQuestion size={48} className="stroke-[1.5]" />
        </div>
        <h2 className="text-3xl font-extrabold text-slate-800 mb-3 tracking-tight">Page Not Found</h2>
        <p className="text-slate-500 max-w-md mx-auto mb-8 text-sm sm:text-base leading-relaxed">
          The page you are looking for doesn't exist, was renamed, or has been disabled by the administrator.
        </p>
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 px-6 py-3 btn-primary-custom rounded-full font-bold shadow text-sm tracking-wider uppercase transition-transform hover:-translate-y-0.5"
        >
          <Home size={16} />
          Go to Home
        </Link>
      </div>
    );
  }

  return <DynamicPageRenderer pageData={pageData} pageId={pageId} />;
}
