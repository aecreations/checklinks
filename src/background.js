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

    aeCheckLinks.init(prefs);
  }
});


messenger.runtime.onStartup.addListener(async () => {
  log("Check Links: Initializing extension during browser startup.");
  await aePrefs.setDefaultBkgdState();

  let prefs = await aePrefs.getAllPrefs();
  aeCheckLinks.init(prefs);
});


messenger.composeAction.onClicked.addListener(aTab => {
  log("Check Links: Starting link checking on compose tab " + aTab.id);
  aeCheckLinks.startLinkChecking(aTab.id);
});


messenger.menus.onClicked.addListener((aInfo, aTab) => {
  switch (aInfo.menuItemId) {
  case "ae-checklinks":
    aeCheckLinks.startLinkChecking(aTab.id);
    break;

  case "ae-checklinks-prefs":
    aeCheckLinks.openOptionsPage();
    break;

  default:
    break;
  }
});


messenger.alarms.onAlarm.addListener(aAlarm => {
  log(`Check Links: Alarm "${aAlarm.name}" was triggered.`);

  if (aAlarm.name == "cleanup-comp-tab-refs") {
    aeCheckLinks.cleanUpComposeTabRefs();
  }
});


messenger.storage.onChanged.addListener((aChanges, aAreaName) => {
  if ("showCxtMenu" in aChanges) {
    aeCheckLinks.setCustomizations({showCxtMenu: aChanges.showCxtMenu.newValue});
  }
});


messenger.runtime.onMessage.addListener(aMessage => {
  log(`Check Links: Received message "${aMessage.id}"`);

  if (aMessage.id == "get-compose-links") {
    return Promise.resolve(aeCheckLinks.getComposeLinks());
  }
  else if (aMessage.id == "get-compose-data") {
    return Promise.resolve(aeCheckLinks.getComposeData());
  }
  else if (aMessage.id == "update-compose-links") {
    return Promise.resolve(
      aeCheckLinks.updateComposeLinks(
        aMessage.compTabID, aMessage.updatedLinksData, aMessage.isDirty
      )
    );
  }
  else if (aMessage.id == "get-original-msg-body") {
    return Promise.resolve(aeCheckLinks.getOriginalMessageBody(aMessage.compTabID));
  }
  else if (aMessage.id == "switch-dlg-mode") {
    return Promise.resolve(
      aeCheckLinks.switchDlgMode(
        aMessage.dlgMode, aMessage.updatedLinksData, aMessage.compTabID, aMessage.isDirty
      )
    );
  }
  else if (aMessage.id == "get-compose-dirty-flag") {
    return Promise.resolve(aeCheckLinks.getComposeDirtyState());
  }
});


//
// Error reporting and debugging output
//

function log(aMessage)
{
  if (aeConst.DEBUG) { console.log(aMessage); }
}
