import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// 1. Read .env file manually so no third-party dependency is required
function loadEnv() {
  const envPath = path.join(rootDir, '.env');
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, 'utf8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      env[key] = val;
    }
  }
  return env;
}

// 2. Strict evaluation logic for all Sightengine models
export function evaluateModeration(data) {
  if (data.status !== 'success') {
    return { ok: false, reason: data.error?.message || 'Moderation API error', category: 'api_error' };
  }

  // --- Strict Nudity & 18+ (including nude sculptures & art) ---
  if (data.nudity) {
    const { sexual_activity, sexual_display, erotica, very_suggestive, context } = data.nudity;
    const isArt = (context?.art || 0) >= 0.15;
    
    // Explicit sexual acts or genitalia
    if (sexual_activity >= 0.3 || sexual_display >= 0.3) {
      return {
        ok: false,
        reason: isArt
          ? 'Artistic nudes and nude sculptures are not permitted under the strict 18+ policy.'
          : 'Adult content or nudity is not permitted.',
        category: 'nudity',
      };
    }
    // Erotica / explicit poses
    if (erotica >= 0.4) {
      return {
        ok: false,
        reason: isArt
          ? 'Artistic nudes and nude sculptures are not permitted under the strict 18+ policy.'
          : 'Erotic or adult content is not permitted.',
        category: 'nudity',
      };
    }
    // Lingerie and near-nudity (plain swimwear and beach photos are fine)
    if (very_suggestive >= 0.6) {
      return { ok: false, reason: 'Revealing or adult imagery is not permitted.', category: 'nudity' };
    }
    // Subtle sculpture / classical art rule
    if (isArt && very_suggestive >= 0.4) {
      return {
        ok: false,
        reason: 'Artistic nudes and nude sculptures are not permitted under the strict 18+ policy.',
        category: 'nudity',
      };
    }
  }

  // --- Weapons ---
  if (data.weapon?.classes) {
    const { firearm, knife } = data.weapon.classes;
    if ((firearm && firearm >= 0.6) || (knife && knife >= 0.9)) {
      return { ok: false, reason: 'Weapons and firearms are not permitted.', category: 'weapon' };
    }
  }

  // --- Violence ---
  if (data.violence?.prob >= 0.6) {
    return { ok: false, reason: 'Violent content is not permitted.', category: 'violence' };
  }

  // --- Gore & Blood ---
  if (data.gore?.prob >= 0.5) {
    return { ok: false, reason: 'Graphic gore or injury imagery is not permitted.', category: 'gore' };
  }

  // --- Hate & Extremism ---
  if (data.offensive) {
    const { nazi, confederate, supremacist, terrorist } = data.offensive;
    if (
      (nazi && nazi >= 0.4) ||
      (confederate && confederate >= 0.4) ||
      (supremacist && supremacist >= 0.4) ||
      (terrorist && terrorist >= 0.4)
    ) {
      return { ok: false, reason: 'Hate symbols or offensive imagery are not permitted.', category: 'hate' };
    }
  }

  return { ok: true };
}

// 3. Unit tests with synthetic payloads
function runUnitTests() {
  console.log('--- Running Synthetic Evaluation Tests ---');

  const testCases = [
    {
      name: 'Safe landscape/camera photo',
      payload: {
        status: 'success',
        nudity: { sexual_activity: 0.0, sexual_display: 0.0, erotica: 0.01, very_suggestive: 0.01, suggestive: 0.02, context: { art: 0.0 } },
        weapon: { classes: { firearm: 0.01, knife: 0.0 } },
        violence: { prob: 0.01 },
        gore: { prob: 0.01 },
        offensive: { nazi: 0.0, confederate: 0.0, supremacist: 0.0, terrorist: 0.0 },
      },
      expectOk: true,
    },
    {
      name: 'Beach photo in swimwear',
      payload: {
        status: 'success',
        nudity: { sexual_activity: 0.0, sexual_display: 0.01, erotica: 0.05, very_suggestive: 0.25, suggestive: 0.85, context: { art: 0.0 } },
        weapon: { classes: { firearm: 0.0, knife: 0.0 } },
        violence: { prob: 0.01 },
        gore: { prob: 0.01 },
      },
      expectOk: true,
    },
    {
      name: 'Kitchen photo with a chef knife',
      payload: {
        status: 'success',
        nudity: { sexual_activity: 0.0, sexual_display: 0.0, erotica: 0.0, very_suggestive: 0.0, suggestive: 0.01 },
        weapon: { classes: { firearm: 0.0, knife: 0.7 } },
      },
      expectOk: true,
    },
    {
      name: 'Classical nude sculpture (David)',
      payload: {
        status: 'success',
        nudity: { sexual_activity: 0.0, sexual_display: 0.42, erotica: 0.20, very_suggestive: 0.15, suggestive: 0.20, context: { art: 0.88 } },
        weapon: { classes: {} },
        violence: { prob: 0.0 },
        gore: { prob: 0.0 },
      },
      expectOk: false,
      expectCategory: 'nudity',
    },
    {
      name: 'Firearm / Weapon detection',
      payload: {
        status: 'success',
        nudity: { sexual_activity: 0.0, sexual_display: 0.0, erotica: 0.0, very_suggestive: 0.0, suggestive: 0.0 },
        weapon: { classes: { firearm: 0.85, knife: 0.0 } },
      },
      expectOk: false,
      expectCategory: 'weapon',
    },
    {
      name: 'Hate symbol (Nazi/extremist imagery)',
      payload: {
        status: 'success',
        nudity: { sexual_activity: 0.0, sexual_display: 0.0, erotica: 0.0, very_suggestive: 0.0, suggestive: 0.0 },
        offensive: { nazi: 0.92, confederate: 0.0, supremacist: 0.0, terrorist: 0.0 },
      },
      expectOk: false,
      expectCategory: 'hate',
    },
    {
      name: 'Graphic gore / blood',
      payload: {
        status: 'success',
        nudity: { sexual_activity: 0.0, sexual_display: 0.0, erotica: 0.0, very_suggestive: 0.0, suggestive: 0.0 },
        gore: { prob: 0.78 },
      },
      expectOk: false,
      expectCategory: 'gore',
    },
  ];

  let passed = 0;
  for (const tc of testCases) {
    const result = evaluateModeration(tc.payload);
    if (result.ok === tc.expectOk && (!tc.expectCategory || result.category === tc.expectCategory)) {
      console.log(`  ✓ [PASS] ${tc.name} -> ${result.ok ? 'ALLOWED' : 'BLOCKED (' + result.reason + ')'}`);
      passed++;
    } else {
      console.error(`  ✗ [FAIL] ${tc.name}: Expected ok=${tc.expectOk}, got result=`, result);
    }
  }

  console.log(`Summary: ${passed}/${testCases.length} synthetic tests passed.\n`);
  return passed === testCases.length;
}

