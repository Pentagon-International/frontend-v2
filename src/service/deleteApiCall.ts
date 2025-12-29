import { apiCallProtected } from "../api/axios";



type DeleteValueType =  { id: number };

export const deleteApiCall = (url: string, config: any = {}, value: DeleteValueType ) => {
  return new Promise((resolve, reject) => {
    apiCallProtected.delete(url+`${value.id}/`, config)
    .then((response) => {
        resolve(response);
      })  
      .catch((error) => {
        reject(error);
      });
  });
};