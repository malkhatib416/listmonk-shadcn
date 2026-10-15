declare global {
  interface Window {
    // Path component of app.root_url ("" or "/lm"), set by Go on the shell.
    _LM_ROOT?: string;
  }
}

export {};
