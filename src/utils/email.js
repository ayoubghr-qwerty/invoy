export function composeEmail({ to, subject, body }) {
  const params = new URLSearchParams();
  if (to) params.set('to', to);
  if (subject) params.set('subject', subject);
  if (body) params.set('body', body);

  const mailtoUrl = `mailto:${params.toString()}`;
  window.open(mailtoUrl, '_blank');
}
