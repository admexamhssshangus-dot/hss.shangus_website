import { useEffect } from 'react';

export default function SEO({ title, description }) {
  useEffect(() => {
    // 1. Update Document Title
    const baseTitle = "Govt. Higher Secondary School Shangus";
    document.title = title ? `${title} | ${baseTitle}` : baseTitle;

    // 2. Update Description Meta Tag
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && description) {
      metaDesc.setAttribute('content', description);
    }
  }, [title, description]);

  return null;
}
