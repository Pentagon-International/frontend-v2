export const AUTH_STORE = '@penatgon-prime-ai-auth' as const;
 export const API_HEADER = {
  headers: {
    AUTHORIZATION: `Token ${import.meta.env.VITE_API_AUTH_TOKEN}`,
  },
};