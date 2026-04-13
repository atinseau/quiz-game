import ky from "ky";

let _getToken: (() => Promise<string | null>) | null = null;

export function initApi(getToken: () => Promise<string | null>) {
  _getToken = getToken;
}

const API_URL = process.env.PUBLIC_API_URL || "http://localhost:1337/api";

export const api = ky.create({
  prefix: API_URL,
  hooks: {
    beforeRequest: [
      async ({ request }) => {
        if (!_getToken) return;
        const token = await _getToken();
        if (token) {
          request.headers.set("Authorization", `Bearer ${token}`);
        }
      },
    ],
  },
});
