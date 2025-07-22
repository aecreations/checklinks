/* -*- mode: javascript; tab-width: 8; indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import DOMPurify from "../lib/purify.es.mjs";
import {Wunderbaum} from "../lib/wunderbaum/wunderbaum.esm.min.js";
import {aeConst} from "../modules/aeConst.js";
import {aePrefs} from "../modules/aePrefs.js";

let mCompTabID, mUpdatedTblData;


async function init()
{
  let params = new URLSearchParams(window.location.search);
  mCompTabID = Number(params.get("compTabID"));

  log("Check Links::linksTable.js: Initializing table view dialog for compose tab " + mCompTabID);

  let linksTblData = await messenger.runtime.sendMessage({id: "get-table-view-data"});
  mUpdatedTblData = linksTblData.slice();

  log("Check Links::linksTable.js: Links table data:");
  log(linksTblData);

  let treeGrid = new Wunderbaum({
    element: document.getElementById("link-table-grid"),
    id: "link-table",
    columns: [
      {
	id: "*",
	title: "link text",
	width: "250px"
      },
      {
	id: "href",
	title: "link address (url)",
	width: "259px"
      },
    ],
    source: linksTblData,

    render(aRenderEvt)
    {
      let node = aRenderEvt.node;
      
      for (let col of Object.values(aRenderEvt.renderColInfosById)) {
	let val = node.data[col.id];
	
	switch (col.id) {
	case "href":
	  if (aRenderEvt.isNew) {
	    col.elem.innerHTML = '<input type="text" tabindex="-1">';
	  }
	  aRenderEvt.util.setValueToElem(col.elem, val);
	  break;

        default:
          col.elem.textContent = node.data[col.id];
          break;
	}
      }
    },

    change(aChangeEvt)
    {
      let node = aChangeEvt.node;
      let colId = aChangeEvt.info.colId;

      log(`Check Links::linksTable.js: Changed link ${node._rowIdx} `);

      let updatedVal = aChangeEvt.util.getValueFromElem(aChangeEvt.inputElem, true);
      node.data[colId] = updatedVal;
      mUpdatedTblData[node._rowIdx].href = updatedVal;
    },

    debugLevel: 0,
  });
}


async function accept(aEvent)
{
  log("Check Links::linksTable.js: accept(): Updated links data:");
  log(mUpdatedTblData);

  await messenger.runtime.sendMessage({
    id: "update-compose-links",
    compTabID: mCompTabID,
    updatedLinksData: mUpdatedTblData,
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


//
// Event handlers
//

window.addEventListener("DOMContentLoaded", aEvent => { init() });

document.querySelector("#btn-accept").addEventListener("click", aEvent => {
  accept(aEvent);
});

document.querySelector("#btn-cancel").addEventListener("click", aEvent => {
  cancel(aEvent);
});


//
// Error reporting and debugging output
//

function log(aMessage)
{
  if (aeConst.DEBUG) { console.log(aMessage); }
}
