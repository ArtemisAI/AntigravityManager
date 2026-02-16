// TEMPORARY: Sentry disabled due to missing integration files
// import * as Sentry from '@sentry/electron/main';
import path from 'path';
import fs from 'fs';
import { getAppDataDir } from './utils/paths';
import { logger } from './utils/logger';

function getQuickConfig() {
  try {
    const configPath = path.join(getAppDataDir(), 'gui_config.json');
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(content);
      // Default to false (privacy by default)
      return config.error_reporting_enabled;
    }
  } catch (e) {
    logger.error('Failed to read config for Sentry init:', e);
  }
  return false;
}

// TEMPORARY: Sentry initialization disabled
// if (getQuickConfig()) {
//   Sentry.init({...});
//   logger.setErrorReportingEnabled(true);
//   logger.setSentryReporter(...);
// } else {
logger.setErrorReportingEnabled(false);
logger.setSentryReporter(null);
// }
