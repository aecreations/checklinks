/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


export let aeVisual = {
  _iconCache: [],


  preloadMsgBoxIcons()
  {
    this.cacheIcons(
      "warning-64.png",
      "warning-64-mac.png",
      "alert-win.png",
      "info.svg",
      "info-win.png",
    );
  },

  cacheIcons(...aIconFileNames)
  {
    for (let fileName of aIconFileNames) {
      let img = new Image();
      img.src = `../img/${fileName}`;
      this._iconCache.push(img);
    }
  },

  formatAccessKey(aLabelText, aMnemonic)
  {
    let rv;
    let idx = aLabelText.indexOf(aMnemonic);
    if (idx == -1) {
      rv = `${aLabelText} (<u>${aMnemonic}</u>)`;
    }
    else {
      let pre = aLabelText.slice(0, idx);
      let post = aLabelText.slice(idx + 1);
      rv = `${pre}<u>${aMnemonic}</u>${post}`;
    }

    return rv;
  },
};
