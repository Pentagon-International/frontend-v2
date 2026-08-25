import { apiCallProtected } from "../api/axios";
import { URL } from "../api/serverUrls";

export interface PasswordLoginData {
  pulse_id: string;
  full_name: string;
  password: string;
}

export interface AzureLoginData {
  login_type: "azure";
  id_token: string;
}

export type LoginFormData = PasswordLoginData | AzureLoginData;

export const login = (data: LoginFormData) => {
  return new Promise((resolve, reject) => {
    apiCallProtected
      .post(URL.loginUser, data)
      .then((response) => {
        resolve(response);
      })
      .catch((error) => {
        reject(error);
      });
  });
};
