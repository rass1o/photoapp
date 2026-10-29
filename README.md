# ShuttInk

**A photo challenge app that keeps photographers shooting.**

Most people who pick up a camera stop practising. Without a reason to go out
and shoot, the camera stays in the bag. ShuttInk gives you that reason: a new
theme each week, a quick daily photo, and a community of friends shooting
alongside you. Each theme pushes you to try a different subject, technique or
style, so you keep shooting and keep getting better.

ShuttInk welcomes film and digital photographers equally. Every photo is
tagged with the format it was shot on, so film shooters can show off their
stocks and digital shooters can see what film looks like.

## How it works

### Weekly theme
- A new theme goes live every week, for example "Reflections", "Golden hour"
  or "Motion".
- You get **one submission per theme**, so pick your best shot.
- Tag the photo as **Film** or **Digital**. Film shooters can add a **film
  stamp** for the stock they used (Portra 400, HP5 and so on).
- Other people like photos during the week. When the theme ends, the **global
  top 5** earn shutters: 50, 40, 30, 20 and 15 for 1st through 5th.
- Submitting to back-to-back themes builds your **weekly streak**.

### Daily photo
- Snap or upload one photo a day of whatever you're up to. It has no theme
  and no pressure.
- Each daily photo earns **+1 shutter** and grows your **daily streak**. The
  day resets at your local midnight.

### Learning built in
- The submit screen has an **exposure cheat sheet** that explains aperture,
  shutter speed and ISO in plain language. Use it when a theme asks for
  something new, like freezing motion or shooting at night.
- Browse what others did with the same theme to see different ways to
  approach it.

### Friends and community
- Add friends from their profiles. Requests show up as a live pop-up and in
  your inbox.
- Switch the **Home** feed and **Rankings** between **Friends** and
  **Global**.
- Like and comment on photos. You can't like your own.
- The **notifications** inbox collects likes, comments and friend activity.
- Profiles show your latest photos. **See all** opens your full gallery,
  which you can filter by Film or Digital.

### Ocho and the shop
- Spend shutters in the **Shop** on accessories for **Ocho**, your octopus
  mascot, as well as film stamps and theme tickets.
- The **Clam blind box** costs 100 shutters and gives you 2 random
  accessories. Tap it to see the odds.

## Tech stack

- **App:** Expo SDK 58, React Native, TypeScript, React Navigation
- **Backend:** Supabase (Postgres, Auth, Storage, Realtime). Rewards,
  payouts, streaks and blind boxes run in server-side functions, so the app
  can't change balances itself.
- **Look:** an under-the-sea theme with sand and water colours, the Fredoka
  font and SVG waves (`src/theme.ts`)

## Project layout

```
App.tsx                     entry point: fonts, auth, notifications, navigation
src/navigation/             bottom tabs inside a native stack
src/screens/                one file per screen (Home, Camera, Rankings, Profile, Shop, ...)
src/components/             shared UI (Ocho, Clam, Wave, FormatTag, modals, ...)
src/context/                AuthContext, NotificationsContext
src/lib/                    Supabase client and data helpers (friends, shop, uploads, ...)
supabase/migrations/        SQL for tables, row-level security, triggers and functions
```

## Running it locally

1. Install Node.js (LTS), then install dependencies:
   ```
   npm install
   ```
2. Create a `.env` file in the project root with your Supabase project's
   values. The file is gitignored, so never commit it.
   ```
   EXPO_PUBLIC_SUPABASE_URL=...
   EXPO_PUBLIC_SUPABASE_ANON_KEY=...
   ```
3. Run the files in `supabase/migrations/` in date order in the Supabase SQL
   Editor. They build on the base tables (`profiles`, `themes`,
   `submissions`, `votes`, `comments`, `daily_submissions`), which were set
   up in the Supabase dashboard.
4. Start the dev server and scan the QR code with **Expo Go**:
   ```
   npm start
   ```

## Sharing with testers

Testers open the app in Expo Go from the permanent link on the `preview`
channel. To ship a change to them:

```
npx eas-cli update --branch preview --environment preview --message "What changed"
```

When testers open the link again, they get the new version. Changes to the
SQL take effect as soon as you run them in Supabase and don't need a publish.

## What's next

- Push notifications on the lock screen. These need a standalone build
  instead of Expo Go.
- Editing or deleting a weekly submission
- Rarer accessories for the blind box
