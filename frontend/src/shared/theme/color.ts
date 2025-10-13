// src/shared/theme/color.ts
export const alpha = (hex: string, a: number) =>
  `rgba(${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)},${a})`;
