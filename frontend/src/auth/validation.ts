export const validateEmail = (v: string): string | null =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? null : "Escribe un correo válido.";

export const validatePassword = (v: string): string | null =>
  v.length >= 10 ? null : "La contraseña debe tener al menos 10 caracteres.";
