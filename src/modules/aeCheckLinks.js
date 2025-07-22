/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import {aeConst} from "./aeConst.js";
import {aePrefs} from "./aePrefs.js";
import {aeWindow} from "./aeWindow.js";

let mLinks = [];


export async function startLinkChecking(aComposeTabID)
{
  let win = new aeWindow(aComposeTabID);
  
  // Reset links data.
  mLinks = [];
  
  let comp = await messenger.compose.getComposeDetails(aComposeTabID);

  if (comp.isPlainText) {
    info("aeCheckLinks.startLinkChecking(): Link checking is not available for plain-text messages.");
    win.alert("msgPlainTxt");
    return;
  }

  let dp = new DOMParser();
  let doc = dp.parseFromString(comp.body, "text/html");

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
    return;
  }

  for (let link of links) {
    mLinks.push({
      title: link.innerHTML,
      href: link.href,
    });
  }

  let url = messenger.runtime.getURL("../pages/linksTable.html");
  url += `?compTabID=${aComposeTabID}`;

  let wndPpty = {
    type: "popup",
    width: 560,
    height: 256,
  };
  await win.openDialog(url, "clListView", wndPpty, aComposeTabID);
}


export function getComposeLinks()
{
  return mLinks;
}


export async function updateComposeLinks(aComposeTabID, aUpdatedLinksData)
{
  let comp = await messenger.compose.getComposeDetails(aComposeTabID);

  log("aeCheckLinks.updateComposeLinks(): Updated links data:");
  log(aUpdatedLinksData);
  
  let dp = new DOMParser();
  let doc = dp.parseFromString(comp.body, "text/html");

  // TO DO: Check if user had edited the draft message while the Check Links
  // dialog was opened.  If it was edited, then display a warning to the user
  // and exit.
  // - Is there a way to temporarily make a draft read-only via the MailExtensions API?

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

  await messenger.compose.setComposeDetails(aComposeTabID, {
    body: doc.body.innerHTML,
    isModified: true,
  });

  return true;
}


function processLinkPlaceholders(aComposeHTMLSrc, aPlaceholderDelim)
{
  let rv = aComposeHTMLSrc.replace(
    new RegExp(`${aPlaceholderDelim}(\\w)`, "g"), `<a href="about:blank">$1`
  );
  rv = rv.replace(new RegExp(`(\\w)${aPlaceholderDelim}`, "g"), `$1</a>`);

  return rv;
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
