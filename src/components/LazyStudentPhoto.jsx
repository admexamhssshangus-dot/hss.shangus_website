import React, { useState, useEffect, useRef } from 'react';
import { getStudentPhotoUrl } from '../utils/imageCompressor';
import { fetchStudentPhotoOnDemand } from '../services/dbCache';

// In-memory cache for resolved image URLs
const resolvedPhotoMemoryCache = new Map();

/**
 * Helper to resolve the best photo URL for a student object
 */
export function resolveStudentPhoto(student) {
  if (!student || typeof student !== 'object') return null;

  // This resolver applies registration and class-band precedence before using
  // a legacy inline value, preventing stale record photos from winning.
  return getStudentPhotoUrl(student, '') || null;
}

/**
 * LazyStudentPhoto component
 * Uses IntersectionObserver to defer photo rendering until the row/card enters the viewport.
 */
export default function LazyStudentPhoto({
  student,
  alt = 'Student Photo',
  className = 'w-9 h-9 rounded-md object-cover border border-slate-300 dark:border-slate-700 shadow-2xs',
  containerClassName = 'relative flex-shrink-0 flex items-center justify-center',
  onClick,
  fallbackText = ''
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [photoSrc, setPhotoSrc] = useState(null);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef(null);

  const studentKey = String(
    student?.boardRegNo ||
    student?.regNo ||
    student?.['Board Registration Number'] ||
    student?.id ||
    student?.formNo ||
    student?.['Form Number'] ||
    student?.docId ||
    `${student?.name || student?.studentName || ''}_${student?.father || student?.fatherName || ''}_${student?.dob || ''}` ||
    'unknown'
  ).trim();

  // IntersectionObserver to detect when component is near the viewport
  useEffect(() => {
    if (typeof window === 'undefined' || !window.IntersectionObserver) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '120px', // Preload when within 120px of viewport
        threshold: 0.01
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Resolve photo source when visible
  useEffect(() => {
    if (!isVisible || !student) return;

    if (resolvedPhotoMemoryCache.has(studentKey)) {
      setPhotoSrc(resolvedPhotoMemoryCache.get(studentKey));
      setIsLoading(false);
      return;
    }

    const resolved = resolveStudentPhoto(student);
    if (resolved) {
      resolvedPhotoMemoryCache.set(studentKey, resolved);
      setPhotoSrc(resolved);
      setIsLoading(false);
    } else {
      // Only rows near the viewport perform a targeted studentPhotos read.
      // This replaces collection-wide photo preloads.
      fetchStudentPhotoOnDemand(student)
        .then((photo) => {
          if (photo) {
            resolvedPhotoMemoryCache.set(studentKey, photo);
            setPhotoSrc(photo);
          }
        })
        .catch(() => setPhotoSrc(null))
        .finally(() => setIsLoading(false));
      return;
    }
  }, [isVisible, student, studentKey]);

  const initials = (fallbackText || student?.studentName || student?.['Student Name'] || 'ST')
    .toString()
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();

  return (
    <div ref={containerRef} className={`${containerClassName} ${className}`} onClick={onClick}>
      {/* Loading Skeleton */}
      {isLoading && !photoSrc && (
        <div className="absolute inset-0 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-inherit" />
      )}

      {/* Render Image if available and not errored */}
      {isVisible && photoSrc && !hasError ? (
        <img
          src={photoSrc}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setHasError(true)}
          className={`${className} transition-opacity duration-200 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
        />
      ) : (
        /* Fallback Initials / Avatar */
        <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-black text-[10px] select-none rounded-inherit">
          {initials || '—'}
        </div>
      )}
    </div>
  );
}
