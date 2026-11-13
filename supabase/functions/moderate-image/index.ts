import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Strict evaluation logic for Sightengine responses
function evaluateModeration(data: any): { ok: boolean; reason?: string; category?: string } {
  if (data.status !== 'success') {
    return { ok: false, reason: data.error?.message || 'Moderation API error', category: 'api_error' };
  }

  // --- Strict Nudity & 18+ (including nude sculptures & art) ---
  if (data.nudity) {
    const { sexual_activity, sexual_display, erotica, very_suggestive, context } = data.nudity;
    const isArt = (context?.art || 0) >= 0.15;

    if (sexual_activity >= 0.3 || sexual_display >= 0.3) {
      return {
        ok: false,
        reason: isArt
          ? 'Artistic nudes and nude sculptures are not permitted under the strict 18+ policy.'
          : 'Adult content or nudity is not permitted.',
        category: 'nudity',
      };
    }
    if (erotica >= 0.4) {
      return {
        ok: false,
        reason: isArt
          ? 'Artistic nudes and nude sculptures are not permitted under the strict 18+ policy.'
          : 'Erotic or adult content is not permitted.',
        category: 'nudity',
      };
    }
    if (very_suggestive >= 0.6) {
      return { ok: false, reason: 'Revealing or adult imagery is not permitted.', category: 'nudity' };
    }
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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Verify user is authenticated with Supabase
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized user' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Extract media: supports raw ArrayBuffer binary or multipart/form-data
    let mediaBlob: Blob | null = null;
    const reqContentType = req.headers.get('content-type') || '';

    if (reqContentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const media = formData.get('media');
      if (media instanceof Blob) {
        mediaBlob = media;
      }
    } else {
      const bytes = await req.arrayBuffer();
      if (bytes.byteLength > 0) {
        mediaBlob = new Blob([bytes], { type: reqContentType || 'image/jpeg' });
      }
    }

    if (!mediaBlob || mediaBlob.size === 0) {
      return new Response(JSON.stringify({ error: 'Missing or empty media payload in request' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Forward to Sightengine
    const apiUser = Deno.env.get('SIGHTENGINE_API_USER');
    const apiSecret = Deno.env.get('SIGHTENGINE_API_SECRET');

    if (!apiUser || !apiSecret) {
      console.error('Server configuration error: Sightengine credentials not set in Supabase secrets.');
      // Fail closed
      return new Response(
        JSON.stringify({ ok: false, reason: 'Content moderation is currently unavailable. Please try again later.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sightengineForm = new FormData();
    sightengineForm.append('models', 'nudity-2.1,weapon,violence,gore-2.0,offensive');
    sightengineForm.append('api_user', apiUser);
    sightengineForm.append('api_secret', apiSecret);
    sightengineForm.append('media', mediaBlob, 'upload.jpg');

    const sightengineRes = await fetch('https://api.sightengine.com/1.0/check.json', {
      method: 'POST',
      body: sightengineForm,
    });

    const sightengineData = await sightengineRes.json();

    // Sightengine itself failed (bad keys, out of credits, bad image): that's
    // our problem, not the photo's, so fail closed without a rejection reason
    // and keep Sightengine's message in the logs only
    if (sightengineData.status !== 'success') {
      console.error('Sightengine error:', sightengineData.error);
      return new Response(
        JSON.stringify({ ok: false, reason: 'Content moderation is currently unavailable. Please try again later.' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = evaluateModeration(sightengineData);

    if (!result.ok) {
      return new Response(JSON.stringify(result), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Edge Function unhandled error:', err);
    // Strict fail closed
    return new Response(
      JSON.stringify({ ok: false, reason: 'Failed to verify photo safety. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
