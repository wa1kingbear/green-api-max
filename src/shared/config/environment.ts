const DEFAULT_GREEN_API_BASE_URL = 'https://api.green-api.com';

export const GREEN_API_BASE_URL = (
  import.meta.env.VITE_GREEN_API_BASE_URL || DEFAULT_GREEN_API_BASE_URL
).replace(/\/+$/, '');
