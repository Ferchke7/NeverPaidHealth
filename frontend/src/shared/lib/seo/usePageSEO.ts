import { useEffect } from 'react';

export interface PageSEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  canonicalPath?: string;
  ogImage?: string;
}

const DEFAULT_TITLE = 'duda.uz — Бесплатный трекер тренировок, AI-дневник питания и расчет блинов';
const DEFAULT_DESC =
  '100% бесплатная замена Hevy и Strong без подписок и рекламы. Журнал подходов, раскладка блинов на гриф, таймер отдыха, AI-подсчет калорий по фото и персональный тренер онлайн на duda.uz.';

export function usePageSEO({
  title,
  description,
  keywords,
  canonicalPath = '',
  ogImage,
}: PageSEOProps = {}) {
  useEffect(() => {
    // 1. Update Document Title
    const formattedTitle = title
      ? `${title} | duda.uz — Бесплатный трекер тренировок`
      : DEFAULT_TITLE;
    document.title = formattedTitle;

    // Helper to safely set meta attribute content
    const setMetaTag = (selector: string, content: string) => {
      let element = document.querySelector(selector) as HTMLMetaElement | null;
      if (!element) {
        element = document.createElement('meta');
        if (selector.startsWith('meta[name=')) {
          const name = selector.match(/name="([^"]+)"/)?.[1];
          if (name) element.setAttribute('name', name);
        } else if (selector.startsWith('meta[property=')) {
          const property = selector.match(/property="([^"]+)"/)?.[1];
          if (property) element.setAttribute('property', property);
        }
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    // 2. Meta Description & Title
    const activeDesc = description || DEFAULT_DESC;
    setMetaTag('meta[name="description"]', activeDesc);
    setMetaTag('meta[name="title"]', formattedTitle);

    // 3. OpenGraph Tags
    setMetaTag('meta[property="og:title"]', formattedTitle);
    setMetaTag('meta[property="og:description"]', activeDesc);
    if (ogImage) {
      setMetaTag('meta[property="og:image"]', ogImage);
    }

    // 4. Keywords if provided
    if (keywords) {
      setMetaTag('meta[name="keywords"]', keywords);
    }

    // 5. Canonical Link
    const cleanPath = canonicalPath.startsWith('/') ? canonicalPath : `/${canonicalPath}`;
    const canonicalUrl = `https://duda.uz${cleanPath === '/' ? '' : cleanPath}`;
    let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', canonicalUrl);
  }, [title, description, keywords, canonicalPath, ogImage]);
}
