# LifeBestie — Beta Testing Checklist

## Running the project locally

### Type check
```bash
npm run typecheck
```
> Pre-existing unused-variable warnings exist in `LifeBestieAvatar.tsx`, `useBestiePersonalization.ts`, and `ChatPage.tsx` — these are safe to ignore for beta.

### Build
```bash
npm run build
```
Output goes to `dist/`. Should complete with no errors.

### Preview the built app
```bash
npm run preview
```
Opens on `http://localhost:4173` by default.

---

## Installing on your phone (PWA)

### Android (Chrome)
1. Open the app URL in Chrome.
2. Tap the 3-dot menu → **Add to Home Screen**.
3. Confirm. The LifeBestie icon appears on your home screen.
4. Launch from the home screen — it should open in standalone (full-screen) mode with no browser chrome.

### iPhone (Safari)
1. Open the app URL in Safari.
2. Tap the **Share** icon (box with arrow).
3. Scroll down and tap **Add to Home Screen**.
4. Confirm. Launch from home screen.
> Note: iOS does not support push notifications via PWA. This is expected for beta.

---

## What to test on phone

### Core flows
- [ ] Sign up / sign in with email + password
- [ ] Onboarding completes and character is selected
- [ ] Home page loads with correct bestie and greeting
- [ ] Add a task, add an event (planner)
- [ ] Add a grocery item; add a weekly list item
- [ ] Add a meal with ingredients
- [ ] Log a movement activity
- [ ] Create and run a routine
- [ ] Chat with AI bestie
- [ ] My Bestie page loads: character picker, relationship card, expressions, memories
- [ ] Settings page: switch theme, change bestie character

### PWA / mobile checks
- [ ] App installs from browser to home screen
- [ ] Launches in standalone (no browser bar)
- [ ] Bottom navigation is fully tappable — no buttons obscured by home indicator
- [ ] Floating bestie avatar does not overlap key action buttons
- [ ] Page scrolls smoothly without layout breaking
- [ ] No horizontal overflow / scroll on any page
- [ ] Keyboard opens without breaking layout (forms on Add / Chat pages)
- [ ] Bestie animations play on device (breathing, head bob, celebrating)

### Relationship level system
- [ ] Relationship card visible on My Bestie page
- [ ] Score increases after: adding tasks, events, groceries, meals, movement
- [ ] Opening the app on a new day awards 15 pts
- [ ] Level label updates as score crosses 100 / 300 / 600
- [ ] Progress bar reflects current progress to next level

---

## Tester feedback questions

Please answer these after testing:

1. **Installation** — Did the app install to your home screen successfully? Which device/OS?
2. **First impression** — How did the onboarding feel? Was anything confusing?
3. **Navigation** — Were all bottom nav tabs easy to tap? Anything hard to reach?
4. **Floating bestie** — Did the avatar ever block a button or form field you needed?
5. **Performance** — Did any screen feel slow to load or janky to scroll?
6. **Animations** — Did the bestie animations look smooth or choppy on your device?
7. **Relationship card** — Did your score increase as you used the app? Did it feel rewarding?
8. **Grocery list** — Did adding items and checking them off work reliably?
9. **AI chat** — Did the chat respond correctly? Any errors?
10. **Overall** — On a scale of 1–10, how polished does this feel for a beta? What's the one thing you'd fix first?

---

## Known not-yet-ready items

These are intentionally out of scope for this beta:

- **Payments / subscriptions** — No payment system is integrated yet. All features are free during beta.
- **App Store / Play Store release** — PWA only for now. Native packaging (Capacitor) is a future step.
- **Premium subscriptions** — Planned but not designed or built yet.
- **Push notifications** — Not available in PWA on iOS; deferred.
- **Offline mode** — App requires an internet connection (Supabase). Offline caching is a future step.
- **Family Hub / Chore Tracking / School Tracker** — Modules visible in settings but marked Coming Soon.

---

## Icon placeholder note

`public/icons/icon.svg` is a placeholder heart icon. Before a public launch, replace it with:
- `public/icons/icon-192.png` (192×192 PNG)
- `public/icons/icon-512.png` (512×512 PNG)
- `public/icons/apple-touch-icon.png` (180×180 PNG)

Then update `manifest.webmanifest` to reference the PNGs with their correct `sizes` values.
