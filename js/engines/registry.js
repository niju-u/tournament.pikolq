/* Format → engine lookup. Every engine exposes the same interface
   (generate, setResult, clearResult, preview, stages, destinations, champion…),
   so the views never need to know which format they are showing. */
(function (PSB) {
  'use strict';

  PSB.engines = {
    'single-elim': PSB.bracketEngine,
    'double-elim': PSB.doubleElimEngine,
    'round-robin': PSB.roundRobinEngine,
  };

  /** Engine for a tournament: the bracket's own format once generated, else the chosen format. */
  PSB.engineFor = (t) => {
    const format = t && t.bracket ? t.bracket.format || 'single-elim' : t && t.format;
    return PSB.engines[format] || PSB.bracketEngine;
  };
})(window.PSB);
