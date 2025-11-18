import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async (context, next) => {
  // Dummy middleware for static mode - does nothing
  return next();
});
