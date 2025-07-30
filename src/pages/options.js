/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import {aeConst} from "../modules/aeConst.js";
import {aePrefs} from "../modules/aePrefs.js";
import {aeDialog} from "../modules/aeDialog.js";
import "../modules/aeI18n.js";

let mAboutDlg;


async function init()
{
  let prefs = await aePrefs.getAllPrefs();

  setSelectedDlgModeRadioBtn(prefs);
  let dlgModesRadioBtns = document.querySelectorAll(`input[name="dlg-mode"]`);
  dlgModesRadioBtns.forEach(aElt => {
    aElt.addEventListener("click", aEvent => {
      aePrefs.setPrefs({dlgMode: aEvent.target.value});
    });
  });

  let linkPlchldrs = document.querySelector("#link-plchldrs");
  linkPlchldrs.checked = prefs.checkLinkPlchldrs;
  linkPlchldrs.addEventListener("click", aEvent => {
    aePrefs.setPrefs({checkLinkPlchldrs: aEvent.target.checked});
  });

  let plchldrDelimSelect = document.querySelector("#plchldr-delim-opts");
  let plchldrDelimOpts = plchldrDelimSelect.options;
  for (let i = 0; i < plchldrDelimOpts.length; i++) {
    if (plchldrDelimOpts[i].label == prefs.plchldrDelim) {
      plchldrDelimSelect.selectedIndex = i;
      break;
    }
  }
  plchldrDelimSelect.addEventListener("change", aEvent => {
    let plchldrDelim = aEvent.target.selectedOptions[0].value;
    aePrefs.setPrefs({plchldrDelim});
  });

  initDialogs();

  document.querySelector("#about-btn").addEventListener("click", aEvent => {
    mAboutDlg.showModal();
  });

  let links = document.querySelectorAll(".hyperlink");
  for (let link of links) {
    link.addEventListener("click", aEvent => {
      aEvent.preventDefault();
      gotoURL(aEvent.target.href, ("openInTbWnd" in aEvent.target.dataset));
    });
  }
}


function initDialogs()
{
  mAboutDlg = new aeDialog("#about-dlg");
  mAboutDlg.setProps({
    extInfo: null,
  });
  mAboutDlg.onFirstInit = function ()
  {
    function $(aID) {
      return document.querySelector(aID);
    }

    if (!this.extInfo) {
      let extManifest = messenger.runtime.getManifest();
      this.extInfo = {
        name: extManifest.name,
        version: extManifest.version,
        description: extManifest.description,
        homePgURL: extManifest.homepage_url,
      };
    }

    $("#ext-name").append(this.extInfo.name);
    $("#ext-ver").append(messenger.i18n.getMessage("aboutExtVer", this.extInfo.version));
    $("#ext-desc").append(this.extInfo.description);
    $("#ext-home-pg-link").setAttribute("href", this.extInfo.homePgURL);

    // TO DO: User contribution CTA
  };
}


async function setSelectedDlgModeRadioBtn(aPrefs=null)
{
  let dlgMode;
  if (aPrefs) {
    dlgMode = aPrefs.dlgMode;
  }
  else {
    dlgMode = await aePrefs.getPref("dlgMode");
  }
  
  let dlgModeRadioBtns = Array.from(document.getElementsByName("dlg-mode"));
  let dlgModeOpt = dlgModeRadioBtns.find(aRadioOpt => aRadioOpt.value == dlgMode);
  dlgModeOpt.checked = true;
}


function gotoURL(aURL, aOpenInTbWnd)
{
  if (aOpenInTbWnd) {
    messenger.tabs.create({url: aURL});
  }
  else {
    messenger.windows.openDefaultBrowser(aURL);
  }
}


//
// Event handlers
//

document.addEventListener("DOMContentLoaded", aEvent => { init() });

window.addEventListener("focus", aEvent => { setSelectedDlgModeRadioBtn() });

document.addEventListener("contextmenu", aEvent => {
  if (!aeConst.DEBUG) {
    aEvent.preventDefault();
  }
});
