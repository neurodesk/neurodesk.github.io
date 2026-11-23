// Fit the embedded CVMFS usage dashboard to its content. The dashboard
// (neurodesk/cvmfs-infrastructure) posts its height whenever it changes.
(function () {
  var ORIGIN = 'https://neurodesk.github.io';
  window.addEventListener('message', function (event) {
    if (event.origin !== ORIGIN) return;
    var d = event.data;
    if (!d || d.type !== 'cvmfs-dashboard:height' || typeof d.height !== 'number') return;
    var frame = document.getElementById('cvmfs-dashboard');
    if (frame) frame.style.height = Math.min(Math.max(d.height, 400), 20000) + 2 + 'px';
  });
})();
