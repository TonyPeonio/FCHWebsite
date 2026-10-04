import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// The demo: a sample copy of the website and portal on made-up data, at an unlisted address
// (/demo-k7m2q9/, linked from nowhere and hidden from search engines). It's built from the same pages
// and code as the real site, with the parts that talk to Supabase swapped for in-browser stand-ins,
// so it can't reach real data. Built by `npm run build` after the real site; dev: `npm run dev:demo`.
export const DEMO_PATH = "demo-k7m2q9";

const src = (p: string) => resolve(import.meta.dirname, "src", p).replace(/\\/g, "/");
const SWAPS: Record<string, string> = {
  [src("lib/api.ts")]: src("demo/api.ts"),
  [src("lib/supabase.ts")]: src("demo/supabase.ts"),
  [src("app/auth.tsx")]: src("demo/auth.tsx"),
  [src("site/backend.js")]: src("demo/site-backend.js"),
};

/** Points every import of a real backend module at its demo stand-in. */
function swapBackend(): Plugin {
  return {
    name: "demo-swap-backend",
    enforce: "pre",
    async resolveId(source, importer, options) {
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      if (!resolved) return null;
      const swap = SWAPS[resolved.id.replace(/\\/g, "/").split("?")[0]];
      return swap ? { ...resolved, id: swap } : resolved;
    },
  };
}

const BANNER = `
  <div class="demo-banner" role="note">
    <p><strong>Demo with sample data.</strong> This is a sample copy of the First Choice Homes website. The projects
    under "Our Work" are made up, and inquiries aren't sent anywhere: they show up in the demo portal's Inquiries.</p>
    <div class="demo-actions"><a class="demo-btn" href="app/">Try the client portal demo →</a></div>
  </div>
  <div class="demo-tag">SAMPLE DATA</div>`;

/** Turns the real pages into their demo versions. */
function demoPages(): Plugin {
  return {
    name: "demo-pages",
    transformIndexHtml: {
      order: "pre",
      handler(html, ctx) {
        const portal = ctx.path.includes("/app/");
        html = html
          .replace(/<link rel="canonical"[^>]*>\s*/, "")
          .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\s*/, "")
          .replace(/<meta name="robots"[^>]*>\s*/, "")
          .replace("<head>", '<head>\n  <meta name="robots" content="noindex, nofollow">');
        if (portal) {
          return html
            .replace(/<title>[^<]*<\/title>/, "<title>Client Portal demo | First Choice Homes</title>")
            .replace("/src/app/main.tsx", "/src/demo/portal.tsx");
        }
        return html
          .replace(/<title>[^<]*<\/title>/, "<title>Website demo | First Choice Homes</title>")
          .replace('href="/app/"', 'href="app/"')
          .replace('href="/" class="logo-link"', 'href="./" class="logo-link"')
          .replace(/<body>/, `<body>${BANNER}`);
      },
    },
  };
}

export default defineConfig({
  base: `/${DEMO_PATH}/`,
  plugins: [swapBackend(), demoPages(), react()],
  // No VITE_ settings reach the demo, so it couldn't find the real backend even by mistake.
  envPrefix: "DEMO_",
  build: {
    outDir: `dist/${DEMO_PATH}`,
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        app: resolve(import.meta.dirname, "app/index.html"),
      },
    },
  },
});
