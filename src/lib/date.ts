// Today's date as YYYY-MM-DD in the device's local timezone, so the daily
// photo resets at local midnight. (toISOString() would give the UTC date,
// which rolls over mid-afternoon in the Americas.)
export function localDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
