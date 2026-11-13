import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabase';

export class ModerationError extends Error {
  category?: string;

  constructor(message: string, category?: string) {
    super(message);
    this.name = 'ModerationError';
    this.category = category;
  }
}

/**
 * Validates an image against Sightengine's strict moderation criteria
 * via the secure Supabase Edge Function 'moderate-image'.
 *
 * Throws ModerationError if the photo contains nudity, erotic art/sculptures,
 * weapons, gore, violence, or hate imagery.
 */
export async function assertImageAppropriate(
  imageBytes: ArrayBuffer,
  contentType: string = 'image/jpeg'
): Promise<void> {
  const { data, error } = await supabase.functions.invoke('moderate-image', {
    body: imageBytes,
    headers: {
      'Content-Type': contentType,
    },
  });

  if (error) {
    // A rejected photo comes back as HTTP 400, and supabase-js leaves `data`
    // empty for any non-2xx reply, so the reason has to be read from the
    // response stored on the error
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null);
      if (body && body.ok === false && body.category && body.reason) {
        throw new ModerationError(body.reason, body.category);
      }
    }

    // Anything else (offline, function not deployed, Sightengine down) fails
    // closed with a message the user can act on
    console.log('Moderation service error:', error);
    throw new ModerationError(
      'We couldn’t check this photo right now. Please try again in a moment.'
    );
  }

  if (data && data.ok === false) {
    throw new ModerationError(
      data.reason || 'This photo does not meet our community standards.',
      data.category
    );
  }
}
