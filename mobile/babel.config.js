module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Reanimated v4 moved its Babel plugin into react-native-worklets. This
      // must stay LAST in the plugin list. The old 'react-native-reanimated/
      // plugin' path is deprecated on SDK 56 and warns at build time.
      'react-native-worklets/plugin',
    ],
  };
};
