import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "PattePilot",
    short_name: "PattePilot",
    description: "Gestion Association Protection Animale",
    start_url: "/",
    display: "standalone",
    display_override: ["fullscreen", "minimal-ui"],
    background_color: "#ffffff",
    theme_color: "#000000",
    orientation: "any",
    icons: [
      {
        src: "/icon_192_192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon_512_512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
    screenshots: [
      {
        src: "/screenshots/desktop-pattepilot.png",
        sizes: "1280x720",
        type: "image/png",
        form_factor: "wide",
      },
      {
        src: "/screenshots/mobile-pattepilot.png",
        sizes: "375x667",
        type: "image/png",
      },
    ] as any,
  };
}
