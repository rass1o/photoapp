// New passwords must pass all of these; shown as a checklist wherever a
// password is set (sign-up and Settings)
export const PASSWORD_RULES: { label: string; test: (p: string) => boolean }[] = [
  { label: 'More than 6 characters', test: (p) => p.length > 6 },
  { label: 'A number', test: (p) => /\d/.test(p) },
  { label: 'An uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { label: 'A special character (like ! @ # $)', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

export const passwordOk = (p: string) => PASSWORD_RULES.every((r) => r.test(p));
