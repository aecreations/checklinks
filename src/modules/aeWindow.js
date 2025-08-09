/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import {aePrefs} from "./aePrefs.js";


export class aeWindow
{
  WND_SIZE_ADJ_LINUX = 60;

  MSG_TYPE_ALERT = "alert";
  MSG_TYPE_INFO = "info";
  
  constructor(aComposeTabID)
  {
    this._compTabID = aComposeTabID;
  }

  async openDlg(aURL, aWndKey, aWndPpty)
  {   
    let isWndOpen = false;
    let prefs = await aePrefs.getAllPrefs();
    let compWndIDs = prefs._compWndIDs;
    let wndID;

    if (this._compTabID in compWndIDs) {
      wndID = compWndIDs[this._compTabID][aWndKey];
      (typeof wndID == "number") && (isWndOpen = true);
    }
    
    if (isWndOpen) {
      let updWnd;
      try {
        updWnd = await messenger.windows.update(wndID, {focused: true});
      }
      catch (e) {
        // Handle dangling reference to closed window.
        let openWnds = compWndIDs[this._compTabID];
        delete openWnds[aWndKey];
      }

      if (updWnd) {
        return;
      }
    }

    let os = await this.#getOS();
    let width = aWndPpty.width;
    let height = aWndPpty.height;
    let left, top, wndGeom;

    if (os == "linux") {
      height += this.WND_SIZE_ADJ_LINUX;
    }

    if (prefs.autoAdjustWndPos) {
      ({left, top} = await aeWndPos.calcPopupWndCoords(width, height, aWndPpty.topOffset, aeWndPos.WND_MSG_COMPOSE));
      wndGeom = true;
    }
    else {
      wndGeom = false;
      left = Math.ceil((window.screen.availWidth - width) / 2);
      top = Math.ceil((window.screen.availHeight - height) / 2);
    }

    let wnd = await messenger.windows.create({
      url: aURL,
      type: aWndPpty.type,
      width, height,
      left, top,
    });

    // Workaround to bug where window position isn't set when calling
    // `browser.windows.create()`. If unable to get window geometry, then
    // default to centering on screen.
    if (wndGeom) {
      messenger.windows.update(wnd.id, {left, top});
    }
    
    if (this._compTabID in compWndIDs) {
      compWndIDs[this._compTabID][aWndKey] = wnd.id;
    }
    else {
      compWndIDs[this._compTabID] = {};
      compWndIDs[this._compTabID][aWndKey] = wnd.id;
    }
    await aePrefs.setPrefs({_compWndIDs: compWndIDs});
  }

  
  async alert(aMessageKey, aMessageType=null)
  {
    let message = messenger.i18n.getMessage(aMessageKey);
    let url = "pages/msgbox.html?msgid=" + aMessageKey;

    if (aMessageType) {
      url += `&type=${aMessageType}`;
    }

    // Center the common message box popup within originating composer window,
    // both horizontally and vertically.
    let wndGeom = null;
    let width = 520;
    let height = 170;
    let os = await this.#getOS();

    if (os == "linux") {
      width += this.WND_SIZE_ADJ_LINUX;
      height += this.WND_SIZE_ADJ_LINUX;
    }

    // Default popup window coords.  Unless replaced by window geometry calcs,
    // these coords will be ignored - popup window will always be centered
    // on screen due to a WebExtension API bug; see next comment.
    let left = 256;
    let top = 64;

    let prefs = await aePrefs.getAllPrefs();
    if (prefs.autoAdjustWndPos) {
      wndGeom = await this.#getComposeTabGeometry();

      if (wndGeom) {
        if (wndGeom.w < width) {
          left = null;
        }
        else {
          left = Math.ceil((wndGeom.w - width) / 2) + wndGeom.x;
        }

        if ((wndGeom.h) < height) {
          top = null;
        }
        else {
          top = Math.ceil((wndGeom.h - height) / 2) + wndGeom.y;
        }
      }
    }

    let wnd = await messenger.windows.create({
      url,
      type: "popup",
      width, height,
      left, top,
    });

    // Workaround to bug where window position isn't correctly set when calling
    // `browser.windows.create()`. If unable to get window geometry, then default
    // to centering on screen.
    if (wndGeom) {
      messenger.windows.update(wnd.id, {left, top});
    }
  }

