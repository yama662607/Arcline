// Development-only React Fast Refresh preamble loader for content script environments.
// This ensures @vitejs/plugin-react-swc's runtime is initialized before any React code
// runs in pages where we mount extension UI via content scripts.

if (import.meta.env.DEV) {
  // Side-effect-only dynamic import. In production builds, this branch is tree-shaken
  // and the preamble code is not bundled into the extension.
  void import('@vitejs/plugin-react-swc/preamble');
}
