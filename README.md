# Photo App — starter scaffold

A minimal Expo + TypeScript starter with the four core tabs wired up
(Home, Submit, Rankings, Profile) using placeholder/mock data.

## Setup

1. Install Node.js (LTS) if you don't have it.
2. Unzip this folder, then from inside it run:
   ```
   npm install
   npx expo install react-native-screens react-native-safe-area-context
   npm start
   ```
3. Scan the QR code with the Expo Go app on your phone (iOS or Android),
   or press `i` / `a` in the terminal to open an iOS/Android simulator.

## What's here

- `App.tsx` — app entry point, wraps everything in navigation.
- `src/navigation/AppNavigator.tsx` — the bottom tab bar linking the 4 screens.
- `src/screens/` — one file per screen, each with mock/hardcoded data so
  the app runs and looks right before any backend is connected.

## Suggested next steps

1. Create a Supabase project (supabase.com) and add your project URL +
   anon key to a `.env` file (use `expo-constants` or `react-native-dotenv`
   to load them).
2. Create a `submissions` table (id, user_id, image_url, theme_id, format,
   vote_count, created_at) and swap the mock arrays in `HomeScreen.tsx`
   and `RankingsScreen.tsx` for real Supabase queries.
3. Add `expo-image-picker` to let `CameraScreen.tsx` actually take/select
   a photo and upload it to Supabase Storage.
4. Add a `themes` table with a `start_date`/`end_date` so the theme
   banner and submission window enforce automatically instead of being
   hardcoded.
