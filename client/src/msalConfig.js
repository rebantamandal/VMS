import { PublicClientApplication } from "@azure/msal-browser";

const redirectUri = window.location.origin; // ✅ uses whatever domain user opened

export const msalConfig = {
  auth: {
    clientId: process.env.REACT_APP_MSAL_CLIENT_ID,
    authority: process.env.REACT_APP_MSAL_AUTHORITY,
    redirectUri,
    postLogoutRedirectUri: redirectUri, // ✅ add this too
    navigateToLoginRequestUrl: true,
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  },
};

export const msalInstance = new PublicClientApplication(msalConfig);
