import { apiCallProtected } from "../api/axios";

// type ValueType = {
//   id: number;
//   group_code: string;
//   group_name: string;
//   status: 'ACTIVE' | 'INACTIVE'; 
// };

export const putAPICall = (url: string, formValue: any, config: any= {}  ) => {

  return new Promise((resolve, reject) => {
    apiCallProtected.put(url+`${formValue.id}/`, formValue, config)
    .then((response) => {
        resolve(response);
      })  
      .catch((error) => {
        reject(error);
      });
  });
};