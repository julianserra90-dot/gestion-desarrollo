/**
 * El ancho de la franja lateral cuando está cerrada. Vive en un archivo sin
 * `"use client"` porque lo necesitan los dos lados: `AppShell` (server
 * component, para el padding que le deja lugar) y `ObraSidebar` (client
 * component, para su propio ancho). Un `ObraSidebar` importado directamente
 * desde `AppShell` no funcionaba: al ser un módulo "use client", el valor no
 * llegaba bien al bundle del servidor y el padding entero quedaba inválido.
 */
export const ANCHO_SIDEBAR_CERRADO = 64;
