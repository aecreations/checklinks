/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import DOMPurify from "../lib/purify.es.mjs";
import {aeConst} from "../modules/aeConst.js";
import {aePrefs} from "../modules/aePrefs.js";
import {aeInterxn} from "../modules/aeInterxn.js";
import {aeDialog} from "../modules/aeDialog.js";
import "../modules/aeI18n.js";
import aeAutoCorrectURL from "../modules/aeAutoCorrectURL.js";
import {aeVisual} from "../modules/aeVisual.js";

let mCompTabID, mOrigLinks, mLinkElts, mCurrLinkIdx;
let mUpdatedLinks = [];
let mIsDirty = false;
let mIsDone = false;
let mConfirmMsgBox, mHelpDlg;


async function init()
{
  let platform = await messenger.runtime.getPlatformInfo();
  document.body.dataset.os = platform.os;
  aeInterxn.init(platform.os);

  let params = new URLSearchParams(window.location.search);
  mCompTabID = Number(params.get("compTabID"));

  log("Check Links::linksTable.js: Initializing message view dialog for compose tab " + mCompTabID);

  mOrigLinks = await messenger.runtime.sendMessage({id: "get-compose-links"});
  mUpdatedLinks = structuredClone(mOrigLinks);

  log("Check Links::msgView.js: Original links data:");
  log(mOrigLinks);

  mIsDirty = await messenger.runtime.sendMessage({id: "get-compose-dirty-flag"});

  let msg = await messenger.runtime.sendMessage({id: "get-compose-data"});
  let dlgBody = document.querySelector("#dlg-body");

  dlgBody.querySelector("#msg-subj-line").value = msg.subj;

  let msgPreview = dlgBody.querySelector("#msg-content");
  let msgBody = DOMPurify.sanitize(msg.msgBody);
  msgBody = processBlankURLs(msgBody);
  msgPreview.contentDocument.body.innerHTML = msgBody;

  mLinkElts = msgPreview.contentDocument.body.querySelectorAll("a");

  log("Check Links::msgView.js: Links from message preview:");
  log(mLinkElts);

  mCurrLinkIdx = 0;
  selectLink(mCurrLinkIdx);

  initDialogs();

  let btnNext = dlgBody.querySelector("#btn-next");
  btnNext.addEventListener("click", aEvent => {
    nextLink();
  });

  let btnReplace = dlgBody.querySelector("#btn-accept");
  btnReplace.addEventListener("click", aEvent => {
    replace();
  });

  let btnRestart = dlgBody.querySelector("#btn-restart");
  btnRestart.addEventListener("click", aEvent => {
    restart();
  });

  let btnRevert = dlgBody.querySelector("#btn-revert");
  btnRevert.addEventListener("click", aEvent => {
    revert();
  });

  dlgBody.querySelector("#btn-close").addEventListener("click", aEvent => {
    accept();
  });

  dlgBody.querySelector("#btn-switch-view").addEventListener("click", aEvent => {
    switchDlgMode();
  });

  dlgBody.querySelector("#btn-help").addEventListener("click", aEvent => {
    mHelpDlg.showModal();
  });

  if (platform.os == "mac") {
    btnReplace.innerText = messenger.i18n.getMessage("btnReplace");
    btnNext.innerText = messenger.i18n.getMessage("btnNext");
    btnRestart.innerText = messenger.i18n.getMessage("btnRestart");
    btnRevert.innerText = messenger.i18n.getMessage("btnRevert");
  }
  else {
    // Access keys for buttons on Windows and Linux.
    let blReplace = aeVisual.formatAccessKey(messenger.i18n.getMessage("btnReplace"), "R");
    let blNext = aeVisual.formatAccessKey(messenger.i18n.getMessage("btnNext"), "N");
    let blRestart = aeVisual.formatAccessKey(messenger.i18n.getMessage("btnRestart"), "S");
    let blRevert = aeVisual.formatAccessKey(messenger.i18n.getMessage("btnRevert"), "v");
    btnReplace.innerHTML = DOMPurify.sanitize(blReplace);
    btnNext.innerHTML = DOMPurify.sanitize(blNext);
    btnRestart.innerHTML = DOMPurify.sanitize(blRestart);
    btnRevert.innerHTML = DOMPurify.sanitize(blRevert);
  }

  let defDlgBtnFollowsFocus = await aePrefs.getPref("defDlgBtnFollowsFocus");
  if (defDlgBtnFollowsFocus) {
    aeInterxn.initDialogButtonFocusHandlers();
  }

  focusLinkAddressTextbox();
}


function initDialogs()
{
  mConfirmMsgBox = new aeDialog("#finished-msgbox");
  mConfirmMsgBox.onAfterAccept = function ()
  {
    deselectLink(mLinkElts[mCurrLinkIdx]);

    document.querySelectorAll("#link-title-lbl, #link-href-lbl")
      .forEach(aElt => aElt.classList.add("disabled"));
    document.querySelectorAll("#link-title, #link-href, #btn-accept, #btn-next")
      .forEach(aElt => aElt.disabled = true);    
    document.querySelector("#link-title").value = '';
    document.querySelector("#link-href").value = '';
    document.querySelector("#btn-accept").classList.remove("default");

    let closeBtn = document.querySelector("#btn-close");
    closeBtn.classList.add("default");
    closeBtn.focus();
    mIsDone = true;
    
    log("Check Links::msgView.js: mConfirmMsgBox.onAfterAccept(): Updated link data:");
    log(mUpdatedLinks);
  };

  mHelpDlg = new aeDialog("#help-dlg");
  mHelpDlg.onFirstInit = function ()
  {
    let hlpHowTo = this.find("#msg-view-help-howto");
    hlpHowTo.append(`${messenger.i18n.getMessage("hlpMsgVwHowToNext")} 
${messenger.i18n.getMessage("hlpMsgVwHowtoChg")} ${messenger.i18n.getMessage("hlpLinkEg")}`);
  };
  mHelpDlg.onAfterAccept = function ()
  {
    focusLinkAddressTextbox();
  };
}


