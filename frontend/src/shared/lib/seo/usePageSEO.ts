import { useEffect } from 'react';
import { useTranslation } from '../i18n/i18n.ts';

export type SEOPageKey =
  | 'workouts'
  | 'exercises'
  | 'nutrition'
  | 'coach'
  | 'todo'
  | 'progress'
  | 'programs'
  | 'login';

export interface PageSEOProps {
  pageKey?: SEOPageKey;
  title?: string;
  description?: string;
  keywords?: string;
  canonicalPath?: string;
  ogImage?: string;
}

export function usePageSEO({
  pageKey,
  title,
  description,
  keywords,
  canonicalPath = '',
  ogImage,
}: PageSEOProps = {}) {
  const { language, t } = useTranslation();

  useEffect(() => {
    // 1. Determine title and description based on pageKey or explicit overrides
    let pageTitle = title;
    let pageDesc = description;

    if (pageKey) {
      if (!pageTitle) {
        pageTitle = t(`seo.${pageKey}Title`);
      }
      if (!pageDesc) {
        pageDesc = t(`seo.${pageKey}Desc`);
      }
    }

    const defaultTitle = t('seo.defaultTitle') || 'duda.uz — Free Workout Tracker & AI Calorie Counter';
    const siteName = t('seo.siteName') || 'duda.uz';
    const tagline = t('seo.tagline') || 'Free Workout Tracker';
    const defaultDesc = t('seo.defaultDesc') || '100% free Hevy & Strong alternative without subscriptions or ads.';
    const defaultKeywords = t('seo.defaultKeywords') || 'free workout tracker, gym log app, hevy alternative, plate calculator, ai calorie counter, duda.uz';

    const formattedTitle = pageTitle
      ? `${pageTitle} | ${siteName} — ${tagline}`
      : defaultTitle;
    const activeDesc = pageDesc || defaultDesc;
    const activeKeywords = keywords || defaultKeywords;

    // 2. Set Document Title & HTML Lang
    document.title = formattedTitle;
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.lang = language || 'en';
    }

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

    // 3. Primary Meta Tags
    setMetaTag('meta[name="description"]', activeDesc);
    setMetaTag('meta[name="title"]', formattedTitle);
    setMetaTag('meta[name="keywords"]', activeKeywords);

    // 4. OpenGraph Tags
    setMetaTag('meta[property="og:title"]', formattedTitle);
    setMetaTag('meta[property="og:description"]', activeDesc);
    const localeMap: Record<string, string> = {
      en: 'en_US',
      ru: 'ru_RU',
      uz: 'uz_UZ',
    };
    setMetaTag('meta[property="og:locale"]', localeMap[language] || 'en_US');

    if (ogImage) {
      setMetaTag('meta[property="og:image"]', ogImage);
    }

    // 5. Twitter Card Tags
    setMetaTag('meta[name="twitter:title"]', formattedTitle);
    setMetaTag('meta[name="twitter:description"]', activeDesc);

    // 6. Canonical Link
    const cleanPath = canonicalPath.startsWith('/') ? canonicalPath : `/${canonicalPath}`;
    const canonicalUrl = `https://duda.uz${cleanPath === '/' ? '' : cleanPath}`;
    let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', canonicalUrl);
  }, [pageKey, title, description, keywords, canonicalPath, ogImage, language, t]);
}
