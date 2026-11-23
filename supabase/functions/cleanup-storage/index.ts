import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Deletes photo files nothing in the app links to anymore (see
// 20261129_storage_cleanup.sql for which files count). Meant to run once a
// day from a Supabase cron job. Send {"dryRun": true} to only see what it
// would delete.
//
// It only ever removes files orphaned_photo_files lists, which are at least
// 2 days old and unused, so running it extra times does no harm.

const BATCH = 500;
const MAX_BATCHES = 10; // up to 5,000 files a run; the rest go next time

type Orphan = { bucket_id: string; name: string; size: number };

serve(async (req) => {
  const body = await req.json().catch(() => ({}));
  const dryRun = body?.dryRun === true;

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  let files = 0;
  let bytes = 0;
  const failed: string[] = [];

  for (let i = 0; i < MAX_BATCHES; i++) {
    const { data, error } = await admin.rpc('orphaned_photo_files', { p_limit: BATCH });
    if (error) {
      return Response.json({ ok: false, error: error.message }, { status: 500 });
    }
    const orphans = (data ?? []) as Orphan[];
    if (orphans.length === 0) break;

    if (dryRun) {
      files = orphans.length;
      bytes = orphans.reduce((sum, o) => sum + Number(o.size), 0);
      return Response.json({
        ok: true,
        dryRun: true,
        files,
        megabytes: +(bytes / 1048576).toFixed(1),
        more: orphans.length === BATCH,
        sample: orphans.slice(0, 10).map((o) => `${o.bucket_id}/${o.name}`),
      });
    }

    for (const bucket of ['submissions', 'avatars']) {
      const inBucket = orphans.filter((o) => o.bucket_id === bucket);
      if (inBucket.length === 0) continue;
      const { error: removeError } = await admin.storage.from(bucket).remove(inBucket.map((o) => o.name));
      if (removeError) {
        failed.push(`${bucket}: ${removeError.message}`);
        continue;
      }
      files += inBucket.length;
      bytes += inBucket.reduce((sum, o) => sum + Number(o.size), 0);
    }
    // Stop instead of looping on the same files if a bucket keeps failing
    if (failed.length > 0 || orphans.length < BATCH) break;
  }

  console.log(`cleanup-storage: removed ${files} files (${(bytes / 1048576).toFixed(1)} MB)`, failed);
  return Response.json({ ok: failed.length === 0, files, megabytes: +(bytes / 1048576).toFixed(1), failed });
});
