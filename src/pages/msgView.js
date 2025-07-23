/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import DOMPurify from "../lib/purify.es.mjs";
import {aeConst} from "../modules/aeConst.js";
import {aePrefs} from "../modules/aePrefs.js";

let mCompTabID, mOrigLinks, mLinkElts, mCurrLinkIdx;
let mUpdatedLinks = [];
let mIsDone = false;


async function init()
{
  let params = new URLSearchParams(window.location.search);
  mCompTabID = Number(params.get("compTabID"));

  log("Check Links::linksTable.js: Initializing message view dialog for compose tab " + mCompTabID);

  mOrigLinks = await messenger.runtime.sendMessage({id: "get-compose-links"});
  mUpdatedLinks = mOrigLinks.slice();

  log("Check Links::msgView.js: Original links data:");
  log(mOrigLinks);

  let msg = await messenger.runtime.sendMessage({id: "get-compose-data"});
  let dlgBody = document.querySelector("#dlg-body");

  dlgBody.querySelector("#msg-subj-line").value = msg.subj;

  let msgPreview = dlgBody.querySelector("#msg-content");
  msgPreview.contentDocument.body.innerHTML = msg.msgBody;

  mLinkElts = msgPreview.contentDocument.body.querySelectorAll("a");

  log("Check Links::msgView.js: Links from message preview:");
  log(mLinkElts);

  mCurrLinkIdx = 0;
  selectLink(mCurrLinkIdx);
}


function selectLink(aLinkIndex)
{
  if (aLinkIndex > 0) {
    // Deselect previous link.
    let prevIdx = aLinkIndex - 1;
    deselectLink(mLinkElts[prevIdx]);
  }
  
  mLinkElts[aLinkIndex].classList.add("ae-selected-link");

  document.querySelector("#link-title").value = mLinkElts[aLinkIndex].innerHTML;
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
    alert("link checking is complete.");
    deselectLink(mLinkElts[mCurrLinkIdx]);

    document.querySelectorAll("#btn-replace, #btn-next")
      .forEach(btn => btn.disabled = true);
    document.querySelector("#btn-replace").classList.remove("default");
    document.querySelector("#btn-close").classList.add("default");
    mIsDone = true;
    
    log("Check Links::msgView.js: Updated link data:");
    log(mUpdatedLinks);

    return;
  }

  selectLink(++mCurrLinkIdx);
}


function replace()
{
  let newHref = document.querySelector("#link-href").value;
  mLinkElts[mCurrLinkIdx].href = newHref;
  mUpdatedLinks[mCurrLinkIdx].href = newHref;
  
  nextLink();
}


function restart()
{
  deselectLink(mLinkElts[mCurrLinkIdx]);
  document.querySelector("#link-title").value = '';
  document.querySelector("#link-href").value = '';

  if (mIsDone) {
    document.querySelectorAll("#btn-replace, #btn-next")
      .forEach(btn => btn.disabled = false);
    document.querySelector("#btn-close").classList.remove("default");
    document.querySelector("#btn-replace").classList.add("default");
    mIsDone = false;
  }

  mCurrLinkIdx = 0;
  selectLink(mCurrLinkIdx);  
}


async function revert()
{
  restart();

  mUpdatedLinks = mOrigLinks.slice();

  let msg = await messenger.runtime.sendMessage({id: "get-compose-data"});
  let msgPreview = document.querySelector("#msg-content");
  msgPreview.contentDocument.body.innerHTML = msg.msgBody;

  mLinkElts = msgPreview.contentDocument.body.querySelectorAll("a");

  // Reselect the first <a> element after reloading the message body.
  selectLink(mCurrLinkIdx);
}


async function closeDlg()
{
  await messenger.runtime.sendMessage({
    id: "update-compose-links",
    compTabID: mCompTabID,
    updatedLinksData: mUpdatedLinks,
  });

  let compWndIDs = await aePrefs.getPref("_compWndIDs");
  let openWnds = compWndIDs[mCompTabID];
  delete openWnds["clMsgView"];
  await aePrefs.setPrefs({_compWndIDs: compWndIDs});

  messenger.windows.remove(messenger.windows.WINDOW_ID_CURRENT);
}


//
// Event handlers
//

window.addEventListener("DOMContentLoaded", aEvent => { init() });

document.querySelector("#btn-next").addEventListener("click", aEvent => {
  nextLink();
});

document.querySelector("#btn-replace").addEventListener("click", aEvent => {
  replace();
});

document.querySelector("#btn-restart").addEventListener("click", aEvent => {
  restart();
});

document.querySelector("#btn-revert").addEventListener("click", aEvent => {
  revert();
});

document.querySelector("#btn-close").addEventListener("click", aEvent => {
  closeDlg();
});


//
// Error reporting and debugging output
//

function log(aMessage)
{
  if (aeConst.DEBUG) { console.log(aMessage); }
}
