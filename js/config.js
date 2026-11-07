(function (root) {
  const GeoConfig = { sheetUrl: 'https://script.google.com/macros/s/AKfycbwGoMzFVkoGdut-8dhHE6j2tvrE_46lb2Wyi9aq3IDXQ2qGkuCAifvmgXQHVz1D44qw/exec' };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = GeoConfig;
  } else {
    root.GeoConfig = GeoConfig;
  }
})(typeof window !== 'undefined' ? window : globalThis);
