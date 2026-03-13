import { createContext } from "react";

const AuthContext = createContext({
    isLoggedIn: false,
    credentials: {},
    login: () => { },
    logout: () => { },
});

export default AuthContext;
