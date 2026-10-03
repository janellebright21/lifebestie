# Emma character refinement

Prepared directly by Codex, without Bolt AI. Not applied or deployed to the live Bolt project.

Includes a new transparent 3D happy portrait that preserves Emma's brown curls, lavender top and gold jewelry; other expressions retain their existing artwork. Rendering keeps the portrait inside the frame, waits for new expression images before fading, removes the synthetic blink stripe from Emma, softens pointer tilt, stops the tilt loop at rest and respects reduced motion. This is a rendered image with UI motion, not a rigged 3D model.

Personality V3 adds more natural conversational responses, listening before advice and clearer capability boundaries. Memory context now includes saved values. Failed memory saves show a failure instead of confirmation. Exact duplicate labels can update; substring matches no longer silently replace distinct memories. Failed updates/deletes preserve the displayed data.

## Apply without Bolt AI

Run `node /path/to/apply-emma.cjs /path/to/latest-project`. All preconditions are checked before changing files. Original files are backed up. If a frontend file differs from the reviewed export, the installer stops for manual merging. It patches ONLY the personality and memory portions of emma-chat, preserving Version 158's billing/quota changes. No secrets or database migrations are included.

Run `npm run typecheck` and `npm run build` afterward. Deploy the updated emma-chat function using the project's normal backend deployment. Publish the frontend only after preview checks.

## Validation

TypeScript: PASS on the reviewed local project.
Production build: PASS using Vite's JavaScript build API with the same React plugin; standard config-loader command was blocked by the filesystem sandbox.
Live browser behavior, AI response quality, memory save/retry, reduced-motion interaction and backend deployment: NOT TESTED.

The installer intentionally does not replace the complete older project, billing files, account settings, or any secrets.

Artwork created with the built-in image-generation tool using the existing happy portrait as edit target. Prompt: preserve identity, curly chestnut updo, brown eyes, tan skin, lavender sweatshirt, gold hoops and pendant; refine into softly lit stylized 3D; transparent background; no text or added props.

## Animation update
Includes a distinct listening nod and automatic return to idle after one-shot gestures, including a fallback when reduced motion disables animation events. The separate emma-animation-preview.html is a self-contained interactive portrait preview with eight movement choices and pause/resume. Animation timing was not visually verified in a browser.
