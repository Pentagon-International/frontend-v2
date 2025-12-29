import { apiCallProtected } from "../api/axios";

export const postAPICall = (url: string, formValue: any, config: any = {}) => {
  return new Promise((resolve, reject) => {
    apiCallProtected
      .post(url, formValue, config)
      .then((response) => {
        resolve(response);
      })
      .catch((error) => {
        reject(error);
      });
  });
};
