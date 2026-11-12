import React from 'react';
import { staticFile } from 'remotion';
import { fontCss } from './theme';

const css = fontCss
  .replace('__F400__', staticFile('fonts/poppins-400-latin.woff2'))
  .replace('__F500__', staticFile('fonts/poppins-500-latin.woff2'))
  .replace('__F600__', staticFile('fonts/poppins-600-latin.woff2'))
  .replace('__F700__', staticFile('fonts/poppins-700-latin.woff2'))
  .replace('__FMONO__', staticFile('fonts/jetbrains-mono-latin.woff2'));

export const Fonts: React.FC = () => <style>{css}</style>;
