import { apiCallProtected } from "../api/axios";
import { URL } from "../api/serverUrls";

export interface LoginFormData {
  pulse_id: string;
  full_name: string;
  password: string;
}

const authToken = import.meta.env.VITE_API_AUTH_TOKEN;

// export const login = (data: LoginFormData) => {
//   return new Promise((resolve, reject) => {
//     apiCallProtected
//       .post(URL.loginUser, data, {
//         headers:{
//           Authorization: `Token ${authToken}`
//         }
//       })
//       .then((response) => {
//         resolve(response);
//       })
//       .catch((error) => {
//         reject(error);
//       });
//   });
// };
export const login = (data: LoginFormData) => {
  // console.log("login payload-", data);

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
