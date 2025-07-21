/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import {aeConst} from "./modules/aeConst.js";
import {aePrefs} from "./modules/aePrefs.js";
import * as aeCheckLinks from "./modules/aeCheckLinks.js";


messenger.runtime.onInstalled.addListener(async (aInstall) => {
  if (aInstall.reason == "install") {
    log("Check Links: Extension installed");

    let prefs = {};
    await aePrefs.setUserPrefs(prefs);
    await aePrefs.setDefaultBkgdState();
  }
});


messenger.runtime.onStartup.addListener(async () => {
  log("Check Links: Initializing extension during browser startup.");
  await aePrefs.setDefaultBkgdState();
});


messenger.composeAction.onClicked.addListener(aTab => {
  log("Check Links: Starting link checking on compose tab " + aTab.id);
  aeCheckLinks.startLinkChecking(aTab.id);
});


//
// Error reporting and debugging output
//

function log(aMessage)
{
  if (aeConst.DEBUG) { console.log(aMessage); }
}
