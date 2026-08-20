/**
 * Dynamic config layered over app.json.
 * On EAS build machines google-services.json is delivered via the
 * GOOGLE_SERVICES_JSON file environment variable (the local file is
 * gitignored and therefore absent from the uploaded archive).
 */
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? config.android.googleServicesFile,
  },
});
