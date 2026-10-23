# LexalysClips — web UI (Next.js)

The studio interface. The video engine and API stay in `../server.js` (port 4545).

## Editing the UI
```
cd web
npm install        # first time only
npm run dev        # live-reload UI at http://localhost:3000 (talks to the server on :4545)
```
When you're happy, publish it to the always-on app:
```
npm run build      # writes web/out — server.js serves it at http://localhost:4545
```
No server restart is needed after a build — just refresh the browser.

## Where things are
| Want to change…               | Edit                                         |
|-------------------------------|----------------------------------------------|
| App name, default handle/outro| `config/brand.ts`                            |
| Colours (accent, backgrounds) | `app/globals.css` → the `:root` block at top |
| UI font                       | `app/layout.tsx`                             |
| Buttons / inputs look         | `app/globals.css` → `@layer components`      |
| Studio page                   | `app/page.tsx` + `components/studio/*`       |
| Templates page                | `app/templates/page.tsx`                     |
| Queue page                    | `app/queue/page.tsx`                         |
| Template mini-preview         | `components/TemplatePreview.tsx`             |
| Platform logos                | `components/PlatformIcon.tsx`                |
| Data loading & saving         | `components/StudioProvider.tsx`, `lib/api.ts`|
