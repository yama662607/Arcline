// Atlas Side Panel compatibility check.
// Run inside the extension's service worker DevTools console.

async function checkAtlasSidePanel() {
  const hasSidePanel = typeof chrome.sidePanel !== "undefined";
  const userAgent = self.navigator?.userAgent ?? "<no ua>";

  console.group("[Atlas Check] Side Panel Availability");
  console.log("navigator.userAgent", userAgent);
  console.log("chrome.sidePanel defined", hasSidePanel);

  if (!hasSidePanel) {
    console.warn("sidePanel API missing; nothing to test");
    console.groupEnd();
    return;
  }

  const methods = Object.getOwnPropertyNames(chrome.sidePanel).sort();
  console.log("sidePanel methods", methods);

  try {
    const behavior = await chrome.sidePanel.getPanelBehavior?.();
    console.log("getPanelBehavior()", behavior);
  } catch (error) {
    console.warn("getPanelBehavior() failed", error);
  }

  try {
    await chrome.sidePanel.setOptions({ path: "index.html" });
    console.log("setOptions() default side succeeded");
  } catch (error) {
    console.error("setOptions() default side failed", error);
  }

  if (chrome.sidePanel?.Side) {
    console.log("chrome.sidePanel.Side values", chrome.sidePanel.Side);

    try {
      await chrome.sidePanel.setOptions({ path: "index.html", side: chrome.sidePanel.Side.LEFT });
      console.log("setOptions() side LEFT succeeded");
    } catch (error) {
      console.warn("setOptions() side LEFT unsupported", error);
    }
  }

  try {
    const windowInfo = await chrome.windows.getCurrent();
    console.log("windows.getCurrent()", windowInfo?.id);

    await chrome.sidePanel.open({ windowId: windowInfo.id });
    console.log("sidePanel.open() (default side) succeeded");
  } catch (error) {
    console.error("sidePanel.open() (default side) failed", error);
  }

  if (chrome.sidePanel?.Side) {
    try {
      await chrome.sidePanel.open({ side: chrome.sidePanel.Side.LEFT });
      console.log("sidePanel.open() (LEFT) succeeded");
    } catch (error) {
      console.warn("sidePanel.open() (LEFT) unsupported", error);
    }

    try {
      await chrome.sidePanel.open({ side: chrome.sidePanel.Side.RIGHT });
      console.log("sidePanel.open() (RIGHT) succeeded");
    } catch (error) {
      console.warn("sidePanel.open() (RIGHT) unsupported", error);
    }
  }

  console.groupEnd();
}

checkAtlasSidePanel();
