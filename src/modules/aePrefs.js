/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import {aeConst} from "./aeConst.js";

export let aePrefs = {
  // Background script state persistence
  _defaultBkgdState: {
    _compWndIDs: {},
  },
  
  // User preferences and customizations
  _defaultPrefs: {
    dlgMode: aeConst.DLG_MESSAGE_VIEW,
    checkLinkPlchldrs: true,
    plchldrDelim: "::",
    autoAdjustWndPos: true,
  },
  
  getPrefKeys()
  {
    let allPrefs = {...this._defaultBkgdState, ...this._defaultPrefs};
    return Object.keys(allPrefs);
  },

  async getPref(aPrefName)
  {
    let pref = await messenger.storage.local.get(aPrefName);
    let rv = pref[aPrefName];
    
    return rv;
  },

  async getAllPrefs()
  {
    let rv = await messenger.storage.local.get(this.getPrefKeys());
    return rv;
  },

  async setPrefs(aPrefMap)
  {
    await messenger.storage.local.set(aPrefMap);
  },

  async setDefaultBkgdState()
  {
    await messenger.storage.local.set(this._defaultBkgdState);
  },

  hasUserPrefs(aPrefs)
  {
    return ("plchldrDelim" in aPrefs);
  },

  async setUserPrefs(aPrefs)
  {
    let prefs = {
      dlgMode: aeConst.DLG_MESSAGE_VIEW,
      checkLinkPlchldrs: true,
      plchldrDelim: "::",
      autoAdjustWndPos: true,
    };
    await this._addPrefs(aPrefs, prefs);
  },


  //
  // Helper methods
  //
  
  async _addPrefs(aCurrPrefs, aNewPrefs)
  {
    for (let pref in aNewPrefs) {
      aCurrPrefs[pref] = aNewPrefs[pref];
    }
    await this.setPrefs(aNewPrefs);
  },
};
