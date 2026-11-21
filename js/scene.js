/* Pixel scene (home hero + footer), shared with pikolq.run.place: Pickle sa Balay's house,
   the pup playing fetch with a pickleball, and two players rallying on a mini court. */
(function () {
  'use strict';
  // Colours match the Pickle sa Balay logo: cream-gold pup with golden ears, plum outline, lavender scarf and roof.
  const PUP = `<svg class="pxf-svg" viewBox="0 0 20 14" shape-rendering="crispEdges">
      <g class="pxf-tail"><rect class="d-shade" x="1" y="2" width="1" height="2"/><rect class="d-shade" x="2" y="3" width="1" height="2"/></g>
      <rect class="d-dark" x="2" y="5" width="12" height="7"/><rect class="d-coat" x="3" y="6" width="10" height="5"/>
      <rect class="d-shade" x="4" y="10" width="8" height="1"/>
      <g class="pxf-legs a"><rect class="d-coat" x="3" y="12" width="2" height="1"/><rect class="d-dark" x="3" y="13" width="2" height="1"/><rect class="d-coat" x="10" y="12" width="2" height="1"/><rect class="d-dark" x="10" y="13" width="2" height="1"/></g>
      <g class="pxf-legs b"><rect class="d-coat" x="5" y="12" width="2" height="1"/><rect class="d-dark" x="5" y="13" width="2" height="1"/><rect class="d-coat" x="12" y="12" width="2" height="1"/><rect class="d-dark" x="12" y="13" width="2" height="1"/></g>
      <rect class="d-dark" x="10" y="0" width="9" height="8"/><rect class="d-coat" x="11" y="1" width="7" height="6"/>
      <rect class="d-dark" x="18" y="3" width="2" height="4"/><rect class="d-coat" x="18" y="4" width="1" height="2"/><rect class="d-dark" x="19" y="4" width="1" height="1"/>
      <rect class="d-shade" x="11" y="2" width="2" height="4"/><rect class="d-dark" x="15" y="3" width="1" height="1"/>
      <rect class="d-tongue" x="17" y="7" width="1" height="2"/>
      <rect class="d-scarf" x="11" y="6" width="4" height="2"/><rect class="d-scarf" x="12" y="8" width="2" height="1"/><rect class="d-scarf2" x="12" y="9" width="1" height="1"/><rect class="d-heart" x="13" y="8" width="1" height="1"/>
    </svg>`;
  // Pickleball (6 x 6 pixels with holes): used by the pup and, smaller, by the players' rally
  const BALL_PIXELS = `<rect class="b-ball" x="1" y="0" width="4" height="1"/><rect class="b-ball" x="0" y="1" width="6" height="4"/><rect class="b-shade" x="1" y="5" width="4" height="1"/>
      <rect class="b-hole" x="1" y="2" width="1" height="1"/><rect class="b-hole" x="3" y="1" width="1" height="1"/><rect class="b-hole" x="4" y="3" width="1" height="1"/><rect class="b-hole" x="2" y="4" width="1" height="1"/>`;
  const BALL = `<svg class="pxf-svg" viewBox="0 0 6 6" shape-rendering="crispEdges">${BALL_PIXELS}</svg>`;
  // Small house, like the one in the Pickle sa Balay logo
  const HOUSE = `<svg class="pxf-svg" viewBox="0 0 24 20" shape-rendering="crispEdges">
      <rect class="h-roof" x="16" y="2" width="2" height="4"/>
      <rect class="h-roof" x="11" y="1" width="2" height="1"/><rect class="h-roof" x="9" y="2" width="6" height="1"/><rect class="h-roof" x="7" y="3" width="10" height="1"/>
      <rect class="h-roof" x="5" y="4" width="14" height="1"/><rect class="h-roof" x="3" y="5" width="18" height="1"/><rect class="h-roof" x="1" y="6" width="22" height="2"/>
      <rect class="h-wall" x="3" y="8" width="18" height="12"/><rect class="h-trim" x="3" y="8" width="18" height="1"/>
      <rect class="h-win" x="5" y="11" width="4" height="4"/><rect class="h-pane" x="7" y="11" width="1" height="4"/><rect class="h-pane" x="5" y="13" width="4" height="1"/>
      <rect class="h-win" x="15" y="11" width="4" height="4"/><rect class="h-pane" x="17" y="11" width="1" height="4"/><rect class="h-pane" x="15" y="13" width="4" height="1"/>
      <rect class="h-door" x="10" y="13" width="4" height="7"/><rect class="h-knob" x="13" y="16" width="1" height="1"/>
      <rect class="h-heart" x="11" y="10" width="1" height="1"/><rect class="h-heart" x="13" y="10" width="1" height="1"/><rect class="h-heart" x="11" y="11" width="3" height="1"/><rect class="h-heart" x="12" y="12" width="1" height="1"/>
    </svg>`;
  // Mini court: the same pixel players as on the court cards (yellow Team 1 vs lavender Team 2), rallying over the net
  const PLAYER = `<g class="pxp-body">
        <rect class="pxp-hair" x="3" y="0" width="4" height="1"/><rect class="pxp-hair" x="2" y="1" width="1" height="2"/>
        <rect class="pxp-skin" x="3" y="1" width="4" height="3"/><rect class="pxp-eye" x="6" y="2" width="1" height="1"/>
        <rect class="pxp-shirt" x="3" y="4" width="4" height="5"/><rect class="pxp-skin" x="2" y="5" width="1" height="3"/>
        <rect class="pxp-shorts" x="3" y="9" width="4" height="2"/>
        <rect class="pxp-skin" x="3" y="11" width="1" height="3"/><rect class="pxp-skin" x="6" y="11" width="1" height="3"/>
        <rect class="pxp-shoe" x="3" y="14" width="2" height="1"/><rect class="pxp-shoe" x="6" y="14" width="2" height="1"/>
        <g class="pxp-arm">
          <rect class="pxp-skin" x="7" y="5" width="3" height="1"/>
          <rect class="pxp-handle" x="9" y="3" width="1" height="2"/>
          <rect class="pxp-paddle" x="8" y="0" width="3" height="3"/><rect class="pxp-paddle" x="9" y="-1" width="1" height="1"/>
          <rect class="pxp-paddle-edge" x="8" y="-1" width="1" height="1"/><rect class="pxp-paddle-edge" x="10" y="-1" width="1" height="1"/>
          <rect class="pxp-paddle-hi" x="9" y="0" width="1" height="2"/>
        </g>
      </g>
      <rect class="pxp-floor" x="2" y="15" width="7" height="1"/>`;
  // Each player is the 12 x 17 sprite scaled into the court (feet on the white line); the right one is mirrored
  const courtPlayer = (team, x) => `<svg class="cp" x="${x}" y="1.71" width="8.47" height="12" viewBox="0 -1 12 17">${PLAYER}</svg>`;
  const COURT = `<svg class="pxf-svg" viewBox="0 0 40 14" shape-rendering="crispEdges">
      <rect class="c-line" x="0" y="13" width="40" height="1"/>
      <rect class="c-net" x="19" y="7" width="2" height="7"/><rect class="c-post" x="19" y="6" width="2" height="1"/>
      <g class="pxp-team1 cp-l">${courtPlayer('team1', 4)}</g>
      <g class="pxp-team2 cp-r" transform="translate(36 0) scale(-1 1)">${courtPlayer('team2', 0)}</g>
      <g class="pr-ball"><svg width="2.4" height="2.4" viewBox="0 0 6 6">${BALL_PIXELS}</svg></g>
    </svg>`;
  const SCENE = `<span class="pxs-house">${HOUSE}</span>`
    + `<span class="pxf-yard"><span class="pxf-dog"><span class="pxf-face">${PUP}</span></span>`
    + `<span class="pxf-ball"><span class="pxf-shadow"></span><span class="pxf-bob">${BALL}</span></span></span>`
    + `<span class="pxs-court">${COURT}</span>`;
  /** Markup for one scene; views that render the hero drop it into a .px-fetch box. */
  window.PxScene = { html: () => SCENE };
  // Static markup (the footer) just marks the spot with data-px-fetch
  document.querySelectorAll('[data-px-fetch]').forEach(stage => { stage.innerHTML = SCENE; });
})();