async function checkImageMedia(endpointUrl, user, secret, imageBuffer, filename, label) {
  const form = new FormData();
  form.append('models', 'nudity-2.1,weapon,violence,gore-2.0,offensive');
  form.append('api_user', user);
  form.append('api_secret', secret);
  const blob = new Blob([imageBuffer], { type: 'image/jpeg' });
  form.append('media', blob, filename);

  const res = await fetch(endpointUrl, {
    method: 'POST',
    body: form,
  });

  const data = await res.json();
  if (data.status !== 'success') {
    console.error(`Sightengine error for ${label}:`, data);
    return;
  }

  const evaluation = evaluateModeration(data);
  console.log(`\n[Live Test: ${label}]`);
  console.log('  Scores:', {
    nudity_none: data.nudity?.none,
    sexual_display: data.nudity?.sexual_display,
    erotica: data.nudity?.erotica,
    suggestive: data.nudity?.suggestive,
    very_suggestive: data.nudity?.very_suggestive,
    context_art: data.nudity?.context?.art,
    weapons: data.weapon?.classes,
    violence: data.violence?.prob,
    offensive: data.offensive?.prob,
  });
  console.log(`  Result: ${evaluation.ok ? '✓ ALLOWED' : '✗ BLOCKED -> ' + evaluation.reason}`);
}

// 4. Live API Test against Sightengine (if credentials present & network available)
async function runLiveTest(env) {
  const user = env.SIGHTENGINE_API_USER;
  const secret = env.SIGHTENGINE_API_SECRET;

  if (!user || !secret) {
    console.log('Skipping live test: SIGHTENGINE_API_USER or SIGHTENGINE_API_SECRET not set in .env.');
    return;
  }

  console.log('--- Running Live Sightengine API Tests ---');
  console.log(`Using API User: ${user.slice(0, 4)}****`);

  // Download safe test image
  const safeRes = await fetch('https://sightengine.com/assets/img/examples/example7.jpg');
  const safeBytes = await safeRes.arrayBuffer();
  await checkImageMedia(
    'https://api.sightengine.com/1.0/check.json',
    user,
    secret,
    safeBytes,
    'safe.jpg',
    'Safe Landscape Photo'
  );

  // Download sculpture image with proper User-Agent
  const sculptureRes = await fetch(
    'https://upload.wikimedia.org/wikipedia/commons/9/9d/David_di_Michelangelo.jpg',
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    }
  );
  if (sculptureRes.ok) {
    const sculptureBytes = await sculptureRes.arrayBuffer();
    await checkImageMedia(
      'https://api.sightengine.com/1.0/check.json',
      user,
      secret,
      sculptureBytes,
      'david.jpg',
      'Nude Sculpture (Michelangelo\'s David)'
    );
  } else {
    console.log('Could not download test sculpture from Wikimedia:', sculptureRes.status);
  }
}

async function main() {
  const env = loadEnv();
  const unitOk = runUnitTests();
  if (process.argv.includes('--live')) {
    await runLiveTest(env);
  } else {
    console.log('(To run against the live Sightengine API, run: node scripts/test-moderation.mjs --live)');
  }
}

main();
