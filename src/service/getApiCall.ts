import { apiCallProtected } from "../api/axios";
import { URL } from "../api/serverUrls";

export const getAPICall = (url: string, config: any = {}) => {
  return new Promise((resolve, reject) => {
    // If no headers provided, use regular fetch without authentication
    if (!config.headers) {
      fetch(`${URL.base}${url}`)
        .then((response) => response.json())
        .then((data) => {
          resolve(data);
        })
        .catch((error) => {
          reject(error);
        });
    } else {
      // Use authenticated API call
      apiCallProtected
        .get(url, config)
        .then((response) => {
          resolve(response);
        })
        .catch((error) => {
          reject(error);
        });
    }
  });
};
