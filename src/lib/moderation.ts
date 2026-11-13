import { Alert } from 'react-native';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { ImageUpload } from './upload';

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

// What a blocked photo was for, so an approved review can post it the same
// way (see resolve_photo_review)
export type ReviewFor =
  | { kind: 'weekly'; theme_id: string; format: string; caption: string; film_strip: boolean }
  | { kind: 'daily'; date: string }
  | { kind: 'avatar' }
  | { kind: 'showcase'; slot: number };

const MAX_WAITING_REVIEWS = 3;

/**
 * Tells the user a photo was blocked. When the filter rejected it (rather
 * than failing to check it), they can ask a person to take a second look.
 */
export function alertBlockedPhoto(err: ModerationError, image: ImageUpload, userId: string, reviewFor: ReviewFor) {
  if (!err.category) {
    Alert.alert('Couldn’t check photo', err.message);
    return;
  }
  Alert.alert('Photo Not Allowed', `${err.message}\n\nIf you think we got this wrong, you can ask for a review.`, [
    { text: 'OK', style: 'cancel' },
    { text: 'Ask for a review', onPress: () => requestPhotoReview(err, image, userId, reviewFor) },
  ]);
}

async function requestPhotoReview(err: ModerationError, image: ImageUpload, userId: string, reviewFor: ReviewFor) {
  try {
    const { count } = await supabase
      .from('photo_reviews')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'pending');
    if ((count ?? 0) >= MAX_WAITING_REVIEWS) {
      Alert.alert('Already waiting on reviews', 'You have 3 photos waiting for a second look. Ocho will get to them soon.');
      return;
    }

    // Kept in their own folder, like any other upload, so it can be posted
    // straight from here if it's approved
    const filePath = `${userId}/review-${Date.now()}.${image.ext}`;
    const { error: uploadError } = await supabase.storage
      .from('submissions')
      .upload(filePath, image.bytes, { contentType: image.contentType });
    if (uploadError) throw uploadError;
    const { data: publicUrlData } = supabase.storage.from('submissions').getPublicUrl(filePath);

    const { kind, ...details } = reviewFor;
    const { error } = await supabase.from('photo_reviews').insert({
      kind,
      image_url: publicUrlData.publicUrl,
      file_path: filePath,
      category: err.category,
      reason: err.message,
      details,
    });
    if (error) throw error;

    Alert.alert('Sent for review', 'Ocho will take a second look and let you know. If it’s fine, it’ll be posted for you.');
  } catch (e) {
    console.log('Photo review request failed:', e);
    Alert.alert('Couldn’t send for review', 'Please check your connection and try again.');
  }
}
