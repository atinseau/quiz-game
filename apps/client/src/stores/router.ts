import type { NavigateFunction } from "react-router-dom";

let _navigate: NavigateFunction = () => {};

export const setNavigate = (fn: NavigateFunction) => {
  _navigate = fn;
};

export const getNavigate = () => _navigate;