  async getComposeWndGeometry()
  {
    let osName = await this.#getOS();
    return aeWndPos.getComposerWndGeom(osName == "linux");
  }


  //
  // Private helper methods
  //

  async #getOS()
  {
    if (!this._os) {
      let platform = await messenger.runtime.getPlatformInfo();
      this._os = platform.os;
    }

    return this._os;
  }

  async #getComposeTabGeometry()
  {
    let rv = null;
    let tab = await messenger.tabs.get(this._compTabID);
    let wnd = await messenger.windows.get(tab.windowId);
    rv = {
      w: tab.width,
      h: tab.height,
      x: wnd.left,
      y: wnd.top,
    };

    return rv;
  }
}


let aeWndPos = function () {
  let TOP_OFFSET = 200;
  
  async function _getComposerWndGeom(aUnfocusedWnds=false)
  {
    let rv = null;
    let msgrTabs = await messenger.tabs.query({});
    
    for (let tab of msgrTabs) {
      let wnd = await messenger.windows.get(tab.windowId);
      let wndGeom;

      if (aUnfocusedWnds) {
        // On Linux, obtaining a focused compose window may not be possible
        // because focusing a window by calling `messenger.windows.update()`
        // fails. So just obtain the width and height of any open compose
        // window, and skip the x/y coordinates.
        if (wnd.type == "messageCompose") {
          wndGeom = {
            w: wnd.width,
            h: wnd.height,
          };
          rv = wndGeom;
          break;
        }
      }
      else {
        if (wnd.type == "messageCompose" && wnd.focused) {
          wndGeom = {
            w: wnd.width,
            h: wnd.height,
            x: wnd.left,
            y: wnd.top,
          };
          rv = wndGeom;
          break;
        }
      }
    }

    return rv;
  };

  async function _getFocusedWndGeom()
  {
    let rv = null;
    let msgrWnds = await messenger.windows.getAll();

    for (let wnd of msgrWnds) {
      if (["normal", "messageCompose"].includes(wnd.type) && wnd.focused) {
        let wndGeom = {
          w: wnd.width,
          h: wnd.height,
          x: wnd.left,
          y: wnd.top,
        };
        rv = wndGeom;
        break;
      }
    }

    return rv;
  };

  return {
    WND_CURRENTLY_FOCUSED: 0,
    WND_MESSENGER: 1,
    WND_MSG_COMPOSE: 2,

    async getComposerWndGeom(aUnfocusedWnds=false)
    {
      return _getComposerWndGeom(aUnfocusedWnds);
    },
    
    async calcPopupWndCoords(aWidth, aHeight, aTopOffset, aWndType)
    {
      let rv = null;

      let wndGeom;
      if (aWndType == this.WND_MSG_COMPOSE) {
        wndGeom = await _getComposerWndGeom();
      }
      else {
        wndGeom = await _getFocusedWndGeom();
      }
      
      let topOffset = aTopOffset ?? TOP_OFFSET;
      let left, top;

      if (wndGeom) {
        if (wndGeom.w < aWidth) {
          left = null;
        }
        else {
          left = Math.ceil((wndGeom.w - aWidth) / 2) + wndGeom.x;
        }

        if ((wndGeom.h + topOffset) < aHeight) {
          top = null;
        }
        else {
          top = wndGeom.y + topOffset;
        }

        rv = { left, top };
      }
      else {
        rv = {
          left: 62,
          top: 128,
        };
      }
      
      return rv;
    }
  }
}();
