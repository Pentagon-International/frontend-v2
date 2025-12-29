import axios from "axios";
import { URL } from "./serverUrls";

export const apiCall = axios.create({
  baseURL: URL.base,
});

export const apiCallProtected = axios.create({
  baseURL: URL.base,
  headers: { "Content-Type": "application/json" },
});