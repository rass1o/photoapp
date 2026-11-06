// Adds one thing to app.json: which runtime version updates are made for.
//  - Expo Go (the tester link) only accepts the "sdkVersion" policy.
//  - Real builds (TestFlight / App Store) can't use it, so they use the app
//    version instead. eas.json sets APP_TARGET=store for those builds, and
//    updates meant for them are published with APP_TARGET=store too.
module.exports = ({ config }) => ({
  ...config,
  runtimeVersion: process.env.APP_TARGET === 'store' ? { policy: 'appVersion' } : { policy: 'sdkVersion' },
});
