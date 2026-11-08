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
    // If the Edge function returned HTTP 400 with a structured rejection
    if (data && data.ok === false && data.reason) {
      throw new ModerationError(data.reason, data.category);
    }

    console.log('Moderation service error:', error);
    // If the function is not yet deployed on Supabase, give a clear message
    const rawMsg = error.message || '';
    if (rawMsg.includes('Function not found') || rawMsg.includes('404')) {
      throw new ModerationError(
        'The moderation service is pending deployment on Supabase. Please deploy the "moderate-image" function.'
      );
    }

    throw new ModerationError(
      'Unable to verify photo safety. Please check your connection and try again.'
    );
  }

  if (data && data.ok === false) {
    throw new ModerationError(
      data.reason || 'This photo does not meet our community standards.',
      data.category
    );
  }
}

