// src/utils/auth.js
// -----------------------------------------------------------------------------
// Helpers para leer y escribir los datos del usuario autenticado en localStorage
// sin duplicar lógica en los distintos componentes.
// -----------------------------------------------------------------------------

export const setStoredUser = (user) => {
  if (!user) {
    localStorage.removeItem('usuario');
    return;
  }

  localStorage.setItem('usuario', JSON.stringify(user));
};

export const getStoredUser = () => {
  const stored = localStorage.getItem('usuario');
  if (!stored) return null;

  try {
    const parsed = JSON.parse(stored);
    if (parsed && typeof parsed === 'object') return parsed;

    if (typeof parsed === 'string') {
      return { nombres: parsed };
    }
  } catch {
    // Formato antiguo: se guardaba solo el nombre como string plano
    return { nombres: stored };
  }

  return null;
};

export const getStoredRole = () => {
  const user = getStoredUser();
  return user?.role ?? null;
};
