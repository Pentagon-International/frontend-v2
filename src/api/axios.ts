import axios from "axios";
import { URL } from "./serverUrls";

export const apiCall = axios.create({
  baseURL: URL.base,
  headers: { "X-Client-Type": "web" },
});

export const apiCallProtected = axios.create({
  baseURL: URL.base,
  headers: { "Content-Type": "application/json", "X-Client-Type": "web" },
});