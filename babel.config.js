module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Reanimated 4.x: the babel plugin moved to react-native-worklets
    plugins: ['react-native-worklets/plugin'],
  };
};
