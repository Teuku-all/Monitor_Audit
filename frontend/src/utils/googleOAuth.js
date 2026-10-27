const configuredClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || '';

export const googleClientId = configuredClientId.endsWith('.apps.googleusercontent.com')
  && !configuredClientId.startsWith('your-')
  ? configuredClientId
  : '';
