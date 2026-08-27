export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

export function getFirstName(fullName: string | null | undefined): string {
  if (!fullName || typeof fullName !== 'string') {
    return 'there';
  }

  const trimmed = fullName.trim();
  if (!trimmed) {
    return 'there';
  }

  const parts = trimmed.split(/\s+/);
  return parts[0] || 'there';
}

export function renderTemplate(
  template: string,
  variables: Record<string, any>
): string {
  let result = template;

  for (const [key, value] of Object.entries(variables)) {
    const placeholder = new RegExp(`{{${key}}}`, 'g');
    const stringValue = value !== null && value !== undefined ? String(value) : '';
    result = result.replace(placeholder, stringValue);
  }

  return result;
}
