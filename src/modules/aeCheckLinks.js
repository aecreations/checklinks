/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import DOMPurify from "../lib/purify.es.mjs";
import {aeConst} from "./aeConst.js";
import {aePrefs} from "./aePrefs.js";
import {aeWindow} from "./aeWindow.js";

// This module is executed in a background script context, which may be
// suspended after a period of inactivity.
// These module-scoped variables are used only briefly or during
// initialization, so they don't need to be saved to extension storage.
let mLinks = [];
let mSubject = null;
let mMsgBody = null;
let mIsDirty = false;


export async function init(aPrefs)
{
  messenger.menus.create({
    id: "ae-checklinks-prefs",
    title: messenger.i18n.getMessage("mnuPrefs"),
    contexts: ["compose_action"],
  });

  await setCustomizations(aPrefs);

  messenger.alarms.create("cleanup-comp-tab-refs", {
    periodInMinutes: aeConst.COMPOSE_TAB_CLEANUP_DELAY_MINS,
  });
}


export async function setCustomizations(aPrefs)
{
  if (aPrefs.showCxtMenu) {
    messenger.menus.create({
      id: "ae-checklinks",
      title: messenger.i18n.getMessage("extName"),
      contexts: ["compose_body"],
    });
  }
  else {
    try {
      messenger.menus.remove("ae-checklinks");
    }
    catch {}
  }
}


export async function openOptionsPage()
{
  let resp;
  try {
    resp = await messenger.runtime.sendMessage({id: "ping-ext-prefs-pg"});
  }
  catch {}

  if (resp) {
    await messenger.runtime.sendMessage({id: "focus-ext-prefs-pg"});
  }
  else {
    messenger.runtime.openOptionsPage();
  }
}


export async function startLinkChecking(aComposeTabID)
{
  // Reset links data.
  mLinks = [];
  mIsDirty = false;
  
  let win = new aeWindow(aComposeTabID);
  let comp = await messenger.compose.getComposeDetails(aComposeTabID);
  mSubject = comp.subject;

  // Clone the message body string so that in-progress link checking doesn't
  // immediately overwrite it.
  let msgBody = comp.body.slice();

  if (comp.isPlainText) {
    info("aeCheckLinks.startLinkChecking(): Link checking is not available for plain-text messages.");
    win.alert("msgPlainTxt");
    return;
  }

  let dp = new DOMParser();
  let doc = dp.parseFromString(msgBody, "text/html");

  if (doc.body.innerText == '') {
    info("aeCheckLinks.startLinkChecking(): Message is empty.");
    return;
  }

  // Process link placeholders.
  let prefs = await aePrefs.getAllPrefs();
  if (prefs.checkLinkPlchldrs) {
    let processedHTML = processLinkPlaceholders(doc.body.innerHTML, prefs.plchldrDelim);
    doc = dp.parseFromString(processedHTML, "text/html");
  }

  let links = doc.body.querySelectorAll("a");

  log(`aeCheckLinks.js::checkLinks(): There are ${links.length} links in the draft message:`);
  log(links);

  if (links.length == 0) {
    info("aeCheckLinks.startLinkChecking(): No hyperlinks found.");
    win.alert("msgNoLnks", win.MSG_TYPE_INFO);
    return;
  }

  for (let link of links) {
    mLinks.push({
      title: link.innerText,
      href: link.href,
    });
  }

  mMsgBody = doc.body.innerHTML;

  await openCheckLinksDlg(win, prefs.dlgMode, aComposeTabID);
}


async function openCheckLinksDlg(aWindow, aDlgMode, aComposeTabID)
{
  let url, wndKey;
  let wndPpty = {type: "popup"};
  if (aDlgMode == aeConst.DLG_TABLE_VIEW) {
    wndKey = "clListView";
    url = messenger.runtime.getURL("../pages/linksTable.html");
    wndPpty.width = 718;
    wndPpty.height = 310;

    let {os} = await messenger.runtime.getPlatformInfo();
    if (os == "win") {
      wndPpty.height = 318;
    }
  }
  else {
    wndKey = "clMsgView";
    url = messenger.runtime.getURL("../pages/msgView.html");

    let compWndGeom = await aWindow.getComposeWndGeometry();
    wndPpty.width = compWndGeom.w;
    wndPpty.height = compWndGeom.h;
    wndPpty.left = compWndGeom.x;
    wndPpty.top = compWndGeom.y;
    wndPpty.topOffset = 0;
  }
  url += `?compTabID=${aComposeTabID}`;

  await aWindow.openDlg(url, wndKey, wndPpty, aComposeTabID); 
}


export function getComposeLinks()
{
  if (!mLinks) {
    throw new ReferenceError("aeCheckLinks: mLinks is not defined");
  }
  return mLinks;
}


export function getComposeData()
{
  if (mSubject === null || mMsgBody === null) {
    throw new ReferenceError("aeCheckLinks: mSubject and/or mMsgBody not defined");
  }

  let rv = {
    subj: mSubject,
    msgBody: mMsgBody,
  }
  return rv;
}


