import axios from "axios";
import { Config } from "../config/config";

// HELP5.md §2.5: 공통 Axios Instance — 실제 도메인 API는 각 features/{도메인}/api/에서 이 client를 사용한다.
export const apiClient = axios.create({
    baseURL: Config.API_URL,
});
