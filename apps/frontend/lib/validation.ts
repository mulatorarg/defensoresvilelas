/**
 * Reglas de validación de formularios (zod), con mensajes en castellano.
 * Reflejan las del backend (app/schemas.py): el cliente avisa antes de enviar
 * y el servidor valida igual.
 */
import { z } from 'zod';

export const requiredText = (label: string, max = 191) =>
  z.string().trim().min(1, `${label}: es obligatorio`).max(max, `${label}: máximo ${max} caracteres`);

export const optionalText = (max = 191) =>
  z.string().trim().max(max, `Máximo ${max} caracteres`);

/** Monto > 0 con hasta 2 decimales (se manda como string, igual que la API). */
export const money = (label = 'Monto') =>
  z
    .string()
    .trim()
    .min(1, `${label}: es obligatorio`)
    .regex(/^\d+([.,]\d{1,2})?$/, `${label}: número con hasta 2 decimales`)
    .transform((v) => v.replace(',', '.'))
    .refine((v) => Number(v) > 0, `${label}: tiene que ser mayor a 0`);

export const optionalMoney = (label = 'Monto') =>
  z
    .string()
    .trim()
    .regex(/^(\d+([.,]\d{1,2})?)?$/, `${label}: número con hasta 2 decimales`)
    .transform((v) => v.replace(',', '.'));

export const optionalEmail = z
  .string()
  .trim()
  .refine((v) => v === '' || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), 'Email inválido');

export const dni = z
  .string()
  .trim()
  .regex(/^\d{6,9}$/, 'DNI: solo números, entre 6 y 9 dígitos');

/** AAAA-MM-DD de un <input type="date">, opcional. */
export const optionalDate = z
  .string()
  .refine((v) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Fecha inválida');

export const requiredDate = (label: string) =>
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, `${label}: elegí una fecha`);

export const period = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Elegí el mes');

export const optionalAge = z
  .string()
  .refine((v) => v === '' || (/^\d{1,3}$/.test(v) && Number(v) <= 120), 'Edad inválida');

/** '' -> undefined, para no mandar campos vacíos a la API. */
export function blankToUndefined<T extends Record<string, unknown>>(data: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== '' && value !== undefined),
  ) as Partial<T>;
}
