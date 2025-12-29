import useAuthStore from "../store/authStore";
import { apiCallProtected } from "./axios";

const requestInterceptor = () =>
  // apiCallProtected.interceptors.request.use(
  //   (config) => {
  //     /*
  //     If access_token is availabe in the auth contentex then
  //     bearer token will we added to the header for every request.
  //     In other words without access_token the user is not logged in.
  //   */
  //     const authObj = useAuthStore?.getState().auth;
  //     if (authObj?.access_token?.length) {
  //       config.headers.Authorization = `Bearer ${authObj?.access_token}`;
  //     }
  //     return config;
  //   },
  //   (error) => Promise.reject(error)
  // );
  apiCallProtected.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default requestInterceptor;
