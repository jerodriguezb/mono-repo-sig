export const decodeToken = (token) => {
  if (!token || typeof token !== 'string') return null;
  const segments = token.split('.');
  if (segments.length < 2) return null;

  try {
    const base64Url = segments[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    let decodedString = '';
    if (typeof globalThis !== 'undefined' && typeof globalThis.atob === 'function') {
      decodedString = globalThis.atob(base64);
    } else if (typeof globalThis !== 'undefined' && globalThis.Buffer) {
      decodedString = globalThis.Buffer.from(base64, 'base64').toString('binary');
    } else {
      return null;
    }

    const jsonPayload = decodeURIComponent(
      decodedString
        .split('')
        .map((char) => {
          const code = char.charCodeAt(0).toString(16).padStart(2, '0');
          return `%${code}`;
        })
        .join(''),
    );

    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Error decoding token', error);
    return null;
  }
};

export const getCurrentUserFromStorage = () => {
  try {
    const token = localStorage.getItem('token');
    if (!token) return null;
    return decodeToken(token);
  } catch (error) {
    console.error('Error obtaining current user from token', error);
    return null;
  }
};
