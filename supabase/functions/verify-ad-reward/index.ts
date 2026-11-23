// Supabase Edge Function: verify-ad-reward
// Handles AdMob Server-to-Server Verification (S2SV) callbacks.
// Validates Google ECDSA signature, deduplicates txn_id, and records verified ad watch.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import crypto from 'node:crypto';

const GOOGLE_KEYS_URL = 'https://www.gstatic.com/admob/reward/verifier-keys.json';

// In-memory key cache to minimize latency and avoid repeated network calls
let cachedKeys: { keys: Array<{ keyId: number; pem: string; base64: string }> } | null = null;
let lastKeysFetch = 0;
const KEYS_CACHE_TTL = 3600 * 1000; // 1 hour

async function getGooglePublicKeys() {
  const now = Date.now();
  if (cachedKeys && now - lastKeysFetch < KEYS_CACHE_TTL) {
    return cachedKeys;
  }
  const res = await fetch(GOOGLE_KEYS_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch Google AdMob keys: ${res.statusText}`);
  }
  cachedKeys = await res.json();
  lastKeysFetch = now;
  return cachedKeys!;
}

serve(async (req: Request) => {
  // AdMob S2SV sends HTTP GET requests
  const url = new URL(req.url);

  // Health check
  if (req.method === 'GET' && url.searchParams.get('health') === '1') {
    return new Response(JSON.stringify({ status: 'ok', service: 'verify-ad-reward' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const rawQuery = url.search.startsWith('?') ? url.search.slice(1) : url.search;
    const keyId = url.searchParams.get('key_id');
    const signature = url.searchParams.get('signature');
    const transactionId = url.searchParams.get('transaction_id');
    const customData = url.searchParams.get('custom_data');

    // Test bypass: only available if ALLOW_TEST_S2SV=true is configured in secrets
    const allowTest = Deno.env.get('ALLOW_TEST_S2SV') === 'true';
    const isTestCall = url.searchParams.get('test_mode') === 'true';

    if (!isTestCall || !allowTest) {
      if (!keyId || !signature || !transactionId || !customData) {
        return new Response(JSON.stringify({ error: 'Missing required S2SV parameters' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // 1. Isolate the message payload that was signed.
      // Google documentation: The last two query parameters of rewarded video SSV callbacks
      // are always signature and key_id, in that order. The remaining query parameters
      // specify the content to be verified.
      const sigIndex = rawQuery.indexOf('&signature=');
      if (sigIndex === -1) {
        return new Response(JSON.stringify({ error: 'Invalid query format: &signature= not found' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const contentToVerify = rawQuery.substring(0, sigIndex);

      // 2. Lookup public key
      const keysData = await getGooglePublicKeys();
      const matchedKey = keysData.keys.find((k) => String(k.keyId) === String(keyId));
      if (!matchedKey) {
        return new Response(JSON.stringify({ error: `Unknown key_id: ${keyId}` }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // 3. Cryptographically verify signature using ECDSA SHA-256
      // Signature is Base64URL encoded DER format
      const normalizedSig = signature.replace(/-/g, '+').replace(/_/g, '/');
      const sigBuffer = Buffer.from(normalizedSig, 'base64');

      const verifier = crypto.createVerify('SHA256');
      verifier.update(contentToVerify);
      const isSignatureValid = verifier.verify(matchedKey.pem, sigBuffer);

      if (!isSignatureValid) {
        return new Response(JSON.stringify({ error: 'Invalid ECDSA signature' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // 4. Parse custom_data payload
    if (!customData || !transactionId) {
      return new Response(JSON.stringify({ error: 'Missing custom_data or transaction_id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let parsedData: { userId?: string; streakType?: string; restoreSession?: string };
    try {
      parsedData = JSON.parse(decodeURIComponent(customData));
    } catch {
      return new Response(JSON.stringify({ error: 'Malformed custom_data JSON' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { userId, streakType, restoreSession } = parsedData;
    if (!userId || !streakType || !restoreSession) {
      return new Response(JSON.stringify({ error: 'Missing fields in custom_data (userId, streakType, restoreSession)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (streakType !== 'daily' && streakType !== 'weekly') {
      return new Response(JSON.stringify({ error: 'Invalid streakType' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 5. Connect to Supabase using service role key (bypasses RLS to record verified watch)
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { error: insertError } = await supabase.from('streak_restore_progress').insert({
      user_id: userId,
      streak_type: streakType,
      restore_session: restoreSession,
      admob_txn_id: transactionId,
    });

    if (insertError) {
      // 23505 = duplicate admob_txn_id. Acknowledge with 200 so AdMob stops retrying.
      if (insertError.code === '23505') {
        return new Response(JSON.stringify({ status: 'already_recorded', txn: transactionId }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      console.error('Insert error in streak_restore_progress:', insertError);
      return new Response(JSON.stringify({ error: 'Database insert failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ status: 'recorded', txn: transactionId }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Unhandled S2SV error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
