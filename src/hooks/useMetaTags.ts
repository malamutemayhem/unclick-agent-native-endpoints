import { useEffect } from "react";

interface MetaTagsOptions {
  title: string;
  description?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogUrl?: string;
}

function setMeta(property: string, content: string) {
  const attr = property.startsWith("og:") || property.startsWith("twitter:") ? "property" : "name";
  let el = document.querySelector(`meta[${attr}="${property}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, property);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

const defaultTitle = "UnClick - Agent rails for tools, memory, and QC";

export function useMetaTags({ title, description, ogTitle, ogDescription, ogUrl }: MetaTagsOptions) {
  useEffect(() => {
    document.title = title;

    if (ogTitle) {
      setMeta("og:title", ogTitle);
      setMeta("twitter:title", ogTitle);
    }
    if (ogDescription) {
      setMeta("og:description", ogDescription);
      setMeta("twitter:description", ogDescription);
    }
    if (ogUrl) {
      setMeta("og:url", ogUrl);
    }
    if (description) {
      setMeta("description", description);
    }

    return () => {
      document.title = defaultTitle;
      setMeta("og:title", defaultTitle);
      setMeta("twitter:title", defaultTitle);
      setMeta("og:url", "https://unclick.world/");
    };
  }, [title, description, ogTitle, ogDescription, ogUrl]);
}
