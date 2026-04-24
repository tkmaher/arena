import { Metadata } from "next";

export const staticMetadata: Metadata = {
    metadataBase: new URL("https://arena-flow.org/"),
    applicationName: "arena flow",
    title: {
      template: 'arena flow | %s',
      default: 'arena flow', // a default is required when creating a template
    },
    description: "arena-flow.org is a directed graph of are.na. Click the canvas to add a node. Click a node to see its parents and children.",
    keywords: ["are.na", "content-aggregator", "pinterest", "visuals", "images", "media"],
    robots: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
      googleBot: "index, follow"
    },
    openGraph: {
      locale: "en_US",
      siteName: "arena flow | A directed graph of are.na",
      url: "https://arena-flow.org/",
      type: "website",
      images: [
        {
          url: "https://arena-flow.org/logo.png",
          width: 1200,
          height: 630,
          alt: "arena flow"
        }
      ]
    },
    twitter: {
      card: "summary_large_image",
      title: "arena flow | A directed graph of are.na",
      
      images: [
        {
          url: "https://arena-flow.org/logo.png",
          width: 1200,
          height: 630,
          alt: "arena flow"
        }
      ]
    }
  };