export function getComposeDirtyState()
{
  return mIsDirty;
}


export async function updateComposeLinks(aComposeTabID, aUpdatedLinksData, aIsDirty)
{
  if (!aIsDirty) {
    log("aeCheckLinks.updateComposeLinks(): No changes to hyperlinks were detected.");
    return;
  }

  let comp = await messenger.compose.getComposeDetails(aComposeTabID);

  log("aeCheckLinks.updateComposeLinks(): Updated links data:");
  log(aUpdatedLinksData);
  
  let dp = new DOMParser();
  let doc = dp.parseFromString(comp.body, "text/html");

  // TO DO: Check if user had edited the draft message while the Check Links
  // dialog was opened.  If it was edited, then display a warning to the user
  // and exit.

  // Process link placeholders.
  let prefs = await aePrefs.getAllPrefs();
  if (prefs.checkLinkPlchldrs) {
    let processedHTML = processLinkPlaceholders(doc.body.innerHTML, prefs.plchldrDelim);
    doc = dp.parseFromString(processedHTML, "text/html");
  }
  
  let links = doc.body.querySelectorAll("a");

  for (let i = 0; i < links.length; i++) {
    links[i].href = aUpdatedLinksData[i].href;
  }

  log("aeCheckLinks.updateComposeLinks(): Updated links in composer:");
  log(links);

  let body = DOMPurify.sanitize(doc.body.innerHTML);
  await messenger.compose.setComposeDetails(aComposeTabID, {
    body,
    isModified: true,
  });

  return true;
}


export async function switchDlgMode(aDlgMode, aUpdatedLinksData, aComposeTabID, aIsDirty)
{
  let comp = await messenger.compose.getComposeDetails(aComposeTabID);
  mSubject = comp.subject;
  mIsDirty = aIsDirty;

  // Clone the message body string so that in-progress link checking doesn't
  // immediately overwrite it.
  let msgBody = comp.body.slice();
  let dp = new DOMParser();
  let doc = dp.parseFromString(msgBody, "text/html");

  // Process link placeholders.
  let prefs = await aePrefs.getAllPrefs();
  if (prefs.checkLinkPlchldrs) {
    let processedHTML = processLinkPlaceholders(doc.body.innerHTML, prefs.plchldrDelim);
    doc = dp.parseFromString(processedHTML, "text/html");
  }

  // Update links in saved message body.
  let currLinks = doc.body.querySelectorAll("a"); 
  for (let i = 0; i < aUpdatedLinksData.length; i++) {
    currLinks[i].href = aUpdatedLinksData[i].href;
  }
  mMsgBody = doc.body.innerHTML;
  mLinks = aUpdatedLinksData;
  
  await aePrefs.setPrefs({dlgMode: aDlgMode});

  // After the old dialog is closed, open the new dialog.
  // HACK!! - Need to focus the composer window first in order to calculate its
  // window geometry which is needed when opening the dialog.
  let compTab = await messenger.tabs.get(aComposeTabID);
  await messenger.windows.update(compTab.windowId, {focused: true});
  let win = new aeWindow(aComposeTabID);
  await openCheckLinksDlg(win, aDlgMode, aComposeTabID);

  return true;
}


export async function getOriginalMessageBody(aComposeTabID)
{
  let rv;

  let comp = await messenger.compose.getComposeDetails(aComposeTabID);
  let msgBody = comp.body.slice();
  let prefs = await aePrefs.getAllPrefs();

  if (prefs.checkLinkPlchldrs) {
    let dp = new DOMParser();
    let processedHTML = processLinkPlaceholders(msgBody, prefs.plchldrDelim);
    let doc = dp.parseFromString(processedHTML, "text/html");
    msgBody = doc.body.innerHTML;
  }
  rv = msgBody;
  
  return rv;
}


function processLinkPlaceholders(aComposeHTMLSrc, aPlaceholderDelim)
{
  let rv = aComposeHTMLSrc.replace(
    new RegExp(`${aPlaceholderDelim}(\\w)`, "g"), `<a href="${aeConst.DUMMY_BLANK_URL}">$1`
  );
  rv = rv.replace(new RegExp(`(\\w)${aPlaceholderDelim}`, "g"), `$1</a>`);

  return rv;
}


export async function cleanUpComposeTabRefs()
{
  let prefs = await aePrefs.getAllPrefs();
  let compWndIDs = prefs._compWndIDs;

  for (let compTabID in compWndIDs) {
    compTabID = Number(compTabID);
    let compTab;
    try {
      compTab = await messenger.tabs.get(compTabID);
    }
    catch {}

    if (!compTab) {
      delete compWndIDs[compTabID];
    }
  }

  aePrefs.setPrefs({_compWndIDs: compWndIDs});
}


//
// Error reporting and debugging output
//

function log(aMessage)
{
  if (aeConst.DEBUG) { console.log(aMessage); }
}


function info(aMessage)
{
  if (aeConst.DEBUG) { console.info(aMessage); }
}
