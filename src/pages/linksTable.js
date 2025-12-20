/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import {aeConst} from "../modules/aeConst.js";
import {aePrefs} from "../modules/aePrefs.js";
import {aeInterxn} from "../modules/aeInterxn.js";
import {aeVisual} from "../modules/aeVisual.js";
import {aeDialog} from "../modules/aeDialog.js";
import "../modules/aeI18n.js";
import aeAutoCorrectURL from "../modules/aeAutoCorrectURL.js";

let mCompTabID, mUpdatedTblData;
let mIsDirty = false;
let mHelpDlg;


async function init()
{
  let platform = await messenger.runtime.getPlatformInfo();
  document.body.dataset.os = platform.os;
  aeInterxn.init(platform.os);

  let prefs = await aePrefs.getAllPrefs();
  aeVisual.enableAccentColor(prefs.useAccentColor);

  let params = new URLSearchParams(window.location.search);
  mCompTabID = Number(params.get("compTabID"));

  log("Check Links::linksTable.js: Initializing table view dialog for compose tab " + mCompTabID);

  let linksTblData = await messenger.runtime.sendMessage({id: "get-compose-links"});

  // Handle link placeholders, which are set to a special URL to get past
  // DOMPurify's sanitization.
  for (let link of linksTblData) {
    if (link.href.search(new RegExp(`${aeConst.DUMMY_BLANK_URL}`, "g")) != -1) {
      link.href = "about:blank";
    }
  }

  mUpdatedTblData = linksTblData.slice();

  log("Check Links::linksTable.js: Links table data:");
  log(linksTblData);

  mIsDirty = await messenger.runtime.sendMessage({id: "get-compose-dirty-flag"});

  document.querySelector("#btn-accept").addEventListener("click", aEvent => {
    accept(aEvent);
  });

  document.querySelector("#btn-cancel").addEventListener("click", aEvent => {
    cancel(aEvent);
  });

  document.querySelector("#btn-switch-view").addEventListener("click", aEvent => {
    switchDlgMode();
  });

  let helpBtn = document.querySelector("#btn-help");
  helpBtn.title = messenger.i18n.getMessage("btnHlp");
  helpBtn.addEventListener("click", aEvent => {
    mHelpDlg.showModal();
  });

  if (prefs.defDlgBtnFollowsFocus) {
    aeInterxn.initDialogButtonFocusHandlers();
  }

  mHelpDlg = new aeDialog("#help-dlg");
  mHelpDlg.onFirstInit = function ()
  {
    let hlpHowTo = this.find("#tbl-view-help-howto");
    hlpHowTo.append(`${messenger.i18n.getMessage("hlpTblVwHowTo")} 
${messenger.i18n.getMessage("hlpLinkEg")}`);
  }
}


async function accept(aEvent)
{
  // Check for empty URLs.
  let linkHrefElts = document.querySelectorAll(".link-href");
  for (let linkHref of linkHrefElts) {
    if (linkHref.value == '') {
      linkHref.focus();
      return;
    }
  }

  log("Check Links::linksTable.js: accept(): Updated links data:");
  log(mUpdatedTblData);

  await messenger.runtime.sendMessage({
    id: "update-compose-links",
    compTabID: mCompTabID,
    updatedLinksData: mUpdatedTblData,
    isDirty: mIsDirty,
  });

  closeDlg();
}


function cancel(aEvent)
{
  closeDlg();
}


async function closeDlg()
{
  let compWndIDs = await aePrefs.getPref("_compWndIDs");
  let openWnds = compWndIDs[mCompTabID];
  delete openWnds["clListView"];
  await aePrefs.setPrefs({_compWndIDs: compWndIDs});

  messenger.windows.remove(messenger.windows.WINDOW_ID_CURRENT);
}


async function switchDlgMode()
{
  // Escape "about:blank" URLs
  for (let link of mUpdatedTblData) {
    if (link.href == "about:blank") {
      link.href = aeConst.DUMMY_BLANK_URL;
    }
  }
  
  await messenger.runtime.sendMessage({
    id: "switch-dlg-mode",
    dlgMode: aeConst.DLG_MESSAGE_VIEW,
    updatedLinksData: mUpdatedTblData,
    compTabID: mCompTabID,
    isDirty: mIsDirty,
  });

  closeDlg();
}


//
// Event handlers
//

window.addEventListener("DOMContentLoaded", aEvent => { init() });

window.addEventListener("contextmenu", aEvent => {
  if (aEvent.target.tagName != "INPUT" && aEvent.target.getAttribute("type") != "text") {
    aEvent.preventDefault();
  }
});


window.addEventListener("keydown", aEvent => {
  aeInterxn.suppressBrowserShortcuts(aEvent, false);

  if (aEvent.key == "Enter") {
    if (aEvent.target.tagName == "BUTTON" && aEvent.target.id != "btn-accept"
        && !aEvent.target.classList.contains("dlg-accept")) {
      aEvent.preventDefault();
      aEvent.target.click();
      return;
    }

    if (aeDialog.isOpen()) {
      // Avoid duplicate invocation due to pressing ENTER while OK button
      // is focused in a modal dialog.
      if (!aEvent.target.classList.contains("dlg-accept")) {
        aeDialog.acceptDlgs();
      }
      return;
    }

    if (aEvent.target.id != "btn-accept") {
      accept(aEvent);
    }
  }
  else if (aEvent.key == "Escape") {
    if (aeDialog.isOpen()) {
      aeDialog.cancelDlgs();
      return;
    }
    closeDlg();    
  }
  else if (aEvent.key == "F1") {
    mHelpDlg.showModal();
  }
});


//
// Error reporting and debugging output
//

function log(aMessage)
{
  if (aeConst.DEBUG) { console.log(aMessage); }
}