function processBlankURLs(aHTMLStr)
{
  let rv = aHTMLStr.replace(new RegExp(`${aeConst.DUMMY_BLANK_URL}`, "g"), "about:blank");
  
  return rv;
}


function selectLink(aLinkIndex)
{
  if (aLinkIndex > 0) {
    // Deselect previous link.
    let prevIdx = aLinkIndex - 1;
    deselectLink(mLinkElts[prevIdx]);
  }
  
  mLinkElts[aLinkIndex].classList.add("ae-selected-link");
  mLinkElts[aLinkIndex].scrollIntoView({block: "end", inline: "nearest"});

  document.querySelector("#link-title").value = mLinkElts[aLinkIndex].innerText;
  document.querySelector("#link-href").value = mLinkElts[aLinkIndex].href;
}


function deselectLink(aLinkElt)
{
  aLinkElt.classList.remove("ae-selected-link");
  if (aLinkElt.classList.length == 0) {
    aLinkElt.removeAttribute("class");
  }
}


function nextLink()
{
  if (mCurrLinkIdx == (mLinkElts.length - 1)) {
    mConfirmMsgBox.showModal();
    return;
  }

  selectLink(++mCurrLinkIdx);
  focusLinkAddressTextbox();
}


function replace()
{
  let linkHref = document.querySelector("#link-href");
  let newHref = linkHref.value;
  if (newHref == '') {
    linkHref.focus();
    return;
  }

  newHref = aeAutoCorrectURL(newHref);

  mLinkElts[mCurrLinkIdx].href = newHref;
  mUpdatedLinks[mCurrLinkIdx].href = newHref;
  mIsDirty = true;
  
  nextLink();
  focusLinkAddressTextbox();
}


function restart()
{
  deselectLink(mLinkElts[mCurrLinkIdx]);
  document.querySelector("#link-title").value = '';
  document.querySelector("#link-href").value = '';

  if (mIsDone) {
    document.querySelectorAll("#link-title-lbl, #link-href-lbl")
      .forEach(aElt => aElt.classList.remove("disabled"));
    document.querySelectorAll("#link-title, #link-href, #btn-accept, #btn-next")
      .forEach(aElt => aElt.disabled = false);
    document.querySelector("#btn-close").classList.remove("default");
    document.querySelector("#btn-accept").classList.add("default");
    mIsDone = false;
  }

  mCurrLinkIdx = 0;
  selectLink(mCurrLinkIdx);
  focusLinkAddressTextbox();
}


async function revert()
{
  restart();

  log("Check Links::msgView.js: revert(): Original links data:");
  log(mOrigLinks);

  mUpdatedLinks = structuredClone(mOrigLinks);

  // Get original message content, with link placeholders substituted
  // (if applicable).
  let msgBody = await messenger.runtime.sendMessage({
    id: "get-original-msg-body",
    compTabID: mCompTabID,
  });
  msgBody = DOMPurify.sanitize(msgBody);
  msgBody = processBlankURLs(msgBody);

  let msgPreview = document.querySelector("#msg-content");
  msgPreview.contentDocument.body.innerHTML = msgBody;

  mLinkElts = msgPreview.contentDocument.body.querySelectorAll("a");

  // Reselect the first <a> element after reloading the message body.
  selectLink(mCurrLinkIdx);

  log("Check Links::msgView.js: revert(): Updated links (should be reverted to original links):");
  log(mUpdatedLinks);

  focusLinkAddressTextbox();
}


function focusLinkAddressTextbox()
{
  let textbox = document.querySelector("#link-href");
  textbox.focus();
  textbox.select();
}


async function accept()
{
  await messenger.runtime.sendMessage({
    id: "update-compose-links",
    compTabID: mCompTabID,
    updatedLinksData: mUpdatedLinks,
    isDirty: mIsDirty,
  });

  closeDlg();
}


async function closeDlg()
{
  let compWndIDs = await aePrefs.getPref("_compWndIDs");
  let openWnds = compWndIDs[mCompTabID];
  delete openWnds["clMsgView"];
  await aePrefs.setPrefs({_compWndIDs: compWndIDs});

  messenger.windows.remove(messenger.windows.WINDOW_ID_CURRENT);
}


async function switchDlgMode()
{
  await messenger.runtime.sendMessage({
    id: "switch-dlg-mode",
    dlgMode: aeConst.DLG_TABLE_VIEW,
    updatedLinksData: mUpdatedLinks,
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
      let defBtn = document.querySelector("button.default");
      defBtn.click();
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
  // Access keys for Windows and Linux.
  if (aEvent.key.toUpperCase() == "N" && aEvent.altKey) {
    aEvent.preventDefault();
    document.querySelector("#btn-next").click();
  }
  else if (aEvent.key.toUpperCase() == "R" && aEvent.altKey) {
    aEvent.preventDefault();
    document.querySelector("#btn-accept").click();
  }
  else if (aEvent.key.toUpperCase() == "S" && aEvent.altKey) {
    aEvent.preventDefault();
    document.querySelector("#btn-restart").click();
  }
  else if (aEvent.key.toUpperCase() == "V" && aEvent.altKey) {
    aEvent.preventDefault();
    document.querySelector("#btn-revert").click();
  }
});


//
// Error reporting and debugging output
//

function log(aMessage)
{
  if (aeConst.DEBUG) { console.log(aMessage); }
}
