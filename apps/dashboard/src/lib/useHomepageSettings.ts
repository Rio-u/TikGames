import { useEffect, useState } from "react";
import { getHomepageSettings, type HomepageSettings } from "./liveApi";

const EMPTY: HomepageSettings = { heroTitle: null, featuredGameTypes: [] };

/** Fetches the admin-set dashboard hero title + featured games once on mount. */
export function useHomepageSettings() {
  const [settings, setSettings] = useState<HomepageSettings>(EMPTY);

  useEffect(() => {
    getHomepageSettings()
      .then(setSettings)
      .catch(() => {});
  }, []);

  return settings;
}